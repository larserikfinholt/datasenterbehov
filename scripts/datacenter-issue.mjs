// Pure helpers for the datacenter issue flow: parse the issue form, turn it into a proposed CSV change,
// apply it to data/datacenters.csv and render bot comments and PR bodies. No network or GitHub access here.
// Everything that comes from an issue or a web page is untrusted: values are validated against the data model
// and only rendered through the escaping helpers below.
import { createHash } from 'node:crypto'
import { parse } from 'csv-parse/sync'
import { SITE_COLUMNS, parseIsoDate, parseSiteRows, withinNorway } from './datacenter-rows.mjs'

export const SITE_URL = 'https://larserikfinholt.github.io/datasenterbehov/'
export const BOT_LOGIN = 'github-actions[bot]'
export const BRANCH_PREFIX = 'data/issue-'
export const MAX_SOURCE_CHECKS = 3

export const LABELS = {
  data: 'data',
  newSite: 'type: nytt-datasenter',
  correction: 'type: datakorrigering',
  needsInfo: 'status: trenger-info',
  review: 'status: til-vurdering',
  approved: 'status: godkjent',
  prCreated: 'status: pr-opprettet',
  published: 'status: publisert',
}
export const STATUS_LABELS = [LABELS.needsInfo, LABELS.review, LABELS.approved, LABELS.prCreated, LABELS.published]
export const LABEL_DEFINITIONS = [
  { name: LABELS.data, color: 'c5def5', description: 'Innmelding til datasenterkartet' },
  { name: LABELS.newSite, color: '0e8a16', description: 'Forslag om nytt datasenter' },
  { name: LABELS.correction, color: '1d76db', description: 'Rettelse eller tillegg til eksisterende datasenter' },
  { name: LABELS.needsInfo, color: 'fbca04', description: 'Innmeldingen mangler opplysninger eller kilder' },
  { name: LABELS.review, color: 'c2e0c6', description: 'Klar for manuell vurdering av moderator' },
  { name: LABELS.approved, color: '5319e7', description: 'Godkjent av moderator; lager PR. Settes bare manuelt.' },
  { name: LABELS.prCreated, color: 'bfd4f2', description: 'PR med dataendringen er opprettet' },
  { name: LABELS.published, color: '006b75', description: 'Endringen er publisert på nettsiden' },
]

/** Hidden markers that identify the bot's own comments. Only comments written by BOT_LOGIN are trusted. */
export const MARKERS = {
  ack: 'datasenter-bot:takk',
  assessment: 'datasenter-bot:vurdering',
  pr: 'datasenter-bot:pr',
  error: 'datasenter-bot:feil',
  published: 'datasenter-bot:publisert',
  issue: 'datasenter-bot:issue',
  site: 'datasenter-bot:site',
}

