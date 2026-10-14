import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { createRequire } from 'node:module'
import { parse } from 'csv-parse/sync'
import { geoPath, geoTransverseMercator } from 'd3-geo'
import { feature } from 'topojson-client'

const require = createRequire(import.meta.url)
const refresh = process.argv.includes('--refresh')
const cacheRoot = new URL('../data/sources/', import.meta.url)
const nkomUrl = 'https://stenonicprdnoea01.blob.core.windows.net/enonicpubliccontainer/prd/tildeling/datasenter/datasenter-operatorer.csv'
await mkdir(cacheRoot, { recursive: true })

async function cached(name, url) {
  const path = new URL(name, cacheRoot)
  if (!refresh) {
    try {
      const text = await readFile(path, 'utf8')
      if (!text.includes('\u0000')) return text
    } catch (error) { if (error.code !== 'ENOENT') throw error }
  }
  const response = await fetch(url, { signal: AbortSignal.timeout(30000) })
  if (!response.ok) throw new Error(`${url}: ${response.status}`)
  const bytes = new Uint8Array(await response.arrayBuffer())
  const encoding = bytes[0] === 255 && bytes[1] === 254 ? 'utf-16le' : bytes[0] === 254 && bytes[1] === 255 ? 'utf-16be' : 'utf-8'
  const text = new TextDecoder(encoding, { fatal: true }).decode(bytes)
  if (name.endsWith('.json')) JSON.parse(text)
  await writeFile(path, text)
  return text
}

