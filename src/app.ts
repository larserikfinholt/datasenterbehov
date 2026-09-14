import '@fontsource-variable/source-sans-3'
import '@fontsource/source-serif-4/latin-400.css'
import '@fontsource/source-serif-4/latin-500.css'
import { createElement, ArrowDown, ArrowUpRight, ChevronDown, ChevronUp } from 'lucide'
import './editorial.css'
import summary from './data/summary.json'
import { CAPACITY_SCENARIO, HIGH_SCENARIO, assessedFirstOrder, factorDisplay, occupationEstimate, referenceWatts, type Occupation, type ReferenceMethod } from './model'

const PROJECT_REPO = 'https://github.com/larserikfinholt/datasenterbehov'
const format = (value: number, decimals = 0) => new Intl.NumberFormat('nb-NO', { minimumFractionDigits: decimals, maximumFractionDigits: decimals }).format(value)
const highMw = summary.equivalentsBeforeAdoption * HIGH_SCENARIO.adoption * referenceWatts('h100') / 1e6
const capacityTotal = CAPACITY_SCENARIO.existing + CAPACITY_SCENARIO.committed + CAPACITY_SCENARIO.planned
const get = <ElementType extends HTMLElement>(selector: string) => document.querySelector<ElementType>(selector)!
const escapeHtml = (value: string) => value.replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]!)

const faq = [
  ['Hvor kommer anslaget på 310 MW fra?', `Fra ${format(summary.knownFte, 2)} kjente årsverk, basisfaktorer per yrke, årsverksvektet interpolasjon, 80 % AI-adopsjon og 640 W per aktiv referansebruker. Det gir ${format(highMw, 2)} MW. Dette er et eksplisitt høyscenario, ikke en prognose eller en dokumentert øvre grense.`],
  ['Hvorfor brukes programvareutviklere som referanse?', 'En tung AI-bruker innen programvareutvikling er en nyttig målestokk for digitalt arbeid. Faktoren 1,00 er en definisjon, ikke en måling av gjennomsnittlig utviklerbruk. Andre yrker sammenlignes med denne referansen.'],
  ['Hvordan behandles yrker uten egen AI-faktor?', `De får det årsverksvektede gjennomsnittet av de 22 vurderte yrkene: ${format(summary.fallback, 5)}. Vi kaller dette interpolasjon, men det er en usikker ekstrapolering til andre yrker. Ukjent betyr ikke null. Manglende årsverk blir ikke fylt inn og inngår ikke i summen.`],
  ['Betyr dette at Norge ikke trenger flere datasentre?', 'Nei. Eksport, annen databehandling, forskning, beredskap og nasjonal kontroll kan begrunne nye datasentre. Poenget er at norske bedrifters AI-bruk alene ikke dokumenterer behovet for den skisserte utbyggingen. Modellen fastslår ikke kundenes geografiske fordeling.'],
  ['Må datakraften norske bedrifter bruker, ligge i Norge?', 'Nei, mange tjenester kan leveres fra utlandet. Krav til sikkerhet, personvern, responstid og beredskap kan likevel gjøre norsk eller europeisk kapasitet viktig. Modellen beregner bruk, ikke hvor datakraften må ligge.'],
  ['Hva er forskjellen på MW i arbeidstiden og årlig energibruk?', `MW er effekt: hvor mye strøm som brukes samtidig. Med antatte ${format(HIGH_SCENARIO.annualHours)} aktive timer blir høyscenarioet omtrent ${format(highMw * HIGH_SCENARIO.annualHours / 1000)} GWh per år, uten tomgang utenom arbeidstid. 310 MW skal derfor ikke uten videre ganges med alle årets 8 760 timer.`],
  ['Hva er ikke inkludert i beregningen?', 'Blant annet modelltrening, privat AI-bruk, tradisjonell sky og lagring, døgnkontinuerlige agenter, kjøling/PUE og tomgang utenom arbeidstid. Selvstendig næringsdrivende og 14 koder uten komplett årsverksgrunnlag mangler. I H100-scenarioet er sluttbrukerutstyr utelatt; Mac-metoden viser lokal enhetseffekt, ikke datasenterlast.'],
  ['Hvor sikre er tallene for planlagte datasentre?', `${format(CAPACITY_SCENARIO.existing)} MW eksisterende, ytterligere ${format(CAPACITY_SCENARIO.committed)} MW under bygging/forpliktet og ytterligere ${format(CAPACITY_SCENARIO.planned)} MW planlagt er foreløpige scenariotall fra oppgavegrunnlaget knyttet til kilderepoet. De er ikke en verifisert prosjektoversikt. Prosjektstatus, dato, effektdefinisjon og eventuell overlapp må kildebelegges før tallene kan tolkes som fakta.`],
]

