import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { MW_COLUMNS, PLANNED_BASES, SITE_COLUMNS, parseIsoDate, parseMw, parseSiteRows } from '../scripts/datacenter-rows.mjs'
import { maxMw, type DataCenter } from './datacenters'
import dataset from './data/datacenters.json'

type Row = Record<string, string>
const sites = dataset.sites as DataCenter[]
// Same formula as scripts/prepare-datacenters.mjs: line endings normalised so autocrlf checkouts are not reported stale.
const sha256 = (text: string) => createHash('sha256').update(text.replace(/\r\n?/g, '\n')).digest('hex')
const isoDate = /^\d{4}-\d{2}-\d{2}$/

const validRow: Row = {
  id: 'test-site', name: 'Test', operator: 'Operator', operator_orgnr: '', kommune: 'Skien', place: 'Gromstul', lat: '59.288', lon: '9.571',
  precision: 'place', status: 'planned', mw_in_use: '', mw_reserved: '', mw_planned: '', mw_planned_basis: '', mw_queued: '',
  power_status: 'Ukjent', source_urls: 'https://example.com/a', source_dates: '', reviewed_at: '', note: 'Testrad',
}

function csv(rows: readonly Row[], columns: readonly string[] = SITE_COLUMNS) {
  const quote = (value: string) => /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value
  return [columns.join(','), ...rows.map(row => columns.map(column => quote(row[column] ?? '')).join(','))].join('\n')
}

const parseOne = (overrides: Row = {}) => parseSiteRows(csv([{ ...validRow, ...overrides }]))[0]

