import dataset from './data/datacenters.json'
import { byMwDesc, formatIsoDate, markerRadius, maxMw, plannedBasisLabels, statusLabels, type DataCenter } from './datacenters'
import { reportNewSiteUrl, reportSiteUrl } from './report-links'

const sites = dataset.sites as DataCenter[]
const maximum = Math.max(500, ...sites.map(site => maxMw(site) ?? 0))
const format = (value: number) => new Intl.NumberFormat('nb-NO', { maximumFractionDigits: 1 }).format(value)
const escapeHtml = (value: string) => value.replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]!)
const mw = (value: number | null) => value === null ? 'Ukjent' : `${format(value)} MW`
const timestamp = (iso: string) => `${new Intl.DateTimeFormat('nb-NO', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'UTC' }).format(new Date(iso))} UTC`
/** Markers smaller than this radius get an invisible, larger hit target behind them. */
const HIT_TARGET_BELOW_RADIUS = 8

function sourceMarkup(site: DataCenter) {
  const links = site.source_urls.map((url, index) => {
    const date = site.source_dates[index] ?? null
    return `<a href="${escapeHtml(url)}">Kilde${site.source_urls.length > 1 ? ` ${index + 1}` : ''} (${date ? formatIsoDate(date) : 'udatert'})<span class="sr-only">: ${escapeHtml(site.name)}</span></a>`
  })
  const review = site.reviewed_at ? `Gjennomgått ${formatIsoDate(site.reviewed_at)}` : 'Ikke gjennomgått mot kilde'
  return `${links.join(' · ')}<span class="site-review">${review}</span>${site.nkomRegistered ? '<span>Registrert operatør hos Nkom</span>' : '<span>Ingen kobling til Nkom-listen</span>'}`
}

function listMarkup(rows: readonly DataCenter[]) {
  return rows.map(site => `<li data-site="${site.id}" id="site-${site.id}" tabindex="0">
    <div class="site-heading"><h3>${escapeHtml(site.name)}</h3><span class="site-status ${site.status}">${statusLabels[site.status]}</span></div>
    <p class="site-location">${escapeHtml(site.operator)} · ${escapeHtml(site.kommune)}</p>
    <dl class="site-power"><div><dt>I bruk</dt><dd>${mw(site.mw_in_use)}</dd></div><div><dt>Nettreservasjon</dt><dd>${mw(site.mw_reserved)}</dd></div><div><dt>Planlagt / kapasitet${site.mw_planned_basis ? `<small>${plannedBasisLabels[site.mw_planned_basis]}</small>` : ''}</dt><dd>${mw(site.mw_planned)}</dd></div><div><dt>Omsøkt / ikke tildelt</dt><dd>${mw(site.mw_queued)}</dd></div></dl>
    <p class="site-definition">${escapeHtml(site.power_status)}</p>
    <p class="site-note">${escapeHtml(site.note)} · ${site.precision === 'site' ? 'Anleggsposisjon' : site.precision === 'place' ? 'Omtrentlig stedsposisjon' : 'Omtrentlig kommuneposisjon'}</p>
    <div class="site-sources">${sourceMarkup(site)}</div>
    <p class="site-report"><a href="${escapeHtml(reportSiteUrl(site))}" target="_blank" rel="noopener noreferrer" title="Åpner et innmeldingsskjema på GitHub i en ny fane (krever GitHub-konto)">Ny informasjon eller rettelse<span class="sr-only">: ${escapeHtml(site.name)} (åpnes i ny fane)</span></a></p>
  </li>`).join('')
}

function markerMarkup(site: DataCenter) {
  const radius = markerRadius(maxMw(site), maximum)
  const hit = radius < HIT_TARGET_BELOW_RADIUS ? `<circle class="marker-hit" data-site="${site.id}" cx="${site.x}" cy="${site.y}" r="10" fill="transparent" pointer-events="all" aria-hidden="true" />` : ''
  return `${hit}<circle data-site="${site.id}" class="marker ${site.status}${maxMw(site) === null ? ' unknown-mw' : ''}" cx="${site.x}" cy="${site.y}" r="${radius}" tabindex="0" role="button" aria-label="${escapeHtml(site.name)}: ${statusLabels[site.status]}, største oppgitte effekt ${mw(maxMw(site))}" aria-controls="site-${site.id}"><title>${escapeHtml(site.name)} · ${escapeHtml(site.kommune)} · ${mw(maxMw(site))}</title></circle>`
}

