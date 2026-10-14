import { parse } from 'csv-parse/sync'

export const SITE_COLUMNS = ['id', 'name', 'operator', 'operator_orgnr', 'kommune', 'place', 'lat', 'lon', 'precision', 'status', 'mw_in_use', 'mw_reserved', 'mw_planned', 'mw_planned_basis', 'mw_queued', 'power_status', 'source_urls', 'source_dates', 'reviewed_at', 'note']
export const SITE_STATUSES = ['operating', 'construction', 'planned']
export const SITE_PRECISIONS = ['site', 'place', 'kommune']
export const PLANNED_BASES = ['it_capacity', 'facility_capacity', 'development_potential', 'announced_total', 'grid_connection']
export const MW_COLUMNS = ['mw_in_use', 'mw_reserved', 'mw_planned', 'mw_queued']
export const NORWAY_BBOX = { minLat: 57.5, maxLat: 72, minLon: 4, maxLon: 32 }

const isoDate = /^\d{4}-\d{2}-\d{2}$/

export function parseMw(value, label) {
  if (value === '') return null
  if (!/^\d+(\.\d+)?$/.test(value)) throw new Error(`Invalid MW in ${label}: "${value}" (use an empty field for unknown)`)
  return Number(value)
}

export function parseIsoDate(value, label) {
  if (value === '') return null
  const parsed = isoDate.test(value) ? new Date(`${value}T00:00:00Z`) : null
  if (!parsed || Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) throw new Error(`Invalid ISO date in ${label}: "${value}"`)
  return value
}

export function withinNorway(lat, lon) {
  return Number.isFinite(lat) && Number.isFinite(lon) && lat >= NORWAY_BBOX.minLat && lat <= NORWAY_BBOX.maxLat && lon >= NORWAY_BBOX.minLon && lon <= NORWAY_BBOX.maxLon
}

export function parseSiteRows(csvText) {
  const records = parse(csvText, { columns: true, skip_empty_lines: true, trim: true, relax_column_count: false })
  if (!records.length) throw new Error('No datacenter rows')
  const headers = Object.keys(records[0])
  const missing = SITE_COLUMNS.filter(column => !headers.includes(column))
  const unexpected = headers.filter(column => !SITE_COLUMNS.includes(column))
  if (missing.length || unexpected.length) throw new Error(`Unexpected datacenter columns; missing: [${missing.join(', ')}] unexpected: [${unexpected.join(', ')}]`)
  const ids = new Set()
  return records.map(row => {
    if (!/^[a-z0-9-]+$/.test(row.id) || ids.has(row.id)) throw new Error(`Invalid or duplicate id: ${row.id}`)
    ids.add(row.id)
    if (!SITE_STATUSES.includes(row.status)) throw new Error(`Unknown status: ${row.id}`)
    if (!SITE_PRECISIONS.includes(row.precision)) throw new Error(`Unknown precision: ${row.id}`)
    for (const column of ['name', 'operator', 'kommune', 'place', 'power_status']) if (!row[column]) throw new Error(`Missing ${column}: ${row.id}`)
    if (row.operator_orgnr && !/^\d{9}$/.test(row.operator_orgnr)) throw new Error(`Invalid organisation number: ${row.id}`)
    const mw = Object.fromEntries(MW_COLUMNS.map(column => [column, parseMw(row[column], `${row.id}.${column}`)]))
    if (mw.mw_planned === null && row.mw_planned_basis) throw new Error(`mw_planned_basis without mw_planned: ${row.id}`)
    if (mw.mw_planned !== null && !PLANNED_BASES.includes(row.mw_planned_basis)) throw new Error(`mw_planned requires mw_planned_basis in [${PLANNED_BASES.join(', ')}]: ${row.id}`)
    const sources = row.source_urls.split('|').filter(Boolean)
    if (!sources.length) throw new Error(`Missing sources: ${row.id}`)
    for (const source of sources) {
      let url
      try { url = new URL(source) } catch { throw new Error(`Invalid source URL: ${row.id}`) }
      if (!/^https?:$/.test(url.protocol)) throw new Error(`Invalid source URL protocol: ${row.id}`)
    }
    const dates = row.source_dates.split('|')
    if (dates.length !== sources.length) throw new Error(`source_dates must have one entry per source URL (empty for undated pages): ${row.id}`)
    const sourceDates = dates.map((date, index) => parseIsoDate(date, `${row.id}.source_dates[${index}]`))
    const reviewedAt = parseIsoDate(row.reviewed_at, `${row.id}.reviewed_at`)
    if (Boolean(row.lat) !== Boolean(row.lon)) throw new Error(`Incomplete coordinates: ${row.id}`)
    let lat = null, lon = null
    if (row.lat) {
      lat = Number(row.lat)
      lon = Number(row.lon)
      if (!withinNorway(lat, lon)) throw new Error(`Coordinates outside mainland Norway bbox: ${row.id}`)
    } else if (row.precision === 'site') throw new Error(`Site precision requires curated coordinates: ${row.id}`)
    return { ...row, lat, lon, ...mw, mw_planned_basis: row.mw_planned_basis || null, source_urls: sources, source_dates: sourceDates, reviewed_at: reviewedAt }
  })
}
