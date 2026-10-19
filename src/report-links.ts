export const PROJECT_REPO = 'https://github.com/larserikfinholt/datasenterbehov'
export const SITE_URL = 'https://larserikfinholt.github.io/datasenterbehov/'
export const REPORT_TEMPLATE = 'data-korreksjon.yml'

export const siteUrl = (id: string) => `${SITE_URL}#site-${id}`

function issueUrl(fields: Record<string, string>) {
  return `${PROJECT_REPO}/issues/new?${new URLSearchParams({ template: REPORT_TEMPLATE, ...fields })}`
}

/** Prefilled issue form for an existing data center. */
export function reportSiteUrl(site: { id: string, name: string }) {
  return issueUrl({ title: site.name, description: `Gjelder ${site.name}: ${siteUrl(site.id)}\n\n` })
}

export function reportNewSiteUrl() {
  return issueUrl({})
}
