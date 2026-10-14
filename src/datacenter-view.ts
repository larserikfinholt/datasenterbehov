import dataset from './data/datacenters.json'
import { byMwDesc, markerRadius, maxMw, statusLabels, type DataCenter } from './datacenters'

const sites = dataset.sites as DataCenter[]
const maximum = Math.max(500, ...sites.map(site => maxMw(site) ?? 0))
const format = (value: number) => new Intl.NumberFormat('nb-NO', { maximumFractionDigits: 1 }).format(value)
const escapeHtml = (value: string) => value.replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]!)
const mw = (value: number | null) => value === null ? 'Ukjent' : `${format(value)} MW`

function listMarkup(rows: readonly DataCenter[]) {
  return rows.map(site => `<li data-site="${site.id}" id="site-${site.id}" tabindex="0">
    <div class="site-heading"><h3>${escapeHtml(site.name)}</h3><span class="site-status ${site.status}">${statusLabels[site.status]}</span></div>
    <p class="site-location">${escapeHtml(site.operator)} · ${escapeHtml(site.kommune)}</p>
    <dl class="site-power"><div><dt>I bruk</dt><dd>${mw(site.mw_in_use)}</dd></div><div><dt>Reservert</dt><dd>${mw(site.mw_reserved)}</dd></div><div><dt>Planlagt / kapasitet</dt><dd>${mw(site.mw_planned)}</dd></div><div><dt>Omsøkt / ikke tildelt</dt><dd>${mw(site.mw_queued)}</dd></div></dl>
    <p class="site-definition">${escapeHtml(site.power_status)}</p>
    <p class="site-note">${escapeHtml(site.note)} · ${site.precision === 'site' ? 'Anleggsposisjon' : site.precision === 'place' ? 'Omtrentlig stedsposisjon' : 'Omtrentlig kommuneposisjon'}</p>
    <div class="site-sources">${site.source_urls.map((url, index) => `<a href="${escapeHtml(url)}">Kilde${site.source_urls.length > 1 ? ` ${index + 1}` : ''}<span class="sr-only">: ${escapeHtml(site.name)}</span></a>`).join(' · ')}${site.nkomRegistered ? '<span>Registrert operatør hos Nkom</span>' : '<span>Ingen kobling til Nkom-listen</span>'}</div>
  </li>`).join('')
}

export function datacenterMapMarkup() {
  return `<section id="kart" class="map band" aria-labelledby="map-title"><div class="wrap">
    <div class="section-heading"><p class="eyebrow">01 / KARTET</p><h2 id="map-title">Datasentrene bak kapasiteten.</h2></div>
    <p class="section-lead">${sites.length} kildebelagte anlegg og prosjekter. Et utvalg, ikke en komplett oversikt over norske datasentre.</p>
    <div class="map-layout">
      <figure class="norway-map" aria-labelledby="map-title" aria-describedby="map-note">
        <svg class="norway-outline" viewBox="${dataset.map.viewBox}" role="group" aria-label="Datasentre i Fastlands-Norge">
          <path class="coastline" d="${dataset.map.outlinePath}" />
          ${byMwDesc(sites).map(site => `<circle data-site="${site.id}" class="marker ${site.status}${maxMw(site) === null ? ' unknown-mw' : ''}" cx="${site.x}" cy="${site.y}" r="${markerRadius(maxMw(site), maximum)}" tabindex="0" role="button" aria-label="${escapeHtml(site.name)}: ${statusLabels[site.status]}, største oppgitte effekt ${mw(maxMw(site))}" aria-controls="site-${site.id}"><title>${escapeHtml(site.name)} · ${escapeHtml(site.kommune)} · ${mw(maxMw(site))}</title></circle>`).join('')}
        </svg>
        <p id="map-selection" class="map-selection" aria-live="polite"></p>
        <ul class="map-size-legend" aria-label="Størrelsesskala">${[10, 100, 500].map(value => `<li><svg viewBox="0 0 64 64" aria-hidden="true"><circle cx="32" cy="32" r="${markerRadius(value, maximum)}" /></svg><span>${value} MW</span></li>`).join('')}<li><svg viewBox="0 0 64 64" aria-hidden="true"><circle class="unknown-mw" cx="32" cy="32" r="3" /></svg><span>Ukjent MW</span></li></ul>
        <ul class="legend map-status-legend" aria-label="Anleggsstatus">${Object.entries(statusLabels).map(([status, label]) => `<li><svg viewBox="0 0 24 24" aria-hidden="true"><circle class="marker ${status}" cx="12" cy="12" r="8" /></svg>${label}</li>`).join('')}</ul>
        <figcaption id="map-note">Sirkelareal og MW-sortering følger det største dokumenterte tallet av i bruk, reservert og planlagt / kapasitet per anlegg, ikke summen. Omsøkt / ikke tildelt er rapportert omsøkt effekt eller kapasitetskø og inngår ikke i sirkelareal eller MW-sortering. Kildedato og forbehold står ved anlegget; historiske køtall er ikke verifisert som dagens Statnett-kø. I bruk er dokumentert last; reservert er kontrahert eller reservert effekt; planlagt / kapasitet kan være annonsert IT-effekt, anleggseffekt eller utbyggingspotensial. Anleggsstatus beskriver campus, ikke tildeling av kraft. Se definisjonen ved hvert anlegg. Tallene kan overlappe, er ikke direkte sammenlignbare og summeres ikke. Små svarte prikker betyr ukjent MW for sirkelarealet, selv om omsøkt effekt er oppgitt. Posisjoner er merket med presisjon i listen. Kart: ${dataset.map.attribution}.</figcaption>
      </figure>
      <div class="map-directory"><div class="map-list-heading"><h3>Anlegg og prosjekter</h3><div><label for="site-sort">Sorter etter</label><select id="site-sort"><option value="mw">Største oppgitte MW</option><option value="name">Navn</option><option value="status">Status</option></select></div></div><ol class="site-list" aria-label="Datasentre">${listMarkup(byMwDesc(sites))}</ol></div>
    </div>
    <details class="map-registry"><summary>Nkom-registeret og operatører uten kartfestet anlegg</summary>
      <p><a href="${dataset.nkom.overviewUrl}">Nkoms oversikt</a>: ${dataset.nkom.registered} registrerte datasentre, inkludert virksomhetsinterne, og ${dataset.nkom.commercialOperators} navngitte kommersielle operatører. Sist oppdatert ${new Intl.DateTimeFormat('nb-NO', { dateStyle: 'medium', timeZone: 'UTC' }).format(new Date(dataset.nkom.lastUpdated))}. Datasentre og operatører er ulike enheter og skal ikke trekkes fra hverandre. ${dataset.unmappedOperators.length} operatører er ikke koblet til et anlegg i dette utvalget. Forretningsadresser fra Brønnøysund brukes ikke som anleggsposisjoner.</p>
      <ul class="unmapped-operators">${dataset.unmappedOperators.map(operator => `<li>${escapeHtml(operator.name)} <small>${operator.orgnr}${operator.businessKommune ? ` · forretningsadresse: ${escapeHtml(operator.businessKommune)}` : ''}${operator.cryptoMining ? ' · oppgir kryptovalutautvinning' : ''}</small></li>`).join('')}</ul>
    </details>
  </div></section>`
}

