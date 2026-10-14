export type SiteStatus = 'operating' | 'construction' | 'planned'
export type DataCenter = {
  id: string
  name: string
  operator: string
  operator_orgnr: string
  kommune: string
  place: string
  lat: number
  lon: number
  precision: string
  status: SiteStatus
  mw_in_use: number | null
  mw_reserved: number | null
  mw_planned: number | null
  mw_queued: number | null
  power_status: string
  source_urls: string[]
  note: string
  x: number
  y: number
  nkomRegistered: boolean
  cryptoMining: boolean
}

export const statusLabels: Record<SiteStatus, string> = {
  operating: 'I drift', construction: 'Under bygging', planned: 'Planlagt',
}

export function maxMw(site: Pick<DataCenter, 'mw_in_use' | 'mw_reserved' | 'mw_planned'>): number | null {
  const values = [site.mw_in_use, site.mw_reserved, site.mw_planned].filter((value): value is number => value !== null)
  return values.length ? Math.max(...values) : null
}

export function markerRadius(mw: number | null, maximum: number, maxRadius = 28): number {
  if (mw === null) return 3
  if (mw <= 0 || maximum <= 0) return 0
  return Math.sqrt(mw / maximum) * maxRadius
}

export function byMwDesc<Site extends Pick<DataCenter, 'name' | 'mw_in_use' | 'mw_reserved' | 'mw_planned'>>(sites: readonly Site[]): Site[] {
  return [...sites].sort((left, right) => (maxMw(right) ?? -1) - (maxMw(left) ?? -1) || left.name.localeCompare(right.name, 'nb-NO'))
}