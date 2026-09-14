import { expect, test, type Page } from '@playwright/test'
import occupations from '../public/data/occupations.json' with { type: 'json' }
import { assessedFirstOrder } from '../src/model'

async function expectNoOverflow(page: Page) {
  const dimensions = await page.evaluate(() => ({ viewport: document.documentElement.clientWidth, content: document.documentElement.scrollWidth }))
  expect(dimensions.content).toBeLessThanOrEqual(dimensions.viewport)
}

test('two linear bars, three capacity segments and readable visual assets', async ({ page }, testInfo) => {
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  await page.goto('./')
  await page.evaluate(() => document.fonts.ready)
  await expect(page.locator('.headline-number')).toContainText('310')
  await expect(page.locator('[data-bar]')).toHaveCount(2)
  await expect(page.locator('[data-segment]')).toHaveCount(3)
  await expect(page.getByRole('img', { name: /To vertikale stolper/ })).toBeVisible()
  await expect(page.locator('[data-segment="existing"]')).toHaveText('500 MW')
  await expect(page.locator('[data-segment="committed"]')).toHaveText('700 MW')
  await expect(page.locator('[data-segment="planned"]')).toHaveText(/1\s100 MW/)
  await expect(page.locator('#chart-note')).toContainText('Foreløpige scenariotall')
  const geometry = await page.locator('.plot').evaluate(plot => {
    const bounds = plot.getBoundingClientRect()
    const rect = (selector: string) => {
      const element = plot.querySelector(selector)!
      const box = element.getBoundingClientRect()
      return { height: box.height, bottom: box.bottom, width: box.width }
    }
    return { plotHeight: bounds.height, demand: rect('[data-bar="demand"]'), capacity: rect('[data-bar="capacity"]'), existing: rect('[data-segment="existing"]'), committed: rect('[data-segment="committed"]'), planned: rect('[data-segment="planned"]') }
  })
  expect(geometry.demand.height / geometry.capacity.height).toBeCloseTo(309.7976166 / 2300, 3)
  expect(geometry.existing.height / geometry.plotHeight).toBeCloseTo(500 / 2500, 3)
  expect(geometry.committed.height / geometry.plotHeight).toBeCloseTo(700 / 2500, 3)
  expect(geometry.planned.height / geometry.plotHeight).toBeCloseTo(1100 / 2500, 3)
  expect(geometry.demand.bottom).toBeCloseTo(geometry.capacity.bottom, 1)
  expect(geometry.demand.width).toBeCloseTo(geometry.capacity.width, 1)
  expect(await page.locator('[data-segment="planned"]').evaluate(element => getComputedStyle(element).backgroundImage)).toContain('repeating-linear-gradient')
  for (const label of await page.locator('.segment > span, .bar-value').all()) {
    expect(await label.evaluate(element => element.scrollWidth <= element.parentElement!.clientWidth)).toBe(true)
  }
  await expectNoOverflow(page)
  await page.screenshot({ path: `artifacts/${testInfo.project.name}-page.png`, fullPage: true })
  await page.locator('#sammenligning').screenshot({ path: `artifacts/${testInfo.project.name}-chart.png` })
  expect(errors).toEqual([])
})

test('all reference methods update the chart and table, with invalid-input recovery', async ({ page }) => {
  await page.goto('./')
  const method = page.getByLabel('Hvordan anslår vi effekt per aktiv bruker?')
  await expect(page.locator('#result-mw')).toHaveText('309,8')
  await expect(method.locator('option:checked')).toHaveText('Delt NVIDIA H100-server')
  await expect(page.locator('#h100-note')).toBeVisible()
  await expect(page.locator('#h100-note')).toContainText('GLM 5.3 Flash')
  await expect(page.locator('#h100-note')).toContainText('(20)')
  await expect(page.locator('#metode')).not.toContainText('220 W-baseline')
  await method.selectOption('mac')
  await expect(page.locator('#h100-note')).toBeHidden()
  await expect(page.locator('#watts-value')).toHaveText('200')
  await expect(page.locator('#result-mw')).toHaveText('96,8')
  await expect(page.locator('#chart-scenario')).toContainText('ikke datasenterlast')
  await method.selectOption('fixed')
  await expect(page.locator('#h100-note')).toBeHidden()
  const input = page.getByLabel('Watt per aktiv referansebruker', { exact: true })
  await input.fill('1280')
  await expect(page.locator('#result-mw')).toHaveText('619,6')
  await expect(page.locator('#example-table tfoot')).toContainText('619,60')
  await input.fill('-1')
  await expect(input).toHaveAttribute('aria-invalid', 'true')
  await expect(page.locator('#result-mw')).toHaveText('619,6')
  await input.fill('')
  await expect(page.locator('#input-error')).toContainText('siste gyldige verdi')
  await input.fill('0')
  await expect(page.locator('#result-mw')).toHaveText('0,0')
  await expect(page.locator('#demand-label')).toHaveText('0 MW')
  await expect(input).not.toHaveAttribute('aria-invalid')
  await expectNoOverflow(page)
  await input.fill('10000')
  await expect(input).not.toHaveAttribute('aria-invalid')
  for (const label of await page.locator('.segment > span').all()) {
    expect(await label.evaluate(element => element.getBoundingClientRect().height <= element.parentElement!.getBoundingClientRect().height)).toBe(true)
  }
  await expectNoOverflow(page)
  await input.fill('10001')
  await expect(input).toHaveAttribute('aria-invalid', 'true')
  await method.selectOption('h100')
  await expect(page.locator('#h100-note')).toBeVisible()
  await expect(page.locator('#result-mw')).toHaveText('309,8')
})

