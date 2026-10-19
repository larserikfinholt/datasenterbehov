import { createHash } from 'node:crypto'
import { load } from 'cheerio'
import { parse } from 'csv-parse/sync'

export const SITE_URL = 'https://larserikfinholt.github.io/datasenterbehov/'
export const BOT_LOGIN = 'github-actions[bot]'
export const MAX_SOURCE_CHECKS = 3

export const LABELS = {
  data: 'data',
  needsInfo: 'status: trenger-info',
  review: 'status: til-vurdering',
  prCreated: 'status: pr-opprettet',
  published: 'status: publisert',
}
export const STATUS_LABELS = [LABELS.needsInfo, LABELS.review, LABELS.prCreated, LABELS.published]
export const LABEL_DEFINITIONS = [
  { name: LABELS.data, color: 'c5def5', description: 'Innmelding til datasenterkartet' },
  { name: LABELS.needsInfo, color: 'fbca04', description: 'Innmeldingen mangler en beskrivelse' },
  { name: LABELS.review, color: 'c2e0c6', description: 'Klar for manuell vurdering av moderator' },
  { name: LABELS.prCreated, color: 'bfd4f2', description: 'En PR er knyttet til innmeldingen; venter på publisering' },
  { name: LABELS.published, color: '006b75', description: 'Endringen er publisert på nettsiden' },
]

/** Hidden markers that identify the bot's own comments. Only comments written by BOT_LOGIN are trusted. */
export const MARKERS = {
  ack: 'datasenter-bot:takk',
  assessment: 'datasenter-bot:vurdering',
  pr: 'datasenter-bot:pr',
  published: 'datasenter-bot:publisert',
}

/** Field ids and labels in .github/ISSUE_TEMPLATE/data-korreksjon.yml. The labels become `### headings` in the issue body. */
export const FORM_FIELDS = {
  description: 'Beskrivelse',
}
const MAX_SOURCES = 10

export const normalizeEol = text => String(text ?? '').replace(/\r\n?/g, '\n')
export const bodyHash = body => createHash('sha256').update(normalizeEol(body).trim()).digest('hex').slice(0, 16)
export const siteLink = id => `${SITE_URL}#site-${id}`

/** Lowercase, ASCII-folded text for loose comparisons (æ→ae, ø→o, å→a). */
export function fold(value) {
  return String(value ?? '').toLocaleLowerCase('nb-NO').replace(/æ/g, 'ae').replace(/ø/g, 'o').replace(/å/g, 'a')
    .normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, ' ').trim()
}

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