get<HTMLDivElement>('#app').innerHTML = `
  <a class="skip-link" href="#innhold">Hopp til innhold</a>
  <header class="masthead wrap">
    <a class="wordmark" href="#" aria-label="Datakraftbehov, til toppen"><span class="brand-mark" aria-hidden="true"></span>Datakraftbehov<span class="country"> / Norge</span></a>
    <nav aria-label="Hovedmeny"><a href="#metode">Metoden</a><a href="#yrker">Yrker</a><a href="#sporsmal">Spørsmål</a></nav>
  </header>
  <main id="innhold">
    <article>
      <section class="intro wrap" aria-labelledby="headline">
        <p class="eyebrow">AI OG NORSK ARBEIDSLIV <span>ET ÅPENT REGNESTYKKE</span></p>
        <h1 id="headline">Mer AI krever datakraft.<br>Men hvor mye trenger Norge?</h1>
        <p class="standfirst">Norske bedrifter vil trenge mer datakraft til AI.<br class="desktop-break"> Men langt mindre enn mange tror, gitt antakelsene i dette regnestykket.</p>
        <div class="conclusion">
          <div class="headline-number"><span>${format(highMw)}</span><span class="number-unit">MW<small>i arbeidstiden</small></span></div>
          <p>Et høyt anslag for AI-bruk i norsk arbeidsliv.<br><strong>Omtrent samme størrelsesorden som ett stort datasenter.</strong><small>Et scenario for kjente årsverk, ikke en prognose for hele Norges databehov.</small></p>
        </div>
        <p class="thesis">Stor datasenterutbygging bør derfor begrunnes som <strong>internasjonal datakraftindustri</strong>, ikke tas for gitt som nødvendig for norske bedrifters AI-bruk.</p>
        <a class="text-link jump" href="#sammenligning">Se størrelsesforholdet <span data-icon="down"></span></a>
      </section>
      <section id="sammenligning" class="comparison band" aria-labelledby="comparison-title"><div class="wrap">
        <div class="section-heading"><p class="eyebrow">01 / STØRRELSESFORHOLDET</p><h2 id="comparison-title">Behov er ikke det samme som kapasitet.</h2></div>
        <p class="section-lead">Ett regnestykke for norsk arbeidsliv. Ett foreløpig scenario for datasentre i Norge.</p>
        <figure aria-labelledby="comparison-title" aria-describedby="chart-note">
          <div id="chart" role="img" class="chart">
            <div class="axis-title" aria-hidden="true">MW</div>
            <div class="plot" aria-hidden="true">
              <div id="gridlines"></div>
              <div class="bar-slot demand-slot"><div data-bar="demand" class="bar demand"><span id="demand-label" class="bar-value"></span></div></div>
              <div class="bar-slot capacity-slot"><div data-bar="capacity" class="bar capacity">
                <div data-segment="existing" class="segment existing"><span>${format(CAPACITY_SCENARIO.existing)} MW</span></div>
                <div data-segment="committed" class="segment committed"><span>${format(CAPACITY_SCENARIO.committed)} MW</span></div>
                <div data-segment="planned" class="segment planned"><span>${format(CAPACITY_SCENARIO.planned)} MW</span></div>
                <span class="capacity-total">${format(capacityTotal)} MW totalt</span>
              </div></div>
            </div>
            <div class="bar-labels" aria-hidden="true"><div>Høyt estimert behov<br>i norsk arbeidsliv<small id="chart-scenario">Høyscenario · AI i arbeidstiden</small></div><div>Datasenterkapasitet<br>i Norge<small>Foreløpig kapasitetsscenario</small></div></div>
          </div>
          <ul class="legend" aria-label="Tegnforklaring"><li><span class="swatch demand"></span>Estimert AI-behov</li><li><span class="swatch existing"></span>Eksisterende / faktisk</li><li><span class="swatch committed"></span>Under bygging / forpliktet</li><li><span class="swatch planned"></span>Planlagt / annonsert</li></ul>
          <figcaption id="chart-note"><strong>Foreløpige scenariotall.</strong> ${format(CAPACITY_SCENARIO.existing)} + ${format(CAPACITY_SCENARIO.committed)} + ${format(CAPACITY_SCENARIO.planned)} MW er additive anslag, ikke kildebelagte prosjektdata. Skravering markerer den mest usikre delen. Modellert IT-effekt i arbeidstiden er ikke det samme som nettilknytning, faktisk utnyttelse eller total anleggseffekt. Sammenligningen viser størrelsesorden, ikke ledig kapasitet.</figcaption>
        </figure>
      </div></section>
      <section id="metode" class="wrap article-section" aria-labelledby="method-title">
        <div class="section-heading"><p class="eyebrow">02 / REGNESTYKKET</p><h2 id="method-title">Fire antakelser. Ett synlig regnestykke.</h2></div>
        <p class="formula">årsverk <span>×</span> yrkesfaktor <span>×</span> AI-adopsjon <span>×</span> watt per aktiv referansebruker</p>
        <p class="muted formula-note">Summeres over yrkene. Watt deles på 1 000 000 for å gi MW.</p>
        <div class="method-layout">
          <div><h3>Dette gjør scenarioet høyt</h3><ul class="assumptions">
            <li><strong>80 % AI-adopsjon</strong><span>Et høyt opptak i alle yrker, justert for yrkesfaktor.</span></li>
            <li><strong>640 W per aktiv referansebruker</strong><span>En tung AI-bruker, med bare ti brukere per antatt H100-server.</span></li>
            <li><strong>Basisfaktorer, også for ukjente yrker</strong><span>${format(summary.knownFte, 2)} kjente årsverk. Ukjente faktorer fylles med årsverksvektet snitt: ${format(summary.fallback, 5)}.</span></li>
          </ul></div>
          <div class="reference-control">
            <label for="reference-method">Hvordan anslår vi effekt per aktiv bruker?</label>
            <select id="reference-method" aria-describedby="reference-calculation reference-note"><option value="h100">Delt NVIDIA H100-server</option><option value="mac">Lokal Mac</option><option value="fixed">Fast effekt</option></select>
            <div id="fixed-control" hidden><label for="fixed-watts">Watt per aktiv referansebruker</label><input id="fixed-watts" type="number" inputmode="decimal" min="0" max="10000" step="any" value="640" aria-describedby="input-error"><p id="input-error" class="input-error" role="status"></p></div>
            <p class="reference-value"><output id="watts-value">640</output> <span>W / aktiv referansebruker</span></p><p id="reference-calculation" class="calculation"></p><p id="reference-note" class="muted"></p>
            <div class="result" aria-live="polite" aria-atomic="true"><span>Med valgt metode</span><strong><output id="result-mw"></output> MW</strong><small id="result-calculation"></small></div>
          </div>
        </div>
        <p class="source-line">Årsverk: <a href="https://www.ssb.no/statbank/table/11658/">SSB tabell 11658</a>, gjennomsnitt av kvartalene i 2025. Beregningsprinsipp og basisfaktorer: <a href="${PROJECT_REPO}">Datasenterbehov på GitHub <span data-icon="external"></span></a>.</p>
        <p class="fine-print">Faktorene er scenarioantakelser, ikke observerte målinger.</p>
        <p id="h100-note" class="fine-print">NVIDIA H100-høyscenarioet her antar 8 GPU-er à 700 W, 800 W øvrig servereffekt og 10 samtidige brukere. Oppgitte driftserfaringer med GLM 5.3 Flash de siste ukene viser at serveren med 8 × NVIDIA H100 fint håndterer dobbelt så mange samtidige brukere (20). Regnestykket beholder likevel 10 brukere som en konservativ antakelse. Erfaringen er ikke en standardisert ytelsestest; likeverdig modellkvalitet er ikke verifisert.</p>
      </section>
      <section id="yrker" class="wrap article-section" aria-labelledby="occupations-title">
        <div class="section-heading"><p class="eyebrow">03 / YRKENE BAK TALLET</p><h2 id="occupations-title">En barnehagelærer er ikke en utvikler.</h2></div>
        <p class="section-lead">En barnehagelærer trenger langt mindre AI-datakraft enn en utvikler i modellen. Arbeidets innhold betyr mer enn at begge kan bruke AI.</p>
        <div class="occupation-comparison"><div><span class="occupation-name">Programvareutvikler</span><strong>1,00</strong><p>Referansen. Tung AI-bruk til kode, analyse og testing.</p></div><div><span class="occupation-name">Barnehagelærer</span><strong>0,08</strong><p>Interaksjon og omsorg dominerer, med begrenset AI-bruk i admin og planning.</p></div></div>
        <p class="muted">Barnehagelærerfaktoren er 8 % av utviklerreferansen i basisscenarioet. Det er en antakelse om relativ AI-bruk, ikke om yrkets verdi eller produktivitet.</p>
        <div id="example-table"></div>
        <p class="table-note">Årsverk er en proxy: gjennomsnitt av fire kvartalsvise SSB-observasjoner, ikke antall ansatte. <strong>Interpolert betyr anslått, ikke null.</strong> Bare ${summary.assessedCount} av ${summary.count} koder har vurderte faktorer (${format(summary.assessedFte / summary.knownFte * 100, 1)} % av kjente årsverk). ${summary.missingFteCount} koder mangler komplett årsverksgrunnlag og bidrar ikke til summen.</p>
        <button id="toggle-occupations" class="expand-button" aria-expanded="false" aria-controls="all-occupations"><span id="toggle-label">Vis alle yrker</span><span class="count">407</span><span id="toggle-icon"></span></button><p id="load-status" role="status" class="muted"></p>
        <div id="all-occupations" hidden><div class="search-line"><div><label for="occupation-search">Søk etter yrke eller STYRK-08-kode</label><input id="occupation-search" type="search" placeholder="For eksempel barnehagelærer eller 2342" autocomplete="off"></div><p id="search-count" role="status"></p></div><p class="fine-print">Målt først: de 22 vurderte yrkene. Deretter følger interpolerte yrker i SSB-rekkefølge. Null observerte årsverk er ikke det samme som manglende data.</p><div id="full-table"></div></div>
      </section>
      <section id="sporsmal" class="faq-section band" aria-labelledby="faq-title"><div class="wrap"><div class="section-heading"><p class="eyebrow">04 / SPØRSMÅL OG FORBEHOLD</p><h2 id="faq-title">Hva tallet sier. Og ikke sier.</h2></div><div class="faq">${faq.map(([question, answer]) => `<details><summary>${question}</summary><p>${answer}</p></details>`).join('')}</div></div></section>
      <section class="wrap closing" aria-label="Avslutning"><p>Et norsk datasenter er ikke nødvendigvis<br>et datasenter for norske behov.</p><span>Skillet mellom innenlandsk bruk og eksport er avgjørende. Dette regnestykket belyser skillet, men dokumenterer ikke eksportandelen.</span></section>
    </article>
  </main>
  <footer class="wrap"><div><a class="wordmark" href="#">Datakraftbehov / Norge</a><p>Åpent regnestykke. Synlige antakelser.</p></div><div><a href="${PROJECT_REPO}">Kilder og metode på GitHub <span data-icon="external"></span></a><p>SSB-grunnlag: 2025 · Kilderevisjon: ${summary.sourceCommit.slice(0, 7)}</p></div></footer>
`

