export const PROJECT_REPO = 'https://github.com/larserikfinholt/datasenterbehov'
export const SITE_URL = 'https://larserikfinholt.github.io/datasenterbehov/'
export const REPORT_TEMPLATE = 'data-korreksjon.yml'

/** Option texts in the `type` dropdown of .github/ISSUE_TEMPLATE/data-korreksjon.yml. */
export const REPORT_TYPES = {
  correction: 'Rettelse av eksisterende datasenter',
  supplement: 'Tilleggsinformasjon til eksisterende datasenter',
  newSite: 'Nytt datasenter som mangler',
} as const

export const siteUrl = (id: string) => `${SITE_URL}#site-${id}`

function issueUrl(fields: Record<string, string>) {
  return `${PROJECT_REPO}/issues/new?${new URLSearchParams({ template: REPORT_TEMPLATE, ...fields })}`
}

/** Prefilled issue form for an existing data center. The `datacenter` field starts with the stable id. */
export function reportSiteUrl(site: { id: string, name: string }) {
  return issueUrl({ title: `[Data] ${site.name}`, datacenter: `${site.id} · ${site.name}`, page_url: siteUrl(site.id) })
}

export function reportNewSiteUrl() {
  return issueUrl({ title: '[Nytt datasenter] ', type: REPORT_TYPES.newSite })
}