const nkomCsv = await cached('nkom-operatorer.csv', nkomUrl)
const rawOperators = parse(nkomCsv, { columns: headers => headers.map(header => header.replace(/^\uFEFF/, '').trim()), skip_empty_lines: true, trim: true })
const operators = rawOperators.map(row => ({ name: row.Firmanavn, orgnr: row.Organisasjonsnummer, cryptoMining: row.Kryptovalutautvinning.startsWith('Ja') }))
if (!operators.length || operators.some(row => !row.name || !/^\d{9}$/.test(row.orgnr)) || new Set(operators.map(row => row.orgnr)).size !== operators.length) throw new Error('Invalid Nkom operator register')
const brreg = JSON.parse(await cached('brreg-enheter.json', `https://data.brreg.no/enhetsregisteret/api/enheter?organisasjonsnummer=${operators.map(row => row.orgnr).join(',')}&size=2000`))
const businesses = new Map((brreg._embedded?.enheter ?? []).map(row => [row.organisasjonsnummer, row.forretningsadresse ?? {}]))
const enrichedOperators = operators.map(row => ({ ...row, businessKommune: businesses.get(row.orgnr)?.kommune ?? null, kommunenummer: businesses.get(row.orgnr)?.kommunenummer ?? null }))
let geocodes = {}
try { geocodes = JSON.parse(await readFile(new URL('geocode-cache.json', cacheRoot), 'utf8')) } catch (error) { if (error.code !== 'ENOENT') throw error }
const csv = await readFile(new URL('../data/datacenters.csv', import.meta.url), 'utf8')
const rows = parse(csv, { columns: true, skip_empty_lines: true, trim: true })
const ids = new Set()
const numeric = value => {
  if (value === '') return null
  const number = Number(value)
  if (!Number.isFinite(number) || number < 0) throw new Error(`Invalid MW: ${value}`)
  return number
}
const sites = []
for (const row of rows) {
  if (!/^[a-z0-9-]+$/.test(row.id) || ids.has(row.id)) throw new Error(`Invalid or duplicate id: ${row.id}`)
  ids.add(row.id)
  if (!['operating', 'construction', 'planned'].includes(row.status)) throw new Error(`Unknown status: ${row.id}`)
  if (!['site', 'place', 'kommune'].includes(row.precision)) throw new Error(`Unknown precision: ${row.id}`)
  if (!row.name || !row.operator || !row.kommune || !row.place || !row.power_status) throw new Error(`Missing site metadata: ${row.id}`)
  if (row.operator_orgnr && !/^\d{9}$/.test(row.operator_orgnr)) throw new Error(`Invalid organisation number: ${row.id}`)
  const sources = row.source_urls.split('|').filter(Boolean)
  if (!sources.length || sources.some(source => !/^https?:$/.test(new URL(source).protocol))) throw new Error(`Missing or invalid sources: ${row.id}`)
  let lat = Number(row.lat), lon = Number(row.lon)
  if (!row.lat || !row.lon) {
    if (Boolean(row.lat) !== Boolean(row.lon)) throw new Error(`Incomplete coordinates: ${row.id}`)
    if (row.precision === 'site') throw new Error(`Site precision requires curated coordinates: ${row.id}`)
    const key = `${row.kommune}/${row.place}`
    if (refresh || !geocodes[key]) {
      const response = await fetch(`https://api.kartverket.no/stedsnavn/v1/sted?sok=${encodeURIComponent(row.place)}&treffPerSide=100`, { signal: AbortSignal.timeout(30000) })
      if (!response.ok) throw new Error(`Geocoding ${row.id}: ${response.status}`)
      const result = await response.json()
      const matches = (result.navn ?? []).filter(item => item.kommuner?.some(kommune => kommune.kommunenavn.toLocaleLowerCase('nb-NO') === row.kommune.toLocaleLowerCase('nb-NO')))
      const positions = matches.map(item => item.representasjonspunkt).filter(Boolean)
      const unique = [...new Map(positions.map(point => [`${point.nord},${point.øst}`, point])).values()]
      if (unique.length !== 1) throw new Error(`Ambiguous geocode for ${row.id}; supply coordinates explicitly`)
      geocodes[key] = { lat: unique[0].nord, lon: unique[0].øst }
    }
    ;({ lat, lon } = geocodes[key])
  }
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || lat < 57.5 || lat > 72 || lon < 4 || lon > 32) throw new Error(`Coordinates outside mainland Norway bbox: ${row.id}`)
  const operator = operators.find(item => item.orgnr === row.operator_orgnr)
  sites.push({ ...row, lat, lon, mw_in_use: numeric(row.mw_in_use), mw_reserved: numeric(row.mw_reserved), mw_planned: numeric(row.mw_planned), mw_queued: numeric(row.mw_queued), source_urls: sources, nkomRegistered: Boolean(operator), cryptoMining: operator?.cryptoMining ?? false })
}
await writeFile(new URL('geocode-cache.json', cacheRoot), JSON.stringify(geocodes, null, 2) + '\n')
const atlas = require('world-atlas/countries-50m.json')
const norway = feature(atlas, atlas.objects.countries).features.find(country => String(country.id) === '578')
const polygons = norway.geometry.type === 'MultiPolygon' ? norway.geometry.coordinates : [norway.geometry.coordinates]
const mainland = { type: 'Feature', properties: {}, geometry: { type: 'MultiPolygon', coordinates: polygons.filter(polygon => polygon[0].every(([lon, lat]) => lat <= 72 && lon >= 0)) } }
const projection = geoTransverseMercator().rotate([-15, 0]).fitExtent([[35, 35], [485, 605]], mainland)
for (const site of sites) {
  const [x, y] = projection([site.lon, site.lat])
  site.x = Number(x.toFixed(3))
  site.y = Number(y.toFixed(3))
}
const used = new Set(sites.map(site => site.operator_orgnr))
const totals = JSON.parse(await readFile(new URL('nkom-totals.json', cacheRoot), 'utf8'))
if (!Number.isInteger(totals.registered) || totals.registered < operators.length || totals.commercialOperators !== operators.length || !/^\d{4}-\d{2}-\d{2}$/.test(totals.lastUpdated)) throw new Error('Review the dated Nkom totals snapshot against the current registry')
const metadataPath = new URL('registry-metadata.json', cacheRoot)
let metadata
try { metadata = JSON.parse(await readFile(metadataPath, 'utf8')) } catch (error) { if (error.code !== 'ENOENT') throw error }
const registrySha256 = createHash('sha256').update(nkomCsv).digest('hex')
if (refresh || !metadata || metadata.registrySha256 !== registrySha256) {
  metadata = { lastUpdated: new Date().toISOString(), registrySha256, sourceUrl: nkomUrl }
  await writeFile(metadataPath, JSON.stringify(metadata, null, 2) + '\n')
}
const dataset = {
  generatedAt: metadata.lastUpdated,
  nkom: { registered: totals.registered, commercialOperators: operators.length, lastUpdated: totals.lastUpdated, fetchedAt: metadata.lastUpdated, overviewUrl: totals.sourceUrl, sourceUrl: nkomUrl, registrySha256, operators: enrichedOperators },
  map: { viewBox: '0 0 520 640', outlinePath: geoPath(projection)(mainland), attribution: 'Natural Earth / world-atlas (public domain)' },
  sites,
  unmappedOperators: enrichedOperators.filter(operator => !used.has(operator.orgnr)),
}
await writeFile(new URL('../src/data/datacenters.json', import.meta.url), JSON.stringify(dataset, null, 2) + '\n')
console.log(`${sites.length} sites; ${operators.length} Nkom operators; ${dataset.unmappedOperators.length} unmapped operators`)