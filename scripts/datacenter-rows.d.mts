export type SiteRowInput = Record<string, string>

export type ParsedSiteRow = {
  id: string
  name: string
  operator: string
  operator_orgnr: string
  kommune: string
  place: string
  lat: number | null
  lon: number | null
  precision: string
  status: string
  mw_in_use: number | null
  mw_reserved: number | null
  mw_planned: number | null
  mw_planned_basis: string | null
  mw_queued: number | null
  power_status: string
  source_urls: string[]
  source_dates: (string | null)[]
  reviewed_at: string | null
  note: string
}

export const SITE_COLUMNS: readonly string[]
export const SITE_STATUSES: readonly string[]
export const SITE_PRECISIONS: readonly string[]
export const PLANNED_BASES: readonly string[]
export const MW_COLUMNS: readonly string[]
export const NORWAY_BBOX: { minLat: number, maxLat: number, minLon: number, maxLon: number }

export function parseMw(value: string, label: string): number | null
export function parseIsoDate(value: string, label: string): string | null
export function withinNorway(lat: number, lon: number): boolean
export function parseSiteRows(csvText: string): ParsedSiteRow[]