document.querySelectorAll('[data-icon]').forEach(element => element.append(createElement(element.getAttribute('data-icon') === 'down' ? ArrowDown : ArrowUpRight, { width: 17, height: 17, 'aria-hidden': 'true' })))
let watts = referenceWatts('h100')
let allRows: Occupation[] | null = null
let expanded = false
const methodControl = get<HTMLSelectElement>('#reference-method')
const fixedInput = get<HTMLInputElement>('#fixed-watts')

function renderChart() {
  const mw = summary.equivalentsBeforeAdoption * HIGH_SCENARIO.adoption * watts / 1e6
  const maximum = Math.ceil(Math.max(capacityTotal, mw) / 500) * 500
  const scale = (value: number) => `${value / maximum * 100}%`
  get('#gridlines').innerHTML = Array.from({ length: 6 }, (_, index) => {
    const value = maximum * index / 5
    return `<div class="gridline" style="bottom:${scale(value)}"><span>${format(value)}</span></div>`
  }).join('')
  const demand = get('[data-bar="demand"]')
  demand.style.height = scale(mw)
  demand.classList.toggle('small', mw / maximum < 0.095)
  get('#demand-label').textContent = `${format(mw)} MW`
  get('[data-bar="capacity"]').style.height = scale(capacityTotal)
  for (const segment of ['existing', 'committed', 'planned'] as const) get(`[data-segment="${segment}"]`).style.height = `${CAPACITY_SCENARIO[segment] / capacityTotal * 100}%`
  get('#chart').setAttribute('aria-label', `To vertikale stolper på samme lineære skala fra 0 til ${maximum} MW. Høyt estimert behov i norsk arbeidsliv med valgt metode: ${format(mw, 2)} MW. Datasenterkapasitet i Norge: eksisterende ${CAPACITY_SCENARIO.existing} MW, ytterligere under bygging eller forpliktet ${CAPACITY_SCENARIO.committed} MW, ytterligere planlagt ${CAPACITY_SCENARIO.planned} MW. Totalt ${capacityTotal} MW. Foreløpige scenariotall.`)
  get('#chart-scenario').textContent = methodControl.value === 'h100' ? 'Høyscenario · AI i arbeidstiden' : methodControl.value === 'mac' ? 'Lokal Mac · ikke datasenterlast' : 'Valgt fast effekt · AI i arbeidstiden'
  get('#result-mw').textContent = format(mw, 1)
  get('#result-calculation').textContent = `${format(summary.knownFte)} × ${format(summary.fallback, 5)} × 80 % × ${format(watts)} W ÷ 1 000 000 ≈ ${format(mw, 1)} MW`
}