test('occupations load only on expansion, preserve SSB order and support search', async ({ page }) => {
  let dataRequests = 0
  page.on('request', request => { if (request.url().endsWith('/data/occupations.json')) dataRequests++ })
  await page.goto('./')
  await expect(page.locator('#example-table tbody tr')).toHaveCount(6)
  await expect(page.locator('#full-table tr')).toHaveCount(0)
  expect(dataRequests).toBe(0)
  const toggle = page.getByRole('button', { name: /Vis alle yrker/ })
  await toggle.focus()
  await page.keyboard.press('Enter')
  await expect(page.locator('#full-table tbody tr')).toHaveCount(407)
  await expect(page.locator('#toggle-occupations')).toHaveAttribute('aria-expanded', 'true')
  expect(dataRequests).toBe(1)
  const codes = await page.locator('#full-table tbody tr').evaluateAll(rows => rows.map(row => row.getAttribute('data-code')))
  expect(codes).toEqual(assessedFirstOrder(occupations).map(row => row.code))
  await expect(page.locator('#full-table [data-fte-status="observed"]')).toHaveCount(393)
  await expect(page.locator('#full-table [data-fte-status="missing"]')).toHaveCount(14)
  await expectNoOverflow(page)
  const search = page.getByLabel('Søk etter yrke eller STYRK-08-kode')
  await search.fill('2342')
  await expect(page.locator('#full-table tbody tr')).toHaveCount(1)
  await expect(page.locator('#full-table tbody tr')).toContainText('Førskole-/barnehagelærere')
  await expect(page.locator('#full-table tbody tr')).toContainText('0,08')
  await search.fill('ikke-et-yrke')
  await expect(page.locator('#full-table')).toHaveText('Ingen yrker passer med søket.')
  await search.fill('')
  await page.getByRole('button', { name: /Skjul alle yrker/ }).click()
  await expect(page.locator('#all-occupations')).toBeHidden()
  await page.getByRole('button', { name: /Vis alle yrker/ }).click()
  await expect(page.locator('#full-table tbody tr')).toHaveCount(407)
  expect(dataRequests).toBe(1)
})

test('failed data loads can be retried', async ({ page }) => {
  await page.route('**/data/occupations.json', route => route.fulfill({ status: 503, body: 'Unavailable' }))
  await page.goto('./')
  await page.getByRole('button', { name: /Vis alle yrker/ }).click()
  await expect(page.locator('#load-status')).toContainText('kunne ikke lastes')
  await expect(page.locator('#toggle-occupations')).toBeEnabled()
  await page.unroute('**/data/occupations.json')
  await page.getByRole('button', { name: /Vis alle yrker/ }).click()
  await expect(page.locator('#full-table tbody tr')).toHaveCount(407)
})

test('native FAQ, skip link and source links are keyboard accessible', async ({ page }) => {
  await page.goto('./')
  await page.keyboard.press('Tab')
  await expect(page.getByRole('link', { name: 'Hopp til innhold' })).toBeFocused()
  await expect(page.locator('details')).toHaveCount(8)
  const question = page.locator('summary').first()
  await question.focus()
  await page.keyboard.press('Enter')
  await expect(page.locator('details').first()).toHaveAttribute('open', '')
  await expect(page.locator('details').first()).toContainText('309,80 MW')
  await expect(page.locator('#metode a[href="https://github.com/larserikfinholt/datasenterbehov"]')).toBeVisible()
  await expect(page.locator('footer a[href="https://github.com/larserikfinholt/datasenterbehov"]')).toBeVisible()
  await expect(page.locator('a[href*="DatacenterNeed"]')).toHaveCount(0)
})

test('small mobile and tablet widths have no horizontal overflow', async ({ page }) => {
  for (const width of [320, 375, 768]) {
    await page.setViewportSize({ width, height: 900 })
    await page.goto('./')
    await page.evaluate(() => document.fonts.ready)
    await expectNoOverflow(page)
    await page.getByRole('button', { name: /Vis alle yrker/ }).click()
    await expect(page.locator('#full-table tbody tr')).toHaveCount(407)
    await expectNoOverflow(page)
  }
})