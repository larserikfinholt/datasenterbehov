import type { DataCenter } from './datacenters'

/** Kategorier i den oppsummerte stolpen, fra fastest (nederst) til løsest (øverst). */
export const buildupCategories = ['in_use', 'reserved', 'queued', 'planned'] as const
export type BuildupCategory = typeof buildupCategories[number]
export type BuildupSegments = Record<BuildupCategory, number>

export const buildupLabels: Record<BuildupCategory, string> = {
  in_use: 'I bruk',
  reserved: 'Nettreservasjon',
  queued: 'Omsøkt / ikke tildelt',
  planned: 'Planlagt / kapasitet',
}

export type BuildupStep<Site> = { site: Site, segments: BuildupSegments, siteTotal: number, totals: BuildupSegments, total: number }

const empty = (): BuildupSegments => ({ in_use: 0, reserved: 0, queued: 0, planned: 0 })

/**
 * Deler ett anleggs tall i lag som ikke teller samme effekt to ganger innen anlegget:
 * nettreservasjon utover det som er i bruk, omsøkt effekt, og planlagt kapasitet utover
 * reservasjon og søknad. Fyresdal (140 reservert + 225 omsøkt = 365 planlagt) gir derfor 365.
 * Summen på tvers av anlegg blander fortsatt ulike definisjoner og er bare en illustrasjon.
 */
export function siteSegments(site: Pick<DataCenter, 'mw_in_use' | 'mw_reserved' | 'mw_queued' | 'mw_planned'>): BuildupSegments {
  const inUse = site.mw_in_use ?? 0
  const secured = Math.max(inUse, site.mw_reserved ?? 0)
  const queued = site.mw_queued ?? 0
  return {
    in_use: inUse,
    reserved: secured - inUse,
    queued,
    planned: Math.max(0, (site.mw_planned ?? 0) - secured - queued),
  }
}

const sumOf = (segments: BuildupSegments) => buildupCategories.reduce((total, category) => total + segments[category], 0)

/** Rekkefølgen anleggene dukker opp i: største bidrag først, anlegg uten tall til slutt. */
export function buildupSteps<Site extends Pick<DataCenter, 'name' | 'mw_in_use' | 'mw_reserved' | 'mw_queued' | 'mw_planned'>>(sites: readonly Site[]): BuildupStep<Site>[] {
  const ordered = sites
    .map(site => ({ site, segments: siteSegments(site) }))
    .map(entry => ({ ...entry, siteTotal: sumOf(entry.segments) }))
    .sort((left, right) => right.siteTotal - left.siteTotal || left.site.name.localeCompare(right.site.name, 'nb-NO'))
  const totals = empty()
  return ordered.map(entry => {
    for (const category of buildupCategories) totals[category] += entry.segments[category]
    return { ...entry, totals: { ...totals }, total: sumOf(totals) }
  })
}