export function initializeDatacenterMap() {
  const section = document.querySelector<HTMLElement>('#kart')!
  const list = section.querySelector<HTMLOListElement>('.site-list')!
  const selection = section.querySelector<HTMLElement>('#map-selection')!
  const active = { hover: null as string | null, focus: null as string | null }
  function highlight() {
    const id = active.hover ?? active.focus
    section.querySelectorAll('[data-site]').forEach(element => element.classList.toggle('is-active', element.getAttribute('data-site') === id))
    const site = sites.find(site => site.id === id)
    selection.textContent = site ? `${site.name} · ${site.kommune} · ${mw(maxMw(site))}` : ''
  }
  for (const [enter, leave, key] of [['pointerover', 'pointerout', 'hover'], ['focusin', 'focusout', 'focus']] as const) {
    section.addEventListener(enter, event => {
      active[key] = (event.target as Element).closest('[data-site]')?.getAttribute('data-site') ?? null
      highlight()
    })
    section.addEventListener(leave, event => {
      const related = (event as FocusEvent).relatedTarget
      active[key] = related instanceof Element ? related.closest('[data-site]')?.getAttribute('data-site') ?? null : null
      highlight()
    })
  }
  function selectMarker(target: EventTarget | null) {
    const marker = target instanceof Element ? target.closest('circle[data-site]') : null
    if (!marker) return
    const item = document.getElementById(`site-${marker.getAttribute('data-site')}`)!
    item.scrollIntoView({ block: 'nearest', behavior: 'instant' })
    item.focus({ preventScroll: true })
  }
  section.addEventListener('click', event => selectMarker(event.target))
  section.addEventListener('keydown', event => {
    if ((event.key === 'Enter' || event.key === ' ') && (event.target as Element).matches('circle[data-site]')) {
      event.preventDefault()
      selectMarker(event.target)
    }
  })
  section.querySelector<HTMLSelectElement>('#site-sort')!.addEventListener('change', event => {
    const order = (event.target as HTMLSelectElement).value
    const rows = order === 'mw' ? byMwDesc(sites) : [...sites].sort((left, right) => order === 'status' ? statusLabels[left.status].localeCompare(statusLabels[right.status], 'nb-NO') || left.name.localeCompare(right.name, 'nb-NO') : left.name.localeCompare(right.name, 'nb-NO'))
    list.innerHTML = listMarkup(rows)
    active.hover = null
    active.focus = null
    highlight()
  })
}