function tableMarkup(rows: readonly Occupation[], caption: string, total = false) {
  const dataRows = rows.map(row => {
    const estimate = occupationEstimate(row, summary.fallback, watts)
    const displayFactor = factorDisplay(row, summary.fallback)
    const factor = estimate.effectiveFactor
    return `<tr data-code="${row.code}" data-fte-status="${row.fte === null ? 'missing' : 'observed'}"><th scope="row">${escapeHtml(row.title)}${/^\d{4}$/.test(row.code) ? `<small class="code">${row.code}</small>` : ''}</th><td data-label="Årsverk (SSB)">${row.fte === null ? '<span class="missing">Ukjent</span>' : format(row.fte, 2)}</td><td data-label="AI-faktor">${factor === null ? 'Ukjent' : format(factor, displayFactor.interpolated ? 3 : 2)}</td><td data-label="Grunnlag"><span class="${estimate.interpolated ? 'interpolated' : ''}">${estimate.interpolated ? 'Interpolert' : 'Vurdert'}</span>${row.code === 'other-assessed' ? '<small>vektet snitt</small>' : ''}</td><td data-label="Estimert MW">${estimate.mw === null ? '<span class="missing">Ukjent</span>' : format(estimate.mw, 2)}</td></tr>`
  }).join('')
  return `<table><caption>${caption}</caption><thead><tr><th scope="col">Yrke</th><th scope="col">Årsverk fra SSB</th><th scope="col">AI-faktor</th><th scope="col">Vurdert / interpolert</th><th scope="col">Estimert MW</th></tr></thead><tbody>${dataRows}</tbody>${total ? `<tfoot><tr><th scope="row">Total<small>Kjente årsverk</small></th><td data-label="Årsverk (SSB)">${format(summary.knownFte, 2)}</td><td data-label="AI-faktor">${format(summary.fallback, 3)}</td><td data-label="Grunnlag">Blandet</td><td data-label="Estimert MW">${format(summary.equivalentsBeforeAdoption * HIGH_SCENARIO.adoption * watts / 1e6, 2)}</td></tr></tfoot>` : ''}</table>`
}

