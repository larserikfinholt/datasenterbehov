export interface Occupation {
  code: string
  title: string
  fte: number | null
  factor: number | null
}

export const SOURCE_REPO = 'https://github.com/larserikfinholt/DatacenterNeed'
export const SOURCE_COMMIT = '9a6f7d727af24171593f15bde34c078bfacd08ad'
export const HIGH_SCENARIO = { adoption: 0.8, annualHours: 1725 } as const
export const CAPACITY_SCENARIO = {
  status: 'Foreløpige scenariotall, ikke kildebelagte prosjektdata',
  existing: 500,
  committed: 700,
  planned: 1100,
} as const

export const REFERENCE_ASSUMPTIONS = {
  h100: { gpuCount: 8, gpuWatts: 700, hostWatts: 800, activeUsers: 10 },
  mac: { deviceWatts: 200, activeUsers: 1 },
} as const

export type ReferenceMethod = 'h100' | 'mac' | 'fixed'

export function referenceWatts(method: ReferenceMethod, fixed = 640): number {
  const { h100, mac } = REFERENCE_ASSUMPTIONS
  const watts = method === 'h100'
    ? (h100.gpuCount * h100.gpuWatts + h100.hostWatts) / h100.activeUsers
    : method === 'mac' ? mac.deviceWatts / mac.activeUsers : fixed
  if (!Number.isFinite(watts) || watts < 0) throw new Error('Ugyldig wattverdi')
  return watts
}

export function weightedFactor(rows: readonly Occupation[]): number | null {
  const assessed = rows.filter(row => row.factor !== null && row.fte !== null)
  const fte = assessed.reduce((total, row) => total + row.fte!, 0)
  return fte === 0 ? null : assessed.reduce((total, row) => total + row.fte! * row.factor!, 0) / fte
}

export function occupationEstimate(row: Occupation, fallback: number | null, watts: number, adoption: number = HIGH_SCENARIO.adoption) {
  if (!Number.isFinite(watts) || watts < 0 || !Number.isFinite(adoption) || adoption < 0 || adoption > 1) {
    throw new Error('Ugyldige scenarioverdier')
  }
  const factor = row.factor ?? fallback
  return {
    ...row,
    effectiveFactor: factor,
    interpolated: row.factor === null && factor !== null,
    mw: row.fte === null || factor === null ? null : row.fte * factor * adoption * watts / 1e6,
  }
}

export function workforceEstimate(rows: readonly Occupation[], watts: number, adoption: number = HIGH_SCENARIO.adoption) {
  const fallback = weightedFactor(rows)
  const estimates = rows.map(row => occupationEstimate(row, fallback, watts, adoption))
  const available = estimates.filter(row => row.mw !== null)
  return { fallback, rows: estimates, mw: available.length ? available.reduce((total, row) => total + row.mw!, 0) : null }
}

export function ssbOrder(rows: readonly Occupation[]): Occupation[] {
  return [...rows.filter(row => row.fte !== null), ...rows.filter(row => row.fte === null)]
}