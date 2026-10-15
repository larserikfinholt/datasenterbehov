// Yrkesmålerne på lysbilde 5. Hver måler er et Marp-fragment: når fragmentet blir
// aktivt teller tallet opp og stolpen fylles til målverdien. Markupen har sluttverdien,
// så PDF og redusert bevegelse viser sluttbildet uten skript.
// En måler med data-fragment-follows-previous er ikke et eget trinn. Den speiler
// fragmenttilstanden til måleren foran, så begge vises og animeres på samme trykk.
const DURATION_MS = 1400
const FRAGMENT_ATTR = 'data-bespoke-marp-fragment'
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
const easeOut = (t: number) => 1 - (1 - t) ** 3

function mountMeter(meter: HTMLElement) {
  const target = Number(meter.dataset.value)
  const value = meter.querySelector<HTMLElement>('.meter-value')
  const fill = meter.querySelector<HTMLElement>('.meter-fill')
  if (!value || !fill || !Number.isFinite(target)) return
  let frame = 0
  const render = (percent: number) => { value.textContent = `${Math.round(percent)}`; fill.style.height = `${percent}%` }
  const reset = () => { cancelAnimationFrame(frame); render(0) }
  const play = () => { cancelAnimationFrame(frame); const start = performance.now(); const step = (now: number) => { const t = Math.min(1, (now - start) / DURATION_MS); render(target * easeOut(t)); if (t < 1) frame = requestAnimationFrame(step) }; frame = requestAnimationFrame(step) }
  // Bespoke skriver attributtet på alle fragmenter ved hvert trykk, også uendret.
  let current: string | null = null
  const sync = () => {
    const state = meter.getAttribute(FRAGMENT_ATTR)
    if (state === current) return
    current = state
    if (state === 'active') play()
    else if (state === 'inactive') reset()
  }
  sync()
  new MutationObserver(sync).observe(meter, { attributes: true, attributeFilter: [FRAGMENT_ATTR] })
}

function followPrevious(meter: HTMLElement, meters: HTMLElement[]) {
  const leader = meters.slice(0, meters.indexOf(meter)).reverse().find(m => m.hasAttribute('data-marpit-fragment'))
  if (!leader) return
  const mirror = () => {
    const state = leader.getAttribute(FRAGMENT_ATTR)
    if (state === meter.getAttribute(FRAGMENT_ATTR)) return
    if (state === null) meter.removeAttribute(FRAGMENT_ATTR)
    else meter.setAttribute(FRAGMENT_ATTR, state)
  }
  mirror()
  new MutationObserver(mirror).observe(leader, { attributes: true, attributeFilter: [FRAGMENT_ATTR] })
}

const meters = [...document.querySelectorAll<HTMLElement>('[data-occupation-meter]')]
for (const meter of meters) if (meter.hasAttribute('data-fragment-follows-previous')) followPrevious(meter, meters)
if (!reducedMotion) for (const meter of meters) mountMeter(meter)
