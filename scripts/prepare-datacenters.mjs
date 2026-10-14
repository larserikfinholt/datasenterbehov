import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { createRequire } from 'node:module'
import { parse } from 'csv-parse/sync'
import { geoPath, geoTransverseMercator } from 'd3-geo'
import { feature } from 'topojson-client'
import { parseSiteRows, withinNorway } from './datacenter-rows.mjs'

const require = createRequire(import.meta.url)
const refresh = process.argv.includes('--refresh')
const check = process.argv.includes('--check')
const offline = check || process.argv.includes('--offline')
if (refresh && offline) throw new Error('--refresh cannot be combined with --offline or --check')
const cacheRoot = new URL('../data/sources/', import.meta.url)
const csvPath = new URL('../data/datacenters.csv', import.meta.url)
const outputPath = new URL('../src/data/datacenters.json', import.meta.url)
const nkomUrl = 'https://stenonicprdnoea01.blob.core.windows.net/enonicpubliccontainer/prd/tildeling/datasenter/datasenter-operatorer.csv'
const sha256 = text => createHash('sha256').update(text).digest('hex')
await mkdir(cacheRoot, { recursive: true })

async function fetchText(url) {
  if (offline) throw new Error(`Network access required for ${url} but --offline was given`)
  const response = await fetch(url, { signal: AbortSignal.timeout(30000) })
  if (!response.ok) throw new Error(`${url}: ${response.status}`)
  return response
}