describe('parseSiteRows', () => {
  it('accepts a minimal valid row and preserves empty MW as null', () => {
    const row = parseOne()
    expect(row).toMatchObject({ id: 'test-site', lat: 59.288, lon: 9.571, mw_in_use: null, mw_reserved: null, mw_planned: null, mw_planned_basis: null, mw_queued: null, source_urls: ['https://example.com/a'], source_dates: [null], reviewed_at: null })
    expect(parseOne({ mw_queued: '0' }).mw_queued).toBe(0)
    expect(parseOne({ mw_in_use: '12.5' }).mw_in_use).toBe(12.5)
  })

  it('rejects missing and unexpected columns', () => {
    expect(() => parseSiteRows(csv([validRow], SITE_COLUMNS.filter(column => column !== 'note')))).toThrow(/missing: \[note\]/)
    expect(() => parseSiteRows(csv([{ ...validRow, extra: 'x' }], [...SITE_COLUMNS, 'extra']))).toThrow(/unexpected: \[extra\]/)
    expect(() => parseSiteRows('')).toThrow(/No datacenter rows/)
  })

  it('requires mw_planned and mw_planned_basis together, with a known basis', () => {
    expect(() => parseOne({ mw_planned: '40' })).toThrow(/mw_planned requires mw_planned_basis/)
    expect(() => parseOne({ mw_planned_basis: 'it_capacity' })).toThrow(/mw_planned_basis without mw_planned/)
    expect(() => parseOne({ mw_planned: '40', mw_planned_basis: 'guess' })).toThrow(/mw_planned requires mw_planned_basis/)
    for (const basis of PLANNED_BASES) expect(parseOne({ mw_planned: '40', mw_planned_basis: basis }).mw_planned_basis).toBe(basis)
  })

  it('rejects negative, non-numeric and malformed MW in every MW column', () => {
    for (const column of MW_COLUMNS) {
      expect(() => parseOne({ [column]: '-1' })).toThrow(/Invalid MW/)
      expect(() => parseOne({ [column]: 'abc' })).toThrow(/Invalid MW/)
      expect(() => parseOne({ [column]: '1e3' })).toThrow(/Invalid MW/)
    }
    expect(parseMw('', 'x')).toBeNull()
    expect(parseMw('0', 'x')).toBe(0)
    expect(() => parseMw('NaN', 'x')).toThrow(/Invalid MW/)
  })

  it('requires one source date per source URL and valid ISO dates', () => {
    const two = 'https://example.com/a|https://example.com/b'
    expect(() => parseOne({ source_urls: two, source_dates: '' })).toThrow(/one entry per source URL/)
    expect(() => parseOne({ source_urls: two, source_dates: '2026-05-12' })).toThrow(/one entry per source URL/)
    expect(parseOne({ source_urls: two, source_dates: '2026-05-12|' }).source_dates).toEqual(['2026-05-12', null])
    expect(parseOne({ source_urls: two, source_dates: '|' }).source_dates).toEqual([null, null])
    expect(() => parseOne({ source_dates: '2026-13-01' })).toThrow(/Invalid ISO date/)
    expect(() => parseOne({ source_dates: '2026-02-30' })).toThrow(/Invalid ISO date/)
    expect(() => parseOne({ source_dates: '12.05.2026' })).toThrow(/Invalid ISO date/)
    expect(() => parseOne({ reviewed_at: '2026-10-14T00:00:00Z' })).toThrow(/Invalid ISO date/)
    expect(parseOne({ reviewed_at: '2026-10-14' }).reviewed_at).toBe('2026-10-14')
    expect(parseIsoDate('', 'x')).toBeNull()
  })

  it('rejects invalid source URLs and missing sources', () => {
    expect(() => parseOne({ source_urls: 'not a url' })).toThrow(/Invalid source URL/)
    expect(() => parseOne({ source_urls: 'ftp://example.com/a' })).toThrow(/Invalid source URL protocol/)
    expect(() => parseOne({ source_urls: '' })).toThrow(/Missing sources/)
  })

  it('rejects half coordinate pairs, out-of-bbox points and sites without coordinates', () => {
    expect(() => parseOne({ lon: '' })).toThrow(/Incomplete coordinates/)
    expect(() => parseOne({ lat: '' })).toThrow(/Incomplete coordinates/)
    expect(() => parseOne({ lat: '48.8', lon: '2.3' })).toThrow(/outside mainland Norway/)
    expect(() => parseOne({ lat: '', lon: '', precision: 'site' })).toThrow(/Site precision requires curated coordinates/)
    expect(parseOne({ lat: '', lon: '' })).toMatchObject({ lat: null, lon: null })
  })

  it('rejects duplicate or malformed ids, unknown enums and bad organisation numbers', () => {
    expect(() => parseSiteRows(csv([validRow, validRow]))).toThrow(/duplicate id/)
    expect(() => parseOne({ id: 'Bad_Id' })).toThrow(/Invalid or duplicate id/)
    expect(() => parseOne({ status: 'demolished' })).toThrow(/Unknown status/)
    expect(() => parseOne({ precision: 'exact' })).toThrow(/Unknown precision/)
    expect(() => parseOne({ operator_orgnr: '12345' })).toThrow(/Invalid organisation number/)
    expect(() => parseOne({ power_status: '' })).toThrow(/Missing power_status/)
  })
})