/** Field ids and labels in .github/ISSUE_TEMPLATE/data-korreksjon.yml. The labels become `### headings` in the issue body. */
export const FORM_FIELDS = {
  type: 'Hva gjelder innmeldingen?',
  datacenter: 'Datasenter i kartet',
  page_url: 'Lenke til anlegget på nettsiden',
  description: 'Hva bør endres, og hvorfor?',
  name: 'Navn på anlegg eller prosjekt',
  operator: 'Operatør eller utbygger',
  operator_orgnr: 'Organisasjonsnummer for operatøren',
  kommune: 'Kommune',
  place: 'Sted',
  coordinates: 'Koordinater (valgfritt)',
  status: 'Status for anlegget',
  mw_in_use: 'I bruk (MW)',
  mw_reserved: 'Nettreservasjon (MW)',
  mw_planned: 'Planlagt / kapasitet (MW)',
  mw_planned_basis: 'Hva det planlagte tallet beskriver',
  mw_queued: 'Omsøkt / ikke tildelt (MW)',
  power_status: 'Hva tallene betyr',
  sources: 'Kilder',
  confirm: 'Bekreftelse',
}
export const TYPE_OPTIONS = {
  correction: 'Rettelse av eksisterende datasenter',
  supplement: 'Tilleggsinformasjon til eksisterende datasenter',
  newSite: 'Nytt datasenter som mangler',
  other: 'Annet',
}
export const STATUS_OPTIONS = { 'I drift': 'operating', 'Under bygging': 'construction', Planlagt: 'planned' }
export const BASIS_OPTIONS = {
  'IT-kapasitet': 'it_capacity',
  Anleggskapasitet: 'facility_capacity',
  Utbyggingspotensial: 'development_potential',
  'Annonsert kapasitet, udefinert': 'announced_total',
  'Planlagt nettilknytning': 'grid_connection',
}
export const COLUMN_LABELS = {
  id: 'Id', name: 'Navn', operator: 'Operatør', operator_orgnr: 'Org.nr.', kommune: 'Kommune', place: 'Sted',
  lat: 'Breddegrad', lon: 'Lengdegrad', precision: 'Posisjonspresisjon', status: 'Status',
  mw_in_use: 'I bruk (MW)', mw_reserved: 'Nettreservasjon (MW)', mw_planned: 'Planlagt / kapasitet (MW)',
  mw_planned_basis: 'Grunnlag for planlagt', mw_queued: 'Omsøkt / ikke tildelt (MW)', power_status: 'Hva tallene betyr',
  source_urls: 'Kilder', source_dates: 'Kildedatoer', reviewed_at: 'Gjennomgått', note: 'Merknad',
}
const MW_FIELDS = ['mw_in_use', 'mw_reserved', 'mw_planned', 'mw_queued']
const TEXT_FIELDS = { name: 120, operator: 120, kommune: 60, place: 80, power_status: 600 }
const REQUIRED_FOR_NEW = ['name', 'operator', 'kommune', 'place', 'status', 'power_status']
const MAX_SOURCES = 10
const ENERGY_UNIT = /\b(?:[kmgt]wh|kilowattimer|megawattimer|gigawattimer|terawattimer)\b/i

export const normalizeEol = text => String(text ?? '').replace(/\r\n?/g, '\n')
export const bodyHash = body => createHash('sha256').update(normalizeEol(body).trim()).digest('hex').slice(0, 16)
export const siteLink = id => `${SITE_URL}#site-${id}`
export const branchFor = issueNumber => `${BRANCH_PREFIX}${issueNumber}`

/** Lowercase, ASCII-folded text for loose comparisons (æ→ae, ø→o, å→a). */
export function fold(value) {
  return String(value ?? '').toLocaleLowerCase('nb-NO').replace(/æ/g, 'ae').replace(/ø/g, 'o').replace(/å/g, 'a')
    .normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, ' ').trim()
}
export const slugify = value => fold(value).replace(/ /g, '-').slice(0, 48).replace(/-+$/, '') || 'datasenter'

