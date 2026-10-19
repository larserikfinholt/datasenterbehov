import { describe, expect, it } from 'vitest'
import { REPORT_TEMPLATE, reportNewSiteUrl, reportSiteUrl } from './report-links'

describe('report links', () => {
  it('prefills the issue form for an existing site', () => {
    const url = new URL(reportSiteUrl({ id: 'gm-hamar', name: 'OSL-Hamar' }))
    expect(url.pathname).toBe('/larserikfinholt/datasenterbehov/issues/new')
    expect(url.searchParams.get('template')).toBe(REPORT_TEMPLATE)
    expect(url.searchParams.get('description')).toBe('Gjelder OSL-Hamar: https://larserikfinholt.github.io/datasenterbehov/#site-gm-hamar\n\n')
    expect(url.searchParams.has('datacenter')).toBe(false)
    expect(url.searchParams.has('type')).toBe(false)
    expect(url.searchParams.has('page_url')).toBe(false)
    expect(url.searchParams.get('title')).toBe('OSL-Hamar')
  })

  it('opens a blank form without a category or title prefix', () => {
    const url = new URL(reportNewSiteUrl())
    expect(url.searchParams.get('template')).toBe(REPORT_TEMPLATE)
    expect([...url.searchParams.keys()]).toEqual(['template'])
  })

  it('encodes names and context without introducing extra query parameters', () => {
    const name = 'Anlegg & ny informasjon?'
    const url = new URL(reportSiteUrl({ id: 'et-anlegg', name }))
    expect(url.searchParams.get('title')).toBe(name)
    expect([...url.searchParams.keys()]).toEqual(['template', 'title', 'description'])
  })
})