function renderFullTable() {
  if (!allRows || !expanded) return
  const normalize = (text: string) => text.toLocaleLowerCase('nb-NO').normalize('NFD').replace(/\p{Diacritic}/gu, '')
  const query = normalize(get<HTMLInputElement>('#occupation-search').value.trim())
  const filtered = allRows.filter(row => normalize(`${row.code} ${row.title}`).includes(query))
  get('#full-table').innerHTML = filtered.length ? tableMarkup(filtered, 'Alle yrker · STYRK-08 · 2025') : '<p class="empty-state">Ingen yrker passer med søket.</p>'
  get('#search-count').textContent = `${filtered.length} av ${summary.count} yrker`
}

function updateReference() {
  const method = methodControl.value as ReferenceMethod
  get('#fixed-control').hidden = method !== 'fixed'
  get('#h100-note').hidden = method !== 'h100'
  if (method === 'fixed' && (fixedInput.value.trim() === '' || !fixedInput.checkValidity() || !Number.isFinite(fixedInput.valueAsNumber))) {
    fixedInput.setAttribute('aria-invalid', 'true')
    get('#input-error').textContent = 'Skriv et tall fra 0 til 10 000 W. Beregningen viser siste gyldige verdi.'
    return
  }
  fixedInput.removeAttribute('aria-invalid')
  get('#input-error').textContent = ''
  watts = referenceWatts(method, fixedInput.valueAsNumber)
  get('#watts-value').textContent = format(watts, Number.isInteger(watts) ? 0 : 2)
  get('#reference-calculation').textContent = method === 'h100' ? '(8 × 700 W + 800 W) ÷ 10 aktive brukere = 640 W' : method === 'mac' ? '200 W per Mac ÷ 1 aktiv bruker = 200 W' : `${format(watts, Number.isInteger(watts) ? 0 : 2)} W × 1 aktiv referansebruker = ${format(watts, Number.isInteger(watts) ? 0 : 2)} W`
  get('#reference-note').textContent = method === 'h100' ? 'Antatt full GPU-effekt og servertillegg fordelt på ti samtidige brukere. Kjøling/PUE er ikke inkludert. Ikke en målt serverprofil.' : method === 'mac' ? 'Illustrativ antakelse om lokal enhetseffekt, ikke målt AI-merforbruk eller samme modellkvalitet som H100. Dette er ikke behov for datasenterkapasitet.' : 'Din antakelse om effekt per aktiv referansebruker. Yrkesfaktorer og 80 % adopsjon er uendret.'
  renderChart()
  get('#example-table').innerHTML = tableMarkup(summary.examples, 'Utvalgte yrker · valgt effektmetode · 80 % AI-adopsjon', true)
  renderFullTable()
}