export function datacenterMapMarkup() {
  return `<section id="kart" class="map band" aria-labelledby="map-title"><div class="wrap">
    <div class="section-heading"><p class="eyebrow">01 / KARTET</p><h2 id="map-title">Datasentrene bak kapasiteten.</h2></div>
    <p class="section-lead">${sites.length} kildebelagte anlegg og prosjekter. Et utvalg, ikke en komplett oversikt over norske datasentre.</p>
    <aside class="map-contribute" aria-labelledby="map-contribute-title">
      <h3 id="map-contribute-title">Datasenterlisten er en felles dugnad. Du kan bidra.</h3>
      <p>Har du funnet nye opplysninger, et datasenter som mangler eller noe som bør rettes? Tips oss, også om du er usikker. Vi kontrollerer opplysningene før publisering.</p>
      <a href="${escapeHtml(reportNewSiteUrl())}" target="_blank" rel="noopener noreferrer">Tips oss<span class="sr-only"> (åpnes i ny fane)</span></a>
      <small>Innmelding på GitHub krever en GitHub-konto.</small>
    </aside>
    <div class="map-layout">
      <figure class="norway-map" aria-labelledby="map-title" aria-describedby="map-note">
        <svg class="norway-outline" viewBox="${dataset.map.viewBox}" role="group" aria-label="Datasentre i Fastlands-Norge">
          <path class="coastline" d="${dataset.map.outlinePath}" />
          ${byMwDesc(sites).map(markerMarkup).join('')}
        </svg>
        <p id="map-selection" class="map-selection" aria-live="polite"></p>
        <ul class="map-size-legend" aria-label="Størrelsesskala">${[10, 100, 500].map(value => `<li><svg viewBox="0 0 64 64" aria-hidden="true"><circle cx="32" cy="32" r="${markerRadius(value, maximum)}" /></svg><span>${value} MW</span></li>`).join('')}<li><svg viewBox="0 0 64 64" aria-hidden="true"><circle class="unknown-mw" cx="32" cy="32" r="3" /></svg><span>Ukjent MW</span></li></ul>
        <ul class="legend map-status-legend" aria-label="Anleggsstatus">${Object.entries(statusLabels).map(([status, label]) => `<li><svg viewBox="0 0 24 24" aria-hidden="true"><circle class="marker ${status}" cx="12" cy="12" r="8" /></svg>${label}</li>`).join('')}</ul>
        <figcaption id="map-note">Sirkelareal og MW-sortering følger det største dokumenterte tallet av i bruk, nettreservasjon og planlagt / kapasitet per anlegg, ikke summen. Omsøkt / ikke tildelt er rapportert omsøkt effekt eller kapasitetskø og inngår ikke i sirkelareal eller MW-sortering. I bruk er dokumentert last. Nettreservasjon er tildelt eller reservert nettkapasitet, ikke kundekontrakter. Planlagt / kapasitet har oppgitt grunnlag per anlegg: IT-kapasitet, anleggskapasitet, utbyggingspotensial, annonsert kapasitet uten definisjon eller planlagt nettilknytning. Anleggsstatus beskriver campus, ikke tildeling av kraft. Tallene kan overlappe, er ikke direkte sammenlignbare og summeres ikke. Hver kilde vises med publiseringsdato eller som udatert, og hvert anlegg viser når prosjektet sist gjennomgikk kildene; historiske køtall er ikke verifisert som dagens Statnett-kø. Små svarte prikker betyr ukjent MW for sirkelarealet, selv om omsøkt effekt er oppgitt. Gromstul i Skien har to overlappende punkter: Googles anlegg og Nscales nabotomt. Posisjoner er merket med presisjon i listen. Kart: ${dataset.map.attribution}.</figcaption>
      </figure>
      <div class="map-directory"><div class="map-list-heading"><h3>Anlegg og prosjekter</h3><div><label for="site-sort">Sorter etter</label><select id="site-sort"><option value="mw">Største oppgitte MW</option><option value="name">Navn</option><option value="status">Status</option></select></div></div><ol class="site-list" aria-label="Datasentre">${listMarkup(byMwDesc(sites))}</ol>
        <p class="map-report">Har du ny informasjon eller en rettelse? <a href="${escapeHtml(reportNewSiteUrl())}" target="_blank" rel="noopener noreferrer">Tips oss<span class="sr-only"> (åpnes i ny fane)</span></a>. <small>Innmelding skjer som en sak på GitHub og krever en GitHub-konto. Opplysningene kvalitetssikres mot kildene før de publiseres.</small></p></div>
    </div>
    <details class="map-registry"><summary>Nkom-registeret og operatører uten kartfestet anlegg</summary>
      <p><a href="${dataset.nkom.overviewUrl}">Nkoms oversikt</a>: ${dataset.nkom.registered} registrerte datasentre, inkludert virksomhetsinterne, og ${dataset.nkom.commercialOperators} navngitte kommersielle operatører. Nkom oppgir sist oppdatert ${new Intl.DateTimeFormat('nb-NO', { dateStyle: 'medium', timeZone: 'UTC' }).format(new Date(dataset.nkom.lastUpdated))}. Datasentre og operatører er ulike enheter og skal ikke trekkes fra hverandre. ${dataset.unmappedOperators.length} operatører er ikke koblet til et anlegg i dette utvalget. Forretningsadresser fra Brønnøysund brukes ikke som anleggsposisjoner.</p>
      <p class="map-provenance">Nkom-listen ble hentet <time datetime="${dataset.nkom.fetchedAt}">${timestamp(dataset.nkom.fetchedAt)}</time>. Kartgrunnlaget (CSV, register og geokoder) ble sist endret <time datetime="${dataset.provenance.generatedAt}">${timestamp(dataset.provenance.generatedAt)}</time>. Det er inndata-tidspunkter, ikke verifikasjon av kapasitetstall; se kildedato og gjennomgangsdato ved hvert anlegg.</p>
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