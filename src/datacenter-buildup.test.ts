import { describe, expect, it } from 'vitest'
import { buildupSteps, siteSegments } from './datacenter-buildup'
import dataset from './data/datacenters.json'

const site = (name: string, values: Partial<Record<'mw_in_use' | 'mw_reserved' | 'mw_queued' | 'mw_planned', number>>) => ({
  name, mw_in_use: null, mw_reserved: null, mw_queued: null, mw_planned: null, ...values,
})

describe('datacenter buildup', () => {
  it('layers one site without counting the same MW twice', () => {
    expect(siteSegments(site('Fyresdal', { mw_reserved: 140, mw_queued: 225, mw_planned: 365 }))).toEqual({ in_use: 0, reserved: 140, queued: 225, planned: 0 })
    expect(siteSegments(site('Gromstul', { mw_reserved: 240, mw_queued: 840 }))).toEqual({ in_use: 0, reserved: 240, queued: 840, planned: 0 })
    expect(siteSegments(site('Drift', { mw_in_use: 30, mw_reserved: 50, mw_planned: 120 }))).toEqual({ in_use: 30, reserved: 20, queued: 0, planned: 70 })
    expect(siteSegments(site('Ukjent', {}))).toEqual({ in_use: 0, reserved: 0, queued: 0, planned: 0 })
  })

  it('orders by contribution with unknown sites last and accumulates totals', () => {
    const sites = [site('Ukjent', {}), site('Liten', { mw_planned: 20 }), site('Stor', { mw_reserved: 100, mw_queued: 50 })]
    const steps = buildupSteps(sites)
    expect(steps.map(step => step.site.name)).toEqual(['Stor', 'Liten', 'Ukjent'])
    expect(steps.map(step => step.total)).toEqual([150, 170, 170])
    expect(steps[1].totals).toEqual({ in_use: 0, reserved: 100, queued: 50, planned: 20 })
    expect(sites[0].name).toBe('Ukjent')
  })

  it('includes every site in the published dataset', () => {
    const steps = buildupSteps(dataset.sites)
    expect(steps).toHaveLength(dataset.sites.length)
    expect(steps.at(-1)!.total).toBe(steps.reduce((sum, step) => sum + step.siteTotal, 0))
  })
})