function updateToggle() {
  get('#toggle-occupations').setAttribute('aria-expanded', String(expanded))
  get('#toggle-label').textContent = expanded ? 'Skjul alle yrker' : 'Vis alle yrker'
  get('#toggle-icon').replaceChildren(createElement(expanded ? ChevronUp : ChevronDown, { width: 18, height: 18, 'aria-hidden': 'true' }))
  get('#all-occupations').hidden = !expanded
}

get('#toggle-occupations').addEventListener('click', async () => {
  const button = get<HTMLButtonElement>('#toggle-occupations')
  if (expanded) { expanded = false; updateToggle(); return }
  button.disabled = true
  get('#load-status').textContent = allRows ? '' : 'Henter yrkesgrunnlaget …'
  try {
    if (!allRows) {
      const response = await fetch(`${import.meta.env.BASE_URL}data/occupations.json`)
      if (!response.ok) throw new Error('Kunne ikke laste yrkesgrunnlaget')
      const loaded: Occupation[] = await response.json()
      if (!Array.isArray(loaded) || loaded.length !== summary.count) throw new Error('Ufullstendig yrkesgrunnlag')
      allRows = assessedFirstOrder(loaded)
    }
    expanded = true
    updateToggle()
    renderFullTable()
    get('#load-status').textContent = ''
  } catch {
    get('#load-status').textContent = 'Yrkesgrunnlaget kunne ikke lastes. Prøv «Vis alle yrker» igjen.'
  } finally { button.disabled = false }
})

methodControl.addEventListener('change', updateReference)
fixedInput.addEventListener('input', updateReference)
get('#occupation-search').addEventListener('input', renderFullTable)
updateToggle()
updateReference()