describe('curated CSV and generated dataset', () => {
  const csvText = readFileSync(new URL('../data/datacenters.csv', import.meta.url), 'utf8')

  it('parses the checked-in CSV into exactly the bundled sites', () => {
    const rows = parseSiteRows(csvText)
    expect(rows.map((row: { id: string }) => row.id)).toEqual(sites.map(site => site.id))
    for (const row of rows) {
      const site = sites.find(site => site.id === row.id)!
      expect(site).toMatchObject({ mw_in_use: row.mw_in_use, mw_reserved: row.mw_reserved, mw_planned: row.mw_planned, mw_planned_basis: row.mw_planned_basis, mw_queued: row.mw_queued, source_dates: row.source_dates, reviewed_at: row.reviewed_at })
    }
  })

  it('keeps provenance dates, planned basis and review markers consistent per site', () => {
    for (const site of sites) {
      expect(site.source_dates).toHaveLength(site.source_urls.length)
      for (const date of site.source_dates) if (date !== null) expect(date).toMatch(isoDate)
      if (site.reviewed_at !== null) expect(site.reviewed_at).toMatch(isoDate)
      expect(site.mw_planned !== null).toBe(site.mw_planned_basis !== null)
      if (site.mw_planned_basis !== null) expect(PLANNED_BASES).toContain(site.mw_planned_basis)
    }
    expect(sites.find(site => site.id === 'gm-hamar')).toMatchObject({ mw_reserved: null, mw_planned: 150, mw_planned_basis: 'it_capacity', reviewed_at: '2026-10-14' })
    for (const id of ['tydal', 'bulk-n01', 'bulk-osix']) expect(sites.find(site => site.id === id)?.reviewed_at).toBeNull()
    expect(sites.filter(site => site.reviewed_at === '2026-10-14').length).toBeGreaterThanOrEqual(15)
    expect(sites.find(site => site.id === 'polar-heroya')).toMatchObject({ source_dates: ['2026-05-12', null], mw_planned: 40, mw_planned_basis: 'it_capacity' })
  })

  it('never adds overlapping reservation, queue and total figures', () => {
    const fyresdal = sites.find(site => site.id === 'edgeconnex-fyresdal')!
    expect(fyresdal).toMatchObject({ mw_reserved: 140, mw_queued: 225, mw_planned: 365, mw_planned_basis: 'grid_connection' })
    expect(maxMw(fyresdal)).toBe(365)
    expect(maxMw(fyresdal)).not.toBe(730)
    const gromstul = sites.find(site => site.id === 'google-skien')!
    expect(maxMw(gromstul)).toBe(240)
    for (const site of sites) {
      const parts = [site.mw_in_use, site.mw_reserved, site.mw_planned].filter((value): value is number => value !== null)
      expect(maxMw(site)).toBe(parts.length ? Math.max(...parts) : null)
    }
  })

  it('records Telemark research leads as queued applications, not capacity', () => {
    for (const id of ['nscale-bolvik', 'nscale-gromstul']) {
      const site = sites.find(site => site.id === id)!
      expect(site).toMatchObject({ status: 'planned', kommune: 'Skien', mw_in_use: null, mw_reserved: null, mw_planned: null })
      expect(site.mw_queued).toBeGreaterThan(0)
      expect(maxMw(site)).toBeNull()
    }
    const neighbour = sites.find(site => site.id === 'nscale-gromstul')!
    const google = sites.find(site => site.id === 'google-skien')!
    expect([neighbour.lat, neighbour.lon]).toEqual([google.lat, google.lon])
    expect(neighbour.note).toContain('redaksjonell tolkning')
  })
})

describe('stale detection', () => {
  it('matches every recorded input hash against the file on disk', () => {
    const inputs = dataset.provenance.inputs as Record<string, string>
    expect(Object.keys(inputs)).toEqual(['data/datacenters.csv', 'data/sources/nkom-operatorer.csv', 'data/sources/brreg-enheter.json', 'data/sources/nkom-totals.json', 'data/sources/geocode-cache.json'])
    for (const [name, hash] of Object.entries(inputs)) {
      expect(sha256(readFileSync(new URL(`../${name}`, import.meta.url), 'utf8')), name).toBe(hash)
    }
    expect(dataset.provenance.inputsSha256).toBe(sha256(Object.entries(inputs).map(([name, hash]) => `${name}:${hash}`).join('\n')))
    const metadata = JSON.parse(readFileSync(new URL('../data/sources/registry-metadata.json', import.meta.url), 'utf8'))
    expect(metadata).toMatchObject({ inputsSha256: dataset.provenance.inputsSha256, generatedAt: dataset.provenance.generatedAt, registryFetchedAt: dataset.provenance.nkomFetchedAt })
    expect(dataset.generatedAt).toBe(dataset.provenance.generatedAt)
    expect(dataset.nkom.fetchedAt).toBe(dataset.provenance.nkomFetchedAt)
    expect(Date.parse(dataset.provenance.generatedAt)).toBeGreaterThanOrEqual(Date.parse(dataset.provenance.nkomFetchedAt))
  })

  it('passes the offline --check run of the pipeline', () => {
    const script = fileURLToPath(new URL('../scripts/prepare-datacenters.mjs', import.meta.url))
    const output = execFileSync(process.execPath, [script, '--check'], { encoding: 'utf8', timeout: 60000 })
    expect(output).toMatch(/^OK: src\/data\/datacenters\.json matches 5 inputs \(\d+ sites\)/)
  })
})
