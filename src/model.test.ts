import { describe, expect, it } from 'vitest'
import { parse } from 'csv-parse/sync'
import sourceCsv from '../data/workforce.csv?raw'
import occupations from '../public/data/occupations.json'
import summary from './data/summary.json'
import { occupationEstimate, referenceWatts, ssbOrder, weightedFactor, workforceEstimate, type Occupation } from './model'

const rows: Occupation[] = [
  { code: '0001', title: 'Referanse', fte: 10, factor: 1 },
  { code: '0002', title: 'Fysisk', fte: 90, factor: 0.03 },
  { code: '0003', title: 'Ukjent faktor', fte: 100, factor: null },
  { code: '0004', title: 'Ukjent årsverk', fte: null, factor: null },
]

describe('reference methods', () => {
  it('divides H100 node power between active users', () => expect(referenceWatts('h100')).toBe(640))
  it('uses a local Mac power assumption', () => expect(referenceWatts('mac')).toBe(200))
  it('accepts explicit fixed power, including zero', () => {
    expect(referenceWatts('fixed', 125)).toBe(125)
    expect(referenceWatts('fixed', 0)).toBe(0)
  })
  it('rejects negative and non-finite values', () => {
    for (const value of [-1, NaN, Infinity]) expect(() => referenceWatts('fixed', value)).toThrow()
  })
})

describe('weighted interpolation', () => {
  it('weights assessed factors by FTE, not by occupation count', () => {
    expect(weightedFactor(rows)).toBeCloseTo(0.127)
    const estimate = workforceEstimate(rows, 640)
    expect(estimate.rows[2]).toMatchObject({ interpolated: true, effectiveFactor: 0.127 })
    expect(estimate.rows[2]!.mw).toBeGreaterThan(0)
    expect(estimate.rows[0]!.effectiveFactor).toBe(1)
    expect(estimate.rows[3]!.mw).toBeNull()
  })
  it('preserves unknown when no weighted reference exists', () => {
    expect(workforceEstimate([rows[2]!], 640).mw).toBeNull()
    expect(weightedFactor([{ ...rows[0]!, fte: 0 }])).toBeNull()
  })
  it('distinguishes observed zero from missing FTE', () => {
    expect(occupationEstimate({ ...rows[0]!, fte: 0 }, 0.127, 640).mw).toBe(0)
    expect(ssbOrder([rows[3]!, rows[0]!, rows[2]!]).map(row => row.code)).toEqual(['0001', '0003', '0004'])
  })
  it('rejects invalid adoption', () => expect(() => workforceEstimate(rows, 640, 1.1)).toThrow())
})

describe('pinned SSB dataset and default scenario', () => {
  it('reproduces approximately 310 MW without a hardcoded total', () => {
    const result = workforceEstimate(occupations, referenceWatts('h100'))
    expect(result.mw).toBeCloseTo(309.7976166, 5)
    expect(Math.round(result.mw!)).toBe(310)
    expect(result.fallback).toBeCloseTo(0.2454626993, 10)
    expect(summary.equivalentsBeforeAdoption * 0.8 * 640 / 1e6).toBeCloseTo(result.mw!, 10)
  })
  it('contains all 407 unique source codes and preserves source order and missing data', () => {
    const source = parse<Record<string, string>>(sourceCsv, { columns: true, skip_empty_lines: true })
    expect(occupations).toHaveLength(407)
    expect(new Set(occupations.map(row => row.code)).size).toBe(407)
    expect(occupations.map(row => row.code)).toEqual(source.map((row: Record<string, string>) => row.styrk08_code))
    for (const [index, row] of occupations.entries()) {
      const original = source[index]
      const quarters = ['fte_2025q1', 'fte_2025q2', 'fte_2025q3', 'fte_2025q4'].map(key => original[key])
      const expected = quarters.some(value => value === '') ? null : quarters.reduce((total, value) => total + Number(value), 0) / 4
      expect(row.fte).toBe(expected)
      expect(row.factor).toBe(original.occupation_factor_base === '' ? null : Number(original.occupation_factor_base))
    }
    expect(occupations.filter(row => row.fte === null)).toHaveLength(14)
    expect(occupations.filter(row => row.factor !== null)).toHaveLength(22)
    expect(occupations.find(row => row.code === '2512')!.factor).toBe(1)
    expect(occupations.find(row => row.code === '6113')!.factor).toBe(0.03)
  })
  it('the small example table accounts for the entire known total', () => {
    const total = summary.examples.reduce((sum, row) => sum + occupationEstimate(row, summary.fallback, 640).mw!, 0)
    expect(total).toBeCloseTo(workforceEstimate(occupations, 640).mw!, 10)
    expect(summary.examples.reduce((sum, row) => sum + row.fte, 0)).toBe(summary.knownFte)
  })
})