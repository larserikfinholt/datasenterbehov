import dataset from './data/datacenters.json'
import styles from './datacenter-buildup.css?inline'
import { buildupCategories, buildupLabels, buildupSteps, type BuildupCategory, type BuildupSegments } from './datacenter-buildup'
import { markerRadius, type DataCenter } from './datacenters'

const sites = dataset.sites as DataCenter[]
const format = (value: number) => new Intl.NumberFormat('nb-NO', { maximumFractionDigits: 0 }).format(value)
const escapeHtml = (value: string) => value.replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]!)
/** Første anlegg venter litt, deretter går det raskere etter hvert som bidragene blir små. */
const delayFor = (index: number) => index === 0 ? 700 : Math.max(450, 1400 - index * 75)
const COUNT_DURATION = 650
const MAX_RADIUS = 42

export type DatacenterBuildup = { play(): void, reset(): void, showAll(): void }

function injectStyles() {
  if (document.getElementById('datacenter-buildup-styles')) return
  const style = document.createElement('style')
  style.id = 'datacenter-buildup-styles'
  style.textContent = styles
  document.head.append(style)
}

/** Kart til venstre og én oppsummert stolpe til høyre som bygges opp anlegg for anlegg. */
export function mountDatacenterBuildup(root: HTMLElement): DatacenterBuildup {
  injectStyles()
  const steps = buildupSteps(sites)
  const final = steps.at(-1)!
  const categories = buildupCategories.filter(category => final.totals[category] > 0)
  const largest = Math.max(...steps.map(step => step.siteTotal))
  const scaleMax = Math.ceil(final.total / 1000) * 1000
  const ticks = Array.from({ length: scaleMax / 1000 + 1 }, (_, index) => index * 1000)

  root.classList.add('dc-buildup')
  root.setAttribute('role', 'img')
  root.setAttribute('aria-label', `Kart over ${steps.length} datasentre i Norge som dukker opp ett for ett, største først. Stolpen summerer ${categories.map(category => `${buildupLabels[category].toLowerCase()} ${format(final.totals[category])} MW`).join(', ')}, til sammen ${format(final.total)} MW.`)
  root.innerHTML = `<svg class="dc-map" viewBox="${dataset.map.viewBox}" aria-hidden="true">
      <path class="dc-coast" d="${dataset.map.outlinePath}" />
      ${steps.map((step, index) => `<circle class="dc-marker${step.siteTotal === 0 ? ' unknown' : ''}" data-step="${index}" cx="${step.site.x}" cy="${step.site.y}" r="${step.siteTotal === 0 ? 4 : markerRadius(step.siteTotal, largest, MAX_RADIUS)}" />`).join('')}
    </svg>
    <div class="dc-tally" aria-hidden="true">
      <p class="dc-total"><span class="dc-total-value">0</span> MW</p>
      <p class="dc-count"><span class="dc-count-value">0</span> av ${steps.length} anlegg</p>
      <div class="dc-chart">
        <div class="dc-axis">${ticks.map(tick => `<span style="bottom: ${tick / scaleMax * 100}%">${format(tick)}</span>`).join('')}</div>
        <div class="dc-bar">${ticks.slice(1).map(tick => `<i class="dc-grid" style="bottom: ${tick / scaleMax * 100}%"></i>`).join('')}${categories.map(category => `<div class="dc-segment ${category}" data-category="${category}"></div>`).join('')}</div>
        <ul class="dc-legend">${[...categories].reverse().map(category => `<li class="${category}"><span class="dc-swatch ${category}"></span><span class="dc-legend-label">${buildupLabels[category]}</span><strong data-category="${category}">0 MW</strong></li>`).join('')}</ul>
      </div>
      <p class="dc-latest"></p>
    </div>`

  const markers = [...root.querySelectorAll<SVGCircleElement>('.dc-marker')]
  const segments = Object.fromEntries([...root.querySelectorAll<HTMLElement>('.dc-segment')].map(element => [element.dataset.category, element])) as Record<BuildupCategory, HTMLElement>
  const legendValues = Object.fromEntries([...root.querySelectorAll<HTMLElement>('.dc-legend strong')].map(element => [element.dataset.category, element])) as Record<BuildupCategory, HTMLElement>
  const totalValue = root.querySelector<HTMLElement>('.dc-total-value')!
  const countValue = root.querySelector<HTMLElement>('.dc-count-value')!
  const latest = root.querySelector<HTMLElement>('.dc-latest')!
  const timers: number[] = []
  let frame = 0
  let shown: BuildupSegments = { in_use: 0, reserved: 0, queued: 0, planned: 0 }

  function writeNumbers(totals: BuildupSegments) {
    totalValue.textContent = format(buildupCategories.reduce((sum, category) => sum + totals[category], 0))
    for (const category of categories) legendValues[category].textContent = `${format(totals[category])} MW`
  }

  function countTo(target: BuildupSegments, animate: boolean) {
    cancelAnimationFrame(frame)
    const from = shown
    if (!animate) {
      shown = target
      writeNumbers(target)
      return
    }
    const start = performance.now()
    const tick = (now: number) => {
      const progress = Math.min(1, (now - start) / COUNT_DURATION)
      const eased = 1 - (1 - progress) ** 3
      shown = Object.fromEntries(buildupCategories.map(category => [category, from[category] + (target[category] - from[category]) * eased])) as BuildupSegments
      writeNumbers(shown)
      if (progress < 1) frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
  }

  function showStep(index: number, animate: boolean) {
    const step = steps[index]
    markers.forEach((marker, markerIndex) => {
      marker.classList.toggle('is-shown', markerIndex <= index)
      marker.classList.toggle('is-latest', animate && markerIndex === index)
    })
    for (const category of categories) segments[category].style.height = `${step.totals[category] / scaleMax * 100}%`
    countValue.textContent = String(index + 1)
    const added = step.siteTotal > 0 ? `+${format(step.siteTotal)} MW` : 'MW ukjent'
    latest.innerHTML = animate ? `<strong>${escapeHtml(step.site.name)}</strong>${escapeHtml(step.site.kommune)} · ${added}` : ''
    countTo(step.totals, animate)
  }

  function clear() {
    timers.splice(0).forEach(clearTimeout)
    cancelAnimationFrame(frame)
  }

  function reset() {
    clear()
    root.classList.add('is-static')
    markers.forEach(marker => marker.classList.remove('is-shown', 'is-latest'))
    for (const category of categories) segments[category].style.height = '0%'
    countValue.textContent = '0'
    latest.textContent = ''
    countTo({ in_use: 0, reserved: 0, queued: 0, planned: 0 }, false)
  }

  function play() {
    reset()
    // Én ramme med nullstilt tilstand før overgangene slås på igjen.
    requestAnimationFrame(() => root.classList.remove('is-static'))
    let elapsed = 0
    steps.forEach((_, index) => {
      elapsed += delayFor(index)
      timers.push(window.setTimeout(() => showStep(index, true), elapsed))
    })
    timers.push(window.setTimeout(() => markers.forEach(marker => marker.classList.remove('is-latest')), elapsed + 1600))
  }

  function showAll() {
    clear()
    root.classList.add('is-static')
    showStep(steps.length - 1, false)
  }

  showAll()
  return { play, reset, showAll }
}