export function parseIssueForm(body) {
  const text = normalizeEol(body).trim()
  const isForm = /^### Beskrivelse\s*\n/.test(text)
  return { fields: { description: cleanValue(isForm ? text.replace(/^### Beskrivelse\s*\n/, '') : text) }, isForm }
}

function cleanValue(value) {
  let text = value.trim()
  const fenced = /^```[a-z]*\n([\s\S]*?)\n```$/.exec(text)
  if (fenced) text = fenced[1].trim()
  return text === '_No response_' || text === 'None' ? '' : text
}

export function parseSources(text) {
  const sources = []
  const warnings = []
  for (const match of normalizeEol(text).matchAll(/https?:\/\/[^\s<>"`]+/gi)) {
    let value = match[0].replace(/[.,;!?:\]>]+$/, '')
    while (value.endsWith(')') && (value.match(/\)/g)?.length ?? 0) > (value.match(/\(/g)?.length ?? 0)) value = value.slice(0, -1)
    let url
    try { url = new URL(value) } catch { warnings.push('En lenke kunne ikke leses. Moderator kan kontrollere den manuelt.'); continue }
    if (url.username || url.password) { warnings.push('En lenke med påloggingsinformasjon blir ikke hentet.'); continue }
    if (!sources.some(source => source.url === url.href)) sources.push({ url: url.href })
  }
  if (sources.length > MAX_SOURCES) {
    warnings.push(`Bare de ${MAX_SOURCES} første kildene blir brukt.`)
    sources.length = MAX_SOURCES
  }
  return { sources, warnings }
}

export function readCsv(csvText) {
  return { rows: parse(csvText, { columns: true, skip_empty_lines: true }) }
}

export function humanComments(comments) {
  return comments.filter(comment => comment.user?.type === 'User' && comment.user.login !== BOT_LOGIN && !comment.user.login.endsWith('[bot]'))
}

export function reportHash(issue, comments) {
  return bodyHash(JSON.stringify([issue.title, normalizeEol(issue.body), humanComments(comments).map(comment => [comment.id, normalizeEol(comment.body)])]))
}

export function findCandidates(text, rows) {
  const plain = ` ${fold(text)} `
  const mentions = value => fold(value).length >= 4 && plain.includes(` ${fold(value)} `)
  return rows.map(row => {
    const reasons = []
    if (mentions(row.id) || mentions(row.name)) reasons.push('navn eller id er nevnt')
    if (row.source_urls?.split('|').some(url => url && text.includes(url))) reasons.push('samme kildelenke')
    if (mentions(row.place)) reasons.push('sted er nevnt')
    if (mentions(row.kommune)) reasons.push('kommune er nevnt')
    return { id: row.id, name: row.name, reasons }
  }).filter(item => item.reasons.length).sort((left, right) => right.reasons.length - left.reasons.length).slice(0, 5)
}

export function buildProposal(form, rows, { title = '', comments = [] } = {}) {
  const description = form.fields.description ?? ''
  const discussion = humanComments(comments).map(comment => comment.body ?? '')
  const text = [title, description, ...discussion].join('\n\n')
  const parsedSources = parseSources(text)
  const errors = []
  if (![description, ...discussion].some(value => value.trim())) errors.push('Legg inn en kort beskrivelse, her eller i en kommentar.')
  return {
    text, description, sources: parsedSources.sources, candidates: findCandidates(text, rows),
    errors, warnings: parsedSources.warnings, manualReview: true,
  }
}

export function analyzeSourceText(html, baseUrl) {
  const document = load(html)
  document('script, style, nav, footer, header').remove()
  const title = document('h1').first().text().trim() || document('title').text().trim()
  const date = document('meta[property="article:published_time"], meta[name="date"], time[datetime]').first()
  const reportedDate = date.attr('content') || date.attr('datetime') || ''
  const documents = []
  document('a[href]').each((_, element) => {
    let url
    try { url = new URL(document(element).attr('href'), baseUrl) } catch { return }
    if (!/^https?:$/.test(url.protocol) || url.username || url.password || !/\.pdf$/i.test(url.pathname)) return
    if (documents.length < 5 && !documents.some(item => item.url === url.href)) {
      documents.push({ url: url.href, title: document(element).text().trim() || 'Dokument' })
    }
  })
  const text = (document('main, article').first().text() || document('body').text()).replace(/\s+/g, ' ').trim()
  return { title, reportedDate, documents, text }
}

function sourceLine(check) {
  const url = safeUrl(check.url)
  if (check.status !== 'ok') return `- ${url}: ${safeInline(check.note ?? 'kunne ikke hentes')}. Kontrolleres manuelt.`
  const parts = ['tilgjengelig']
  if (check.analysis?.title) parts.push(`«${safeInline(check.analysis.title, 160)}»`)
  if (check.analysis?.reportedDate) parts.push(`dato oppgitt på siden: ${safeInline(check.analysis.reportedDate, 40)}`)
  if (check.note) parts.push(check.note)
  const documents = (check.analysis?.documents ?? []).map(item => `  - ${safeInline(item.title, 100)}: ${safeUrl(item.url)} (ikke innholdskontrollert)`)
  return [`- ${url}: ${parts.join('; ')}.`, ...documents].join('\n')
}

export const ACK_BODY = `${marker(MARKERS.ack)}
Takk for tipset! Vi sjekker opplysningene før eventuell publisering og spør her hvis noe må avklares. Du får beskjed her når en tilknyttet endring er publisert.`

export function assessmentStatus(proposal) {
  return proposal.errors.length ? LABELS.needsInfo : LABELS.review
}

export function assessmentBody({ proposal, candidates = proposal.candidates, relatedIssues = [], sourceChecks = [], hash, issueNumber, checkedAt }) {
  const sections = [
    marker(MARKERS.assessment, `sha=${hash}`),
    '### Automatisk oversikt',
    proposal.errors.length ? proposal.errors.join('\n') : 'Tipset er klart for manuell vurdering. Du trenger ikke vite om det gjelder et nytt eller eksisterende datasenter.',
  ]
  if (sourceChecks.length) sections.push(`#### Kilder\n${sourceChecks.map(sourceLine).join('\n')}`)
  else sections.push('Ingen kildelenker funnet. Det er ikke til hinder for at en moderator vurderer tipset.')
  const unchecked = proposal.sources.length - sourceChecks.length
  if (unchecked > 0) sections.push(`${unchecked} flere lenker er ikke hentet automatisk; de finnes i innmeldingen eller kommentarene.`)
  if (proposal.warnings.length) sections.push(proposal.warnings.map(item => `- ${safeInline(item, 200)}`).join('\n'))
  const details = [
    ...candidates.map(item => `- Mulig anlegg: ${safeInline(item.name, 80)}, ${safeUrl(siteLink(item.id))} (${item.reasons.join(', ')}).`),
    ...relatedIssues.map(issue => `- Mulig relatert innmelding: #${Number(issue.number)}.`),
    'Treff er forslag, ikke bekreftet identitet. Kildenes innhold og eventuelle tall må kontrolleres manuelt.',
    'Vil du undersøke tipset videre? Tildel saken til Copilot under Assignees på GitHub, eller behandle den selv. Tildeling starter arbeidet, men er ikke en godkjenning av opplysningene. Ingen godkjenningsetikett trengs.',
    `Dataendringer foreslås i en PR med \`Innmelding: #${issueNumber}\` på en egen linje utenfor kodeblokk i PR-beskrivelsen. Legg eventuelt til \`Datasenter: <id>\` for direkte lenke etter publisering. Ikke bruk «Fixes», «Closes» eller «Resolves»; saken lukkes etter vellykket publisering.`,
    'Når Copilot har startet, gis videre instruksjoner med @copilot i PR-en. Nye kommentarer her oppdaterer kildeoversikten, men sendes ikke automatisk videre til skyagenten.',
    `Vurderingen inkluderer kommentarer fra personer. Kontroller siste opplysninger før merge. Sist vurdert ${checkedAt}.`,
  ]
  sections.push(`<details>\n<summary>For moderator</summary>\n\n${details.join('\n\n')}\n\n</details>`)
  return sections.join('\n\n')
}

export function parsePullLinks(body) {
  const text = normalizeEol(body).replace(/^(`{3,}|~{3,})[^\n]*\n[\s\S]*?^\1[^\n]*$/gm, '')
  const issues = [...text.matchAll(/^Innmelding:[ \t]*#([1-9]\d*)[ \t]*$/gmi)].map(match => Number(match[1])).filter(Number.isSafeInteger)
  const sites = [...text.matchAll(/^Datasenter:[ \t]*([a-z0-9]+(?:-[a-z0-9]+)*)[ \t]*$/gm)].map(match => match[1])
  return { issues: [...new Set(issues)], sites: [...new Set(sites)] }
}

export function isPublishRun(run, defaultBranch) {
  return run?.conclusion === 'success' && ['push', 'workflow_dispatch'].includes(run.event) && run.head_branch === defaultBranch
}

export function includesMerge(comparison) {
  return ['ahead', 'identical'].includes(comparison?.status)
}

export function publishedBody(siteIds = []) {
  const links = siteIds.length ? siteIds.map(id => safeUrl(siteLink(id))).join('\n') : safeUrl(`${SITE_URL}#kart`)
  return `${marker(MARKERS.published)}\nEndringen er publisert. Se oversikten:\n${links}\n\nTakk for bidraget!`
}
