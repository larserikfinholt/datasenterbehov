import { describe, expect, it } from 'vitest'
import { REPORT_TEMPLATE, REPORT_TYPES, reportNewSiteUrl, reportSiteUrl } from './report-links'

describe('report links', () => {
  it('prefills the issue form for an existing site', () => {
    const url = new URL(reportSiteUrl({ id: 'gm-hamar', name: 'OSL-Hamar' }))
    expect(url.pathname).toBe('/larserikfinholt/datasenterbehov/issues/new')
    expect(url.searchParams.get('template')).toBe(REPORT_TEMPLATE)
    expect(url.searchParams.get('datacenter')).toBe('OSL-Hamar')
    expect(url.searchParams.get('type')).toBe(REPORT_TYPES.correction)
    expect(url.searchParams.has('page_url')).toBe(false)
    expect(url.searchParams.get('title')).toBe('[Data] OSL-Hamar')
  })

  it('preselects a new site', () => {
    const url = new URL(reportNewSiteUrl())
    expect(url.searchParams.get('template')).toBe(REPORT_TEMPLATE)
    expect(url.searchParams.get('type')).toBe(REPORT_TYPES.newSite)
  })
})