async function cached(name, url) {
  const path = new URL(name, cacheRoot)
  if (!refresh) {
    try {
      const text = await readFile(path, 'utf8')
      if (!text.includes('\u0000')) return text
    } catch (error) { if (error.code !== 'ENOENT') throw error }
  }
  const response = await fetchText(url)
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
const brregJson = await cached('brreg-enheter.json', `https://data.brreg.no/enhetsregisteret/api/enheter?organisasjonsnummer=${operators.map(row => row.orgnr).join(',')}&size=2000`)
const brreg = JSON.parse(brregJson)
const businesses = new Map((brreg._embedded?.enheter ?? []).map(row => [row.organisasjonsnummer, row.forretningsadresse ?? {}]))
const enrichedOperators = operators.map(row => ({ ...row, businessKommune: businesses.get(row.orgnr)?.kommune ?? null, kommunenummer: businesses.get(row.orgnr)?.kommunenummer ?? null }))
const geocodePath = new URL('geocode-cache.json', cacheRoot)
let geocodes = {}
try { geocodes = JSON.parse(await readFile(geocodePath, 'utf8')) } catch (error) { if (error.code !== 'ENOENT') throw error }
const csv = await readFile(csvPath, 'utf8')
const sites = []
let geocodesChanged = false
for (const row of parseSiteRows(csv)) {
  let { lat, lon } = row
  if (lat === null) {
    const key = `${row.kommune}/${row.place}`
    if (refresh || !geocodes[key]) {
      const response = await fetchText(`https://api.kartverket.no/stedsnavn/v1/sted?sok=${encodeURIComponent(row.place)}&treffPerSide=100`)
      const result = await response.json()
      const matches = (result.navn ?? []).filter(item => item.kommuner?.some(kommune => kommune.kommunenavn.toLocaleLowerCase('nb-NO') === row.kommune.toLocaleLowerCase('nb-NO')))
      const positions = matches.map(item => item.representasjonspunkt).filter(Boolean)
      const unique = [...new Map(positions.map(point => [`${point.nord},${point.øst}`, point])).values()]
      if (unique.length !== 1) throw new Error(`Ambiguous geocode for ${row.id}; supply coordinates explicitly`)
      geocodes[key] = { lat: unique[0].nord, lon: unique[0].øst }
      geocodesChanged = true
    }
    ;({ lat, lon } = geocodes[key])
    if (!withinNorway(lat, lon)) throw new Error(`Geocoded coordinates outside mainland Norway bbox: ${row.id}`)
  }
  const operator = operators.find(item => item.orgnr === row.operator_orgnr)
  sites.push({ ...row, lat, lon, nkomRegistered: Boolean(operator), cryptoMining: operator?.cryptoMining ?? false })
}
let geocodeJson = await readFile(geocodePath, 'utf8').catch(() => '')
if (geocodesChanged) {
  geocodeJson = JSON.stringify(geocodes, null, 2) + '\n'
  await writeFile(geocodePath, geocodeJson)
}
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
const totalsJson = await readFile(new URL('nkom-totals.json', cacheRoot), 'utf8')
const totals = JSON.parse(totalsJson)
if (!Number.isInteger(totals.registered) || totals.registered < operators.length || totals.commercialOperators !== operators.length || !/^\d{4}-\d{2}-\d{2}$/.test(totals.lastUpdated)) throw new Error('Review the dated Nkom totals snapshot against the current registry')
const inputs = {
  'data/datacenters.csv': sha256(csv),
  'data/sources/nkom-operatorer.csv': sha256(nkomCsv),
  'data/sources/brreg-enheter.json': sha256(brregJson),
  'data/sources/nkom-totals.json': sha256(totalsJson),
  'data/sources/geocode-cache.json': sha256(geocodeJson),
}
const inputsSha256 = sha256(Object.entries(inputs).map(([name, hash]) => `${name}:${hash}`).join('\n'))
const metadataPath = new URL('registry-metadata.json', cacheRoot)
let metadata = {}
try { metadata = JSON.parse(await readFile(metadataPath, 'utf8')) } catch (error) { if (error.code !== 'ENOENT') throw error }
const registrySha256 = inputs['data/sources/nkom-operatorer.csv']
const now = new Date().toISOString()
const next = {
  registryFetchedAt: refresh || metadata.registrySha256 !== registrySha256 ? now : metadata.registryFetchedAt ?? metadata.lastUpdated,
  registrySha256,
  sourceUrl: nkomUrl,
  inputsSha256,
  generatedAt: metadata.inputsSha256 === inputsSha256 && metadata.generatedAt ? metadata.generatedAt : now,
}
if (JSON.stringify(next) !== JSON.stringify(metadata)) {
  if (check) throw new Error('Checked-in datacenter data is stale: inputs changed since src/data/datacenters.json was generated. Run npm run data:datacenters')
  await writeFile(metadataPath, JSON.stringify(next, null, 2) + '\n')
}
const dataset = {
  generatedAt: next.generatedAt,
  provenance: {
    generatedAt: next.generatedAt,
    nkomFetchedAt: next.registryFetchedAt,
    inputsSha256,
    inputs,
    note: 'generatedAt er tidspunktet for siste endring i inndataene (CSV, Nkom-, Brønnøysund-, totals- og geokodecache). Den sier ikke at kapasitetstall er verifisert; se source_dates og reviewed_at per anlegg.',
  },
  nkom: { registered: totals.registered, commercialOperators: operators.length, lastUpdated: totals.lastUpdated, fetchedAt: next.registryFetchedAt, overviewUrl: totals.sourceUrl, sourceUrl: nkomUrl, registrySha256, operators: enrichedOperators },
  map: { viewBox: '0 0 520 640', outlinePath: geoPath(projection)(mainland), attribution: 'Natural Earth / world-atlas (public domain)' },
  sites,
  unmappedOperators: enrichedOperators.filter(operator => !used.has(operator.orgnr)),
}
const output = JSON.stringify(dataset, null, 2) + '\n'
if (check) {
  const current = await readFile(outputPath, 'utf8').catch(() => '')
  if (current !== output) throw new Error('Checked-in src/data/datacenters.json does not match its inputs. Run npm run data:datacenters')
  console.log(`OK: src/data/datacenters.json matches ${Object.keys(inputs).length} inputs (${sites.length} sites)`)
} else {
  await writeFile(outputPath, output)
  console.log(`${sites.length} sites; ${operators.length} Nkom operators; ${dataset.unmappedOperators.length} unmapped operators`)
}