// Inngang for presentasjonen: monterer animasjonen på lysbildet og spiller den av
// når lysbildet blir aktivt i Marp sin bespoke-visning. Andre visninger får sluttbildet.
// Det rolige kartet på siste lysbilde ([data-datacenter-map]) monteres uten animasjon.
// Skriptet lastes på flere lysbilder, så hvert element monteres bare én gang.
import { mountDatacenterBuildup, mountDatacenterMap } from '../datacenter-buildup-view'

const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches

for (const root of document.querySelectorAll<HTMLElement>('[data-datacenter-map]:not([data-mounted])')) {
  root.dataset.mounted = ''
  const { highlight, label } = root.dataset
  mountDatacenterMap(root, highlight && label ? { id: highlight, label } : undefined)
}

for (const root of document.querySelectorAll<HTMLElement>('[data-datacenter-buildup]:not([data-mounted])')) {
  root.dataset.mounted = ''
  const buildup = mountDatacenterBuildup(root)
  const slide = root.closest('svg[data-marpit-svg]')
  const isPlayable = slide?.classList.contains('bespoke-marp-slide') && !reducedMotion
  if (!slide || !isPlayable) continue

  let active = false
  const sync = () => {
    const nowActive = slide.classList.contains('bespoke-marp-active')
    if (nowActive === active) return
    active = nowActive
    if (active) buildup.play()
    else buildup.reset()
  }
  if (!slide.classList.contains('bespoke-marp-active')) buildup.reset()
  sync()
  new MutationObserver(sync).observe(slide, { attributes: true, attributeFilter: ['class'] })
}