/** Untrusted text as one escaped markdown line: no HTML, no mentions, no tables or links injected. */
export function safeInline(value, max = 200) {
  let text = String(value ?? '').replace(/\s+/g, ' ').trim()
  if (text.length > max) text = `${text.slice(0, max - 1)}…`
  return text.replace(/[\\`*_{}[\]()<>|#~!&]/g, character => `\\${character}`).replace(/@/g, '@\u200b')
}
/** A validated http(s) URL as an autolink. URL#href percent-encodes characters that could break out of `<…>`. */
export const safeUrl = url => `<${new URL(url).href}>`
export const marker = (name, attributes = '') => `<!-- ${name}${attributes ? ` ${attributes}` : ''} -->`
export function markerAttribute(body, name, key) {
  const match = new RegExp(`<!-- ${name}\\b[^>]*\\b${key}=([A-Za-z0-9._-]+)`).exec(body ?? '')
  return match ? match[1] : null
}

/** Splits a rendered issue form into fields. Unknown headings stay part of the previous field; repeated headings are reported. */
export function parseIssueForm(body) {
  const ids = new Map(Object.entries(FORM_FIELDS).map(([id, label]) => [label, id]))
  const fields = {}
  const duplicates = []
  let current = null
  let lines = []
  const flush = () => {
    if (!current) return
    if (current in fields) duplicates.push(current)
    else fields[current] = cleanValue(lines.join('\n'))
  }
  for (const line of normalizeEol(body).split('\n')) {
    const heading = /^###\s+(.+?)\s*$/.exec(line)
    if (heading && ids.has(heading[1])) {
      flush()
      current = ids.get(heading[1])
      lines = []
    } else if (current) lines.push(line)
  }
  flush()
  return { fields, duplicates, isForm: 'type' in fields && 'sources' in fields }
}

function cleanValue(value) {
  let text = value.trim()
  const fenced = /^```[a-z]*\n([\s\S]*?)\n```$/.exec(text)
  if (fenced) text = fenced[1].trim()
  return text === '_No response_' || text === 'None' ? '' : text
}

/** '' means no change, null means set to unknown, a string is a canonical MW number. */
export function parseMwInput(value) {
  const text = String(value ?? '').trim()
  if (!text) return { value: undefined }
  if (/^(ukjent|unknown|-)$/i.test(text)) return { value: null }
  if (ENERGY_UNIT.test(text)) return { error: `«${text}» ser ut som energi. Feltet tar effekt i MW.` }
  const number = text.replace(/\s*(mw|megawatt)$/i, '').replace(/\s/g, '').replace(',', '.')
  if (!/^\d+(\.\d+)?$/.test(number)) return { error: `«${text}» er ikke et tall i MW. Bruk et tall eller «ukjent».` }
  return { value: String(Number(number)) }
}

export function parseSources(text) {
  const sources = []
  const warnings = []
  for (const line of normalizeEol(text).split('\n').map(line => line.trim()).filter(Boolean)) {
    const match = /https?:\/\/[^\s<>"]+/i.exec(line)
    if (!match) {
      warnings.push(`Linjen «${line.slice(0, 80)}» i kildefeltet har ingen lenke og blir ikke brukt.`)
      continue
    }
    let url
    try { url = new URL(match[0].replace(/[).,;>\]]+$/, '')) } catch { warnings.push(`Ugyldig lenke: ${line.slice(0, 80)}`); continue }
    if (!/^https?:$/.test(url.protocol)) continue
    const rest = line.slice(match.index + match[0].length)
    const iso = /(\d{4}-\d{2}-\d{2})/.exec(rest)?.[1] ?? /(\d{1,2})\.(\d{1,2})\.(\d{4})/.exec(rest)?.slice(1).reverse().map(part => part.padStart(2, '0')).join('-') ?? ''
    let date = ''
    try { date = parseIsoDate(iso, url.href) ?? '' } catch { warnings.push(`Datoen ved ${url.href} er ugyldig og blir ikke brukt.`) }
    if (!sources.some(source => source.url === url.href)) sources.push({ url: url.href, date })
  }
  if (sources.length > MAX_SOURCES) {
    warnings.push(`Bare de ${MAX_SOURCES} første kildene blir brukt.`)
    sources.length = MAX_SOURCES
  }
  return { sources, warnings }
}

export function parseCoordinates(value) {
  const text = String(value ?? '').trim()
  if (!text) return { value: undefined }
  const match = /^(-?\d+(?:[.,]\d+)?)\s*[,;\s]\s*(-?\d+(?:[.,]\d+)?)$/.exec(text)
  const lat = match ? Number(match[1].replace(',', '.')) : NaN
  const lon = match ? Number(match[2].replace(',', '.')) : NaN
  if (!withinNorway(lat, lon)) return { error: `Koordinatene «${text}» er ikke breddegrad, lengdegrad i Fastlands-Norge.` }
  return { value: { lat: String(lat), lon: String(lon) } }
}

/** Reads data/datacenters.csv as one record per line so a change only touches its own line. */
export function readCsv(csvText) {
  const eol = csvText.includes('\r\n') ? '\r\n' : '\n'
  const trailing = /\r?\n$/.test(csvText)
  const lines = normalizeEol(csvText).replace(/\n$/, '').split('\n')
  const records = parse(csvText, { skip_empty_lines: true, relax_column_count: false })
  if (records.length !== lines.length) throw new Error('data/datacenters.csv har felt over flere linjer; endringen må gjøres manuelt')
  const header = records[0]
  const rows = records.slice(1).map(values => Object.fromEntries(header.map((column, index) => [column, values[index]])))
  return { eol, trailing, header, lines, rows }
}

export const csvField = value => /[",\r\n]/.test(value) || value !== value.trim() ? `"${value.replace(/"/g, '""')}"` : value
export const csvLine = (header, row) => header.map(column => csvField(row[column] ?? '')).join(',')

/** Finds the existing row an issue refers to: by the id at the start of the field, else by exact name. */
export function findTarget(value, rows) {
  const text = String(value ?? '').trim()
  if (!text) return null
  const id = /^([a-z0-9-]+)(?:\s|·|$)/.exec(text)?.[1]
  return rows.find(row => row.id === id) ?? rows.find(row => fold(row.name) === fold(text) || fold(row.id) === fold(text)) ?? null
}

export function findDuplicates(proposal, rows) {
  if (proposal.kind !== 'new') return []
  const name = fold(proposal.changes.name)
  const tokens = new Set(name.split(' ').filter(token => token.length >= 3))
  const kommune = fold(proposal.changes.kommune)
  const place = fold(proposal.changes.place)
  const operator = fold(proposal.changes.operator)
  const result = []
  for (const row of rows) {
    const rowTokens = new Set(fold(row.name).split(' ').filter(token => token.length >= 3))
    const shared = [...tokens].filter(token => rowTokens.has(token)).length
    const reasons = []
    if (name && (fold(row.name) === name || (shared && shared / Math.min(tokens.size, rowTokens.size) >= 0.5))) reasons.push('likt navn')
    if (kommune && fold(row.kommune) === kommune && place && fold(row.place) === place) reasons.push('samme sted og kommune')
    else if (kommune && fold(row.kommune) === kommune && operator && fold(row.operator).includes(operator.split(' ')[0])) reasons.push('samme operatør i samme kommune')
    if (reasons.length) result.push({ id: row.id, name: row.name, reasons })
  }
  return result
}

/** Turns parsed form fields into a validated change against the current rows. Nothing is guessed: empty means no change. */
export function buildProposal(form, rows) {
  const { fields, duplicates } = form
  const errors = []
  const warnings = []
  if (!form.isForm) errors.push('Innmeldingen følger ikke skjemaet. Bruk skjemaet «Feil eller manglende data».')
  for (const field of duplicates) errors.push(`Feltet «${FORM_FIELDS[field]}» står flere ganger i innmeldingen.`)
  const type = Object.entries(TYPE_OPTIONS).find(([, label]) => label === fields.type)?.[0] ?? (fields.type ? 'other' : null)
  const target = findTarget(fields.datacenter, rows)
  let kind
  if (target) kind = 'update'
  else if (type === 'newSite') kind = 'new'
  else kind = 'other'
  if (type === 'newSite' && target) warnings.push(`Innmeldingen er merket som nytt datasenter, men viser til eksisterende «${target.id}». Den behandles som en endring av dette anlegget.`)
  if (!target && fields.datacenter && type !== 'newSite') errors.push(`Fant ikke «${fields.datacenter.slice(0, 80)}» i kartet. Oppgi id fra kartet, eller velg «${TYPE_OPTIONS.newSite}».`)
  if (kind === 'other' && !fields.datacenter) errors.push(`Oppgi hvilket datasenter innmeldingen gjelder, eller velg «${TYPE_OPTIONS.newSite}».`)

  const changes = {}
  for (const [field, max] of Object.entries(TEXT_FIELDS)) {
    const value = String(fields[field] ?? '').replace(/\s+/g, ' ').trim()
    if (!value) continue
    if (value.length > max) errors.push(`«${FORM_FIELDS[field]}» er lengre enn ${max} tegn.`)
    else changes[field] = value
  }
  const orgnr = String(fields.operator_orgnr ?? '').replace(/\s/g, '')
  if (orgnr && !/^\d{9}$/.test(orgnr)) errors.push('Organisasjonsnummeret må ha 9 siffer.')
  else if (orgnr) changes.operator_orgnr = orgnr
  if (fields.status) {
    if (STATUS_OPTIONS[fields.status]) changes.status = STATUS_OPTIONS[fields.status]
    else errors.push(`Ukjent status «${fields.status.slice(0, 40)}».`)
  }
  for (const field of MW_FIELDS) {
    const parsed = parseMwInput(fields[field])
    if (parsed.error) errors.push(`${FORM_FIELDS[field]}: ${parsed.error}`)
    else if (parsed.value !== undefined) changes[field] = parsed.value ?? ''
  }
  if (fields.mw_planned_basis) {
    if (BASIS_OPTIONS[fields.mw_planned_basis]) changes.mw_planned_basis = BASIS_OPTIONS[fields.mw_planned_basis]
    else errors.push(`Ukjent grunnlag for planlagt kapasitet «${fields.mw_planned_basis.slice(0, 40)}».`)
  }
  if (changes.mw_planned === '') changes.mw_planned_basis = ''
  const planned = changes.mw_planned ?? target?.mw_planned ?? ''
  const basis = changes.mw_planned_basis ?? target?.mw_planned_basis ?? ''
  if (planned && !basis) errors.push(`Oppgi «${FORM_FIELDS.mw_planned_basis}» for det planlagte tallet.`)
  if (!planned && changes.mw_planned_basis) errors.push(`«${FORM_FIELDS.mw_planned_basis}» krever et tall i «${FORM_FIELDS.mw_planned}».`)
  const coordinates = parseCoordinates(fields.coordinates)
  if (coordinates.error) errors.push(coordinates.error)
  else if (coordinates.value) {
    Object.assign(changes, coordinates.value, { precision: 'site' })
    warnings.push('Koordinatene blir registrert som anleggsposisjon. Kontroller at de viser selve anlegget og ikke bare stedet.')
  }

  const parsedSources = parseSources(fields.sources)
  warnings.push(...parsedSources.warnings)
  if (!parsedSources.sources.length) errors.push('Mangler kilde. Legg inn minst én lenke til en offentlig kilde.')
  if (!/\[x\]/i.test(fields.confirm ?? '')) errors.push('Bekreftelsen om at opplysningene kan publiseres er ikke krysset av.')
  if (ENERGY_UNIT.test(fields.description ?? '')) warnings.push('Beskrivelsen nevner energi (kWh/GWh/TWh). Kartet viser bare effekt i MW; energitall kan ikke regnes om til MW uten flere opplysninger.')

  let newSources = parsedSources.sources
  if (kind === 'new') {
    const missing = REQUIRED_FOR_NEW.filter(field => !changes[field])
    if (missing.length) errors.push(`For et nytt datasenter mangler: ${missing.map(field => `«${FORM_FIELDS[field]}»`).join(', ')}.`)
    if (!coordinates.value && changes.place) warnings.push('Posisjonen blir slått opp i Kartverkets stedsnavnregister og vist som omtrentlig stedsposisjon.')
  } else if (target) {
    for (const [column, value] of Object.entries(changes)) if (target[column] === value) delete changes[column]
    const existing = new Set(target.source_urls.split('|'))
    newSources = parsedSources.sources.filter(source => !existing.has(source.url))
    if (!newSources.length && parsedSources.sources.length) warnings.push('Alle kildene er allerede registrert på anlegget.')
    if (!Object.keys(changes).length && !newSources.length && !errors.length) errors.push('Innmeldingen gir ingen endring i dataene: ingen nye verdier og ingen nye kilder.')
  }
  const description = String(fields.description ?? '').trim()
  if (description.length < 10) errors.push('Beskriv kort hva som bør endres og hvorfor.')
  return { kind, type, target, targetId: target?.id ?? null, changes, sources: newSources, description, errors, warnings }
}

/** Applies a proposal to the CSV text. Throws when the result breaks the data model (parseSiteRows). */
export function applyProposal(csvText, proposal, { issueNumber, today }) {
  if (proposal.errors.length) throw new Error(`Innmeldingen har uløste mangler:\n- ${proposal.errors.join('\n- ')}`)
  if (proposal.kind === 'other') throw new Error('Innmeldingen viser ikke til et datasenter og kan ikke oversettes til en dataendring.')
  const { eol, trailing, header, lines, rows } = readCsv(csvText)
  if (header.join(',') !== SITE_COLUMNS.join(',')) throw new Error('Kolonnene i data/datacenters.csv er endret; oppdater datacenter-issue.mjs')
  let before = null
  let after
  let lineIndex
  if (proposal.kind === 'update') {
    const index = rows.findIndex(row => row.id === proposal.targetId)
    if (index < 0) throw new Error(`Fant ikke ${proposal.targetId} i data/datacenters.csv`)
    before = rows[index]
    after = { ...before, ...proposal.changes }
    if (proposal.sources.length) {
      after.source_urls = [before.source_urls, ...proposal.sources.map(source => source.url)].filter(Boolean).join('|')
      after.source_dates = [before.source_dates, ...proposal.sources.map(source => source.date)].join('|')
    }
    lineIndex = index + 1
  } else {
    const ids = new Set(rows.map(row => row.id))
    const base = slugify(proposal.changes.name)
    let id = base
    for (let n = 2; ids.has(id); n++) id = `${base}-${n}`
    after = Object.fromEntries(SITE_COLUMNS.map(column => [column, '']))
    Object.assign(after, { id, precision: 'place' }, proposal.changes, {
      source_urls: proposal.sources.map(source => source.url).join('|'),
      source_dates: proposal.sources.map(source => source.date).join('|'),
      note: `Innmeldt via GitHub-sak #${issueNumber}.`,
    })
    lineIndex = lines.length
  }
  after.reviewed_at = today
  const nextLines = [...lines]
  nextLines[lineIndex] = csvLine(header, after)
  const csv = nextLines.join(eol) + (trailing ? eol : '')
  parseSiteRows(csv)
  return { csv, id: after.id, before, after }
}

/** Changed columns. Source dates are shown together with the source URLs, so they only count as a change of sources. */
export function diffRows(before, after) {
  const changed = SITE_COLUMNS.filter(column => (before?.[column] ?? '') !== (after[column] ?? ''))
  const columns = changed.includes('source_dates') && !changed.includes('source_urls') ? changed.map(column => column === 'source_dates' ? 'source_urls' : column) : changed.filter(column => column !== 'source_dates')
  return columns.map(column => ({ column, label: COLUMN_LABELS[column] }))
}

const optionLabel = (options, value) => Object.entries(options).find(([, code]) => code === value)?.[0]

function cellValue(column, row) {
  const value = row?.[column] ?? ''
  if (value === '') return MW_FIELDS.includes(column) ? '*tom (ukjent)*' : '*tom*'
  if (MW_FIELDS.includes(column)) return `${value.replace('.', ',')} MW`
  if (column === 'status') return `${optionLabel(STATUS_OPTIONS, value) ?? ''} (\`${value}\`)`
  if (column === 'mw_planned_basis') return `${optionLabel(BASIS_OPTIONS, value) ?? ''} (\`${value}\`)`
  if (column === 'source_urls') {
    const dates = row.source_dates.split('|')
    return value.split('|').map((url, index) => `[${index + 1}](${new URL(url).href.replace(/\)/g, '%29')}) ${dates[index] || 'udatert'}`).join('<br>')
  }
  return safeInline(value, 160)
}

export function changeTable(before, after) {
  const rows = before ? diffRows(before, after) : SITE_COLUMNS.filter(column => after[column] && column !== 'source_dates').map(column => ({ column, label: COLUMN_LABELS[column] }))
  if (!rows.length) return '*Ingen endrede felt.*'
  return before
    ? ['| Felt | Før | Etter |', '| --- | --- | --- |', ...rows.map(row => `| ${row.label} | ${cellValue(row.column, before)} | ${cellValue(row.column, after)} |`)].join('\n')
    : ['| Felt | Verdi |', '| --- | --- |', ...rows.map(row => `| ${row.label} | ${cellValue(row.column, after)} |`)].join('\n')
}

/** Finds what a fetched source says about the proposal. Absence is reported as uncertainty, never as an error. */
export function analyzeSourceText(text, proposal) {
  const plain = fold(String(text ?? '').replace(/<(script|style)[\s\S]*?<\/\1>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/&nbsp;|&#160;/g, ' '))
  const names = [proposal.changes.name, proposal.target?.name, proposal.changes.operator ?? proposal.target?.operator, proposal.changes.place ?? proposal.target?.place]
    .filter(Boolean).filter((value, index, all) => all.indexOf(value) === index)
  const mentions = names.filter(name => fold(name) && plain.includes(fold(name)))
  const numbers = MW_FIELDS.filter(field => proposal.changes[field]).map(field => {
    const variants = [...new Set([proposal.changes[field], proposal.changes[field].replace('.', ' ')])].map(variant => variant.replace(/[.]/g, ' '))
    const pattern = variants.map(variant => variant.replace(/ /g, '\\s')).join('|')
    const near = unit => new RegExp(`(?:^|[^0-9 ])\\s?(?:${pattern})\\s?(?:${unit})\\b`).test(plain)
    const found = near('mw|megawatt') ? 'mw' : new RegExp(`(?:^|\\D)(?:${pattern})(?:\\D|$)`).test(plain) ? 'number' : 'missing'
    return { field, value: proposal.changes[field], found, energy: near('[kmgt]wh') }
  })
  return { mentions, missingNames: names.filter(name => !mentions.includes(name)), numbers }
}

function sourceLine(check) {
  const url = safeUrl(check.url)
  if (check.status !== 'ok') return `- ${url}: ${check.note ?? 'ikke tilgjengelig'}. Regnes som usikkerhet, ikke som feil.`
  const parts = []
  if (check.analysis) {
    const { mentions, missingNames, numbers } = check.analysis
    if (mentions.length) parts.push(`nevner ${mentions.map(name => `«${safeInline(name, 60)}»`).join(', ')}`)
    if (missingNames.length) parts.push(`fant ikke ${missingNames.map(name => `«${safeInline(name, 60)}»`).join(', ')}`)
    for (const number of numbers) {
      const label = `${COLUMN_LABELS[number.field].replace(' (MW)', '')} ${number.value.replace('.', ',')} MW`
      parts.push(number.found === 'mw' ? `fant ${label}` : number.found === 'number' ? `fant tallet for ${label}, men ikke sammen med MW` : `fant ikke tallet for ${label}`)
      if (number.energy) parts.push(`tallet ${number.value.replace('.', ',')} står også sammen med en energienhet (Wh)`)
    }
  }
  if (check.note) parts.push(check.note)
  return `- ${url}: tilgjengelig${parts.length ? `; ${parts.join('; ')}` : ''}.`
}

export const ACK_BODY = `${marker(MARKERS.ack)}
Takk for at du tok deg tid til å bidra! Vi kvalitetssikrer opplysningene før eventuell publisering. Hvis vi trenger mer informasjon, spør vi her. Du får også beskjed her når endringen er publisert, med lenke til oversikten.`

export function assessmentStatus(proposal) {
  return proposal.errors.length ? LABELS.needsInfo : LABELS.review
}

export function assessmentBody({ proposal, preview, previewError, duplicates = [], relatedIssues = [], sourceChecks = [], hash, reapproval = false, checkedAt }) {
  const target = proposal.target
  const subject = proposal.kind === 'update'
    ? `Eksisterende datasenter \`${target.id}\` (${safeInline(target.name, 80)}), ${safeUrl(siteLink(target.id))}`
    : proposal.kind === 'new' ? `Nytt datasenter «${safeInline(proposal.changes.name ?? 'uten navn', 80)}»` : 'Uklart hvilket datasenter innmeldingen gjelder'
  const ready = !proposal.errors.length && !previewError
  const sections = [
    `${marker(MARKERS.assessment, `sha=${hash}`)}`,
    '### Automatisk førstevurdering',
    'Dette er en maskinell sjekk, ikke en godkjenning. En moderator kontrollerer opplysningene mot kildene før noe publiseres.',
  ]
  if (reapproval) sections.push('> **Innmeldingen er endret etter godkjenning.** Godkjenningen og en eventuell PR er trukket tilbake. Det endrede innholdet må godkjennes på nytt.')
  sections.push(`**Gjelder:** ${subject}\n**Vurdering:** ${ready ? 'Klar for manuell vurdering.' : 'Trenger mer informasjon.'}`)
  const problems = [...proposal.errors]
  if (previewError) problems.push(`Endringen gir en ugyldig rad i datafilen: ${previewError}`)
  if (problems.length) sections.push(`#### Må avklares\n${problems.map(problem => `- ${safeInline(problem, 300)}`).join('\n')}\n\nRett opp ved å redigere innmeldingen. Vurderingen oppdateres da automatisk.`)
  if (preview) sections.push(`#### Foreslått endring\n${changeTable(preview.before, preview.after)}\n\n${preview.before ? '' : 'Id og posisjon kan justeres i PR-en før publisering. '}«Gjennomgått» settes til datoen for godkjenning.`)
  if (proposal.description) sections.push(`#### Innsenders begrunnelse\n> ${safeInline(proposal.description, 600)}`)
  const sources = proposal.kind === 'update' && !proposal.sources.length ? [] : sourceChecks
  sections.push(`#### Kilder (inntil ${MAX_SOURCE_CHECKS} sjekket automatisk)\n${sources.length ? sources.map(sourceLine).join('\n') : '*Ingen nye kilder å sjekke.*'}\n\nSjekken leser bare sideteksten og ser etter navn og tall. Den kan ikke bekrefte at kilden faktisk støtter påstanden.`)
  const uncertainty = [...proposal.warnings]
  if (proposal.changes.mw_planned && !proposal.changes.mw_planned_basis && proposal.target?.mw_planned_basis) uncertainty.push('Det planlagte tallet beholder dagens grunnlag. Kontroller at kilden beskriver samme type kapasitet.')
  if (uncertainty.length) sections.push(`#### Usikkerhet\n${uncertainty.map(item => `- ${safeInline(item, 300)}`).join('\n')}`)
  const related = [...duplicates.map(item => `- Mulig duplikat i kartet: \`${item.id}\` (${safeInline(item.name, 80)}): ${item.reasons.join(', ')}`), ...relatedIssues.map(issue => `- Annen åpen innmelding om samme anlegg: #${Number(issue.number)}`)]
  if (related.length) sections.push(`#### Mulige duplikater\n${related.join('\n')}`)
  sections.push(`<sub>Moderator: kontroller kildene, rett eventuelt feltene i innmeldingen, og sett etiketten \`${LABELS.approved}\` for å lage en PR. Sist vurdert ${checkedAt}.</sub>`)
  return sections.join('\n\n')
}

export function pullRequestTitle(issueNumber, applied) {
  return `Data: ${applied.before ? 'oppdater' : 'legg til'} ${applied.id} (#${issueNumber})`
}

export function pullRequestBody({ issueNumber, proposal, applied, hash, approvedBy, runUrl }) {
  const sources = applied.after.source_urls.split('|').map((url, index) => {
    const date = applied.after.source_dates.split('|')[index]
    const isNew = proposal.sources.some(source => source.url === url)
    return `- ${safeUrl(url)} (${date || 'udatert'})${isNew ? ' **ny**' : ''}`
  })
  const uncertainty = [...proposal.warnings]
  if (!proposal.sources.some(source => source.date)) uncertainty.push('Ingen av de nye kildene har oppgitt publiseringsdato.')
  return [
    marker(MARKERS.issue, `issue=${issueNumber} sha=${hash}`),
    marker(MARKERS.site, `site=${applied.id}`),
    `Dataendring fra innmelding #${issueNumber}, godkjent av @${approvedBy}. ${applied.before ? `Oppdaterer \`${applied.id}\`.` : `Legger til nytt datasenter \`${applied.id}\`.`}`,
    `**Begrunnelse fra innsender:**\n> ${safeInline(proposal.description, 600)}`,
    `### ${applied.before ? 'Før og etter' : 'Ny rad'}\n${changeTable(applied.before, applied.after)}`,
    `### Kilder\n${sources.join('\n')}`,
    uncertainty.length ? `### Usikkerhet\n${uncertainty.map(item => `- ${safeInline(item, 300)}`).join('\n')}` : '',
    `### Kontroll\n- Validering, datapipeline, enhetstester, bygg og e2e-test av kartet kjørte i ${runUrl}.\n- Forhåndsvisning: skjermbilder av kartet (desktop og mobil) ligger som artefakt \`kart-forhandsvisning\` på samme kjøring.\n- Merge gjøres manuelt. Saken #${issueNumber} får beskjed og lukkes først når GitHub Pages er publisert.`,
    'Endres innmeldingen etter godkjenning, lukkes denne PR-en og endringen må godkjennes på nytt.',
  ].filter(Boolean).join('\n\n')
}

export function publishedBody(siteId) {
  return `${marker(MARKERS.published, `site=${siteId}`)}
Endringen er publisert. Se datasenteret i oversikten: ${safeUrl(siteLink(siteId))}

Takk for bidraget!`
}
