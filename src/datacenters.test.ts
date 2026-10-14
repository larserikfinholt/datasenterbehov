import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { parse } from 'csv-parse/sync'
import { byMwDesc, markerRadius, maxMw } from './datacenters'
import dataset from './data/datacenters.json'

describe('datacenter MW model', () => {
  it('uses the largest documented quantity without adding unlike MW figures', () => {
    expect(maxMw({ mw_in_use: 10, mw_reserved: 100, mw_planned: 50 })).toBe(100)
    expect(maxMw({ mw_in_use: null, mw_reserved: null, mw_planned: null })).toBeNull()
  })

  it('scales area proportionally and keeps unknown distinct from zero', () => {
    expect(markerRadius(100, 400)).toBe(markerRadius(400, 400) / 2)
    expect(markerRadius(10, 400)).toBeLessThan(markerRadius(100, 400))
    expect(markerRadius(null, 400)).toBe(3)
    expect(markerRadius(0, 400)).toBe(0)
    expect(markerRadius(10, 0)).toBe(0)
  })

  it('sorts descending with unknown last without mutating the input', () => {
    const sites = [10, null, 100].map((mw, index) => ({ name: String(index), mw_in_use: mw, mw_reserved: null, mw_planned: null }))
    expect(byMwDesc(sites).map(site => site.mw_in_use)).toEqual([100, 10, null])
    expect(sites[0].mw_in_use).toBe(10)
  })

  it('excludes queued MW from sizing and sorting, even for otherwise unknown capacity', () => {
    const allocated = { name: 'Allocated', mw_in_use: null, mw_reserved: 240, mw_planned: null, mw_queued: 840 }
    const planned = { ...allocated, name: 'Planned', mw_reserved: null, mw_planned: 365, mw_queued: 225 }
    const unknown = { ...allocated, name: 'Unknown', mw_reserved: null, mw_queued: 1000 }
    expect(maxMw(allocated)).toBe(240)
    expect(maxMw(planned)).toBe(365)
    expect(maxMw(unknown)).toBeNull()
    expect(markerRadius(maxMw(unknown), 520)).toBe(3)
    expect(byMwDesc([unknown, allocated, planned]).map(site => site.name)).toEqual(['Planned', 'Allocated', 'Unknown'])
  })
})

describe('bundled datacenter dataset', () => {
  it('keeps the documented Gromstul reservation distinct from actual consumption', () => {
    const site = dataset.sites.find(site => site.id === 'google-skien')
    expect(site).toBeDefined()
    expect(site).toMatchObject({ status: 'construction', mw_reserved: 240, mw_queued: 840, mw_planned: null, mw_in_use: null })
    expect(maxMw(site!)).toBe(240)
    expect(site?.note).toContain('NRK 20.04.2025')
    expect(site?.note).toContain('uavklart om de 240 MW tildelt inngår eller kommer i tillegg')
    expect(site?.note).toContain('ikke verifisert som dagens Statnett-kø')
    expect(site?.source_urls).toContain('https://www.nrk.no/vestfoldogtelemark/frykter-datasentre-med-google-i-spissen-vil-sluke-all-strom-i-grenland-1.17374873')
    expect(dataset.sites.filter(site => site.id === 'google-skien')).toHaveLength(1)
  })

  it('includes sourced Telemark plans without adding reservations to campus totals', () => {
    const frier = dataset.sites.find(site => site.id === 'bw-frier-vest')
    expect(frier).toMatchObject({ kommune: 'Bamble', status: 'planned', mw_reserved: null, mw_planned: 250, mw_in_use: null })
    const fyresdal = dataset.sites.find(site => site.id === 'edgeconnex-fyresdal')
    expect(fyresdal).toMatchObject({ kommune: 'Fyresdal', status: 'construction', mw_reserved: 140, mw_planned: 365, mw_queued: 225, mw_in_use: null })
    expect(maxMw(fyresdal!)).toBe(365)
    expect(fyresdal?.power_status).toContain('225 MW i kapasitetskø')
    expect(fyresdal?.power_status).toContain('inngår i totalen')
    expect(dataset.sites.filter(site => site.id === 'edgeconnex-fyresdal')).toHaveLength(1)
  })

  it('generates numeric queued MW from the curated CSV and preserves empty fields as null', () => {
    const rows = parse(readFileSync(new URL('../data/datacenters.csv', import.meta.url), 'utf8'), { columns: true, skip_empty_lines: true, trim: true }) as { id: string, mw_queued: string }[]
    expect(rows).toHaveLength(dataset.sites.length)
    expect(rows.filter(row => row.mw_queued === '').length).toBeGreaterThan(0)
    for (const row of rows) {
      expect(dataset.sites.find(site => site.id === row.id)?.mw_queued).toBe(row.mw_queued === '' ? null : Number(row.mw_queued))
    }
  })

  it('contains unique, sourced mainland sites and valid projected coordinates', () => {
    expect(dataset.sites.length).toBeGreaterThanOrEqual(15)
    expect(new Set(dataset.sites.map(site => site.id)).size).toBe(dataset.sites.length)
    expect(dataset.map.outlinePath.startsWith('M')).toBe(true)
    expect(dataset.map.outlinePath).not.toMatch(/NaN|Infinity/)
    for (const site of dataset.sites) {
      expect(site.lat).toBeGreaterThanOrEqual(57.5)
      expect(site.lat).toBeLessThanOrEqual(72)
      expect(site.lon).toBeGreaterThanOrEqual(4)
      expect(site.lon).toBeLessThanOrEqual(32)
      expect(site.x).toBeGreaterThan(0)
      expect(site.x).toBeLessThan(520)
      expect(site.y).toBeGreaterThan(0)
      expect(site.y).toBeLessThan(640)
      expect(['operating', 'construction', 'planned']).toContain(site.status)
      expect(['site', 'place', 'kommune']).toContain(site.precision)
      expect(site.source_urls.length).toBeGreaterThan(0)
      for (const source of site.source_urls) expect(new URL(source).protocol).toBe('https:')
      for (const value of [site.mw_in_use, site.mw_reserved, site.mw_planned, site.mw_queued]) {
        if (value !== null) { expect(Number.isFinite(value)).toBe(true); expect(value).toBeGreaterThanOrEqual(0) }
      }
      if (site.nkomRegistered) expect(dataset.nkom.operators.map(operator => operator.orgnr)).toContain(site.operator_orgnr)
    }
  })

  it('partitions registered operators without plotting their business addresses', () => {
    const mapped = new Set(dataset.sites.filter(site => site.nkomRegistered).map(site => site.operator_orgnr))
    expect(mapped.size + dataset.unmappedOperators.length).toBe(dataset.nkom.commercialOperators)
    for (const operator of dataset.unmappedOperators) expect(mapped.has(operator.orgnr)).toBe(false)
  })
})