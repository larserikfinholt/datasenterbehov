// GitHub side of the datacenter issue flow. Run from the workflows in .github/workflows/datasenter-*.yml:
//   labels          create missing labels
//   triage          acknowledge and assess a new or edited issue
//   approve-prepare check the moderator, apply the approved issue to data/datacenters.csv
//   approve-verify  run pipeline, tests, build and e2e; keep the tail of a failing step for the issue comment
//   approve-finish  open or update the PR and report it in the issue
//   approve-failed  explain a failed approval run in the issue
//   published       after a successful Pages deploy: tell the reporter, label and close the issue
// Issue text and fetched pages are untrusted input. They are parsed by datacenter-issue.mjs and never executed or
// interpolated into shell commands.
import { spawnSync } from 'node:child_process'
import { lookup } from 'node:dns/promises'
import { appendFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs'
import { isIP } from 'node:net'
import { join } from 'node:path'
import {
  ACK_BODY, BOT_LOGIN, LABELS, LABEL_DEFINITIONS, MARKERS, MAX_SOURCE_CHECKS, SITE_URL, STATUS_LABELS,
  analyzeSourceText, applyProposal, assessmentBody, assessmentStatus, bodyHash, branchFor, buildProposal, findDuplicates,
  findTarget, fold, marker, markerAttribute, parseIssueForm, publishedBody, pullRequestBody, pullRequestTitle, readCsv, siteLink,
} from './datacenter-issue.mjs'

const CSV_PATH = 'data/datacenters.csv'
const repo = process.env.GITHUB_REPOSITORY
const token = process.env.GITHUB_TOKEN
const prToken = process.env.PR_TOKEN || token
const runUrl = `${process.env.GITHUB_SERVER_URL ?? 'https://github.com'}/${repo}/actions/runs/${process.env.GITHUB_RUN_ID}`
const temp = process.env.RUNNER_TEMP ?? '.'
const statePath = join(temp, 'datasenter-bot-state.json')
const errorPath = join(temp, 'datasenter-bot-error.md')
const event = process.env.GITHUB_EVENT_PATH ? JSON.parse(readFileSync(process.env.GITHUB_EVENT_PATH, 'utf8')) : {}
const today = () => new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Oslo' }).format(new Date())

async function api(path, { method = 'GET', body, auth = token, allow404 = false } = {}) {
  const response = await fetch(`https://api.github.com${path}`, {
    method,
    headers: { authorization: `Bearer ${auth}`, accept: 'application/vnd.github+json', 'x-github-api-version': '2022-11-28', 'user-agent': 'datasenterbehov-bot' },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  if (allow404 && response.status === 404) return null
  if (!response.ok) throw new Error(`GitHub API ${method} ${path}: ${response.status} ${(await response.text()).slice(0, 300)}`)
  return response.status === 204 ? null : response.json()
}

async function paginate(path) {
  const result = []
  for (let page = 1; ; page++) {
    const items = await api(`${path}${path.includes('?') ? '&' : '?'}per_page=100&page=${page}`)
    result.push(...items)
    if (items.length < 100) return result
  }
}

const issuePath = number => `/repos/${repo}/issues/${number}`
const getIssue = number => api(issuePath(number))
const botComments = async number => (await paginate(`${issuePath(number)}/comments`)).filter(comment => comment.user?.login === BOT_LOGIN)
const findComment = (comments, name) => comments.find(comment => comment.body?.includes(`<!-- ${name}`))

async function upsertComment(number, comments, name, body) {
  const existing = findComment(comments, name)
  if (existing) {
    if (existing.body !== body) await api(`/repos/${repo}/issues/comments/${existing.id}`, { method: 'PATCH', body: { body } })
    return existing
  }
  return api(`${issuePath(number)}/comments`, { method: 'POST', body: { body } })
}

async function deleteComment(comments, name) {
  const existing = findComment(comments, name)
  if (existing) await api(`/repos/${repo}/issues/comments/${existing.id}`, { method: 'DELETE' })
}

async function setLabels(issue, { add = [], remove = [] }) {
  const current = new Set(issue.labels.map(label => typeof label === 'string' ? label : label.name))
  const toAdd = add.filter(label => !current.has(label))
  if (toAdd.length) await api(`${issuePath(issue.number)}/labels`, { method: 'POST', body: { labels: toAdd } })
  for (const label of remove.filter(label => current.has(label) && !add.includes(label))) {
    await api(`${issuePath(issue.number)}/labels/${encodeURIComponent(label)}`, { method: 'DELETE', allow404: true })
  }
}

const hasLabel = (issue, name) => issue.labels.some(label => (typeof label === 'string' ? label : label.name) === name)

async function ensureLabels() {
  const existing = new Set((await paginate(`/repos/${repo}/labels`)).map(label => label.name))
  for (const label of LABEL_DEFINITIONS.filter(label => !existing.has(label.name))) {
    await api(`/repos/${repo}/labels`, { method: 'POST', body: label })
    console.log(`Opprettet etikett ${label.name}`)
  }
}

async function findPull(number, state = 'open') {
  const owner = repo.split('/')[0]
  const pulls = await api(`/repos/${repo}/pulls?state=${state}&head=${encodeURIComponent(`${owner}:${branchFor(number)}`)}&per_page=100`)
  return pulls
}

function setOutput(name, value) {
  if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `${name}=${value}\n`)
}

// ---- Source check -------------------------------------------------------------------------------------------------

function privateAddress(address) {
  if (isIP(address) === 4) {
    const [a, b] = address.split('.').map(Number)
    return a === 0 || a === 10 || a === 127 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127) || a >= 224
  }
  const lower = address.toLowerCase()
  return lower === '::' || lower === '::1' || lower.startsWith('fc') || lower.startsWith('fd') || lower.startsWith('fe80') || lower.startsWith('::ffff:')
}

async function assertPublicHost(url) {
  if (!/^https?:$/.test(url.protocol) || url.username || url.password) throw new Error('lenken er ikke en vanlig http(s)-adresse')
  const host = url.hostname.replace(/^\[|\]$/g, '')
  if (host === 'localhost' || /\.(local|internal|localhost)$/i.test(host)) throw new Error('lenken peker til en intern adresse')
  const addresses = isIP(host) ? [{ address: host }] : await lookup(host, { all: true })
  if (addresses.some(({ address }) => privateAddress(address))) throw new Error('lenken peker til en intern adresse')
}

async function readLimited(response, limit = 1_000_000) {
  const reader = response.body?.getReader()
  if (!reader) return ''
  const chunks = []
  let size = 0
  while (size < limit) {
    const { done, value } = await reader.read()
    if (done) break
    chunks.push(value)
    size += value.length
  }
  await reader.cancel().catch(() => {})
  return new TextDecoder('utf-8', { fatal: false }).decode(Buffer.concat(chunks).subarray(0, limit))
}

/** Fetches one source with timeout, size cap and manual redirects. A failure is returned as uncertainty, not thrown. */
async function checkSource(source, proposal) {
  let url = new URL(source.url)
  const signal = AbortSignal.timeout(8000)
  try {
    for (let redirects = 0; ; redirects++) {
      await assertPublicHost(url)
      const response = await fetch(url, { redirect: 'manual', signal, headers: { 'user-agent': 'datasenterbehov-kildesjekk (+https://github.com/larserikfinholt/datasenterbehov)', accept: 'text/html,text/plain;q=0.9,*/*;q=0.5' } })
      if (response.status >= 300 && response.status < 400 && response.headers.get('location')) {
        if (redirects >= 3) return { url: source.url, status: 'error', note: 'for mange videresendinger' }
        await response.body?.cancel()
        url = new URL(response.headers.get('location'), url)
        continue
      }
      if (!response.ok) {
        await response.body?.cancel()
        return { url: source.url, status: 'error', note: `svarte med HTTP ${response.status}` }
      }
      const type = response.headers.get('content-type') ?? ''
      if (/pdf/i.test(type) || /\.pdf$/i.test(url.pathname)) {
        await response.body?.cancel()
        return { url: source.url, status: 'ok', note: 'PDF, innholdet er ikke kontrollert automatisk' }
      }
      if (!/text\/|html|xml|json/i.test(type)) {
        await response.body?.cancel()
        return { url: source.url, status: 'ok', note: 'filtypen er ikke kontrollert automatisk' }
      }
      const text = await readLimited(response)
      return { url: source.url, status: 'ok', analysis: analyzeSourceText(text, proposal), note: text.length < 2000 ? 'lite tekst på siden; den kan være skriptbasert eller kreve innlogging' : undefined }
    }
  } catch (error) {
    const note = error.name === 'TimeoutError' ? 'svarte ikke innen 8 sekunder' : error.message?.startsWith('lenken') ? error.message : 'kunne ikke hentes'
    return { url: source.url, status: 'error', note }
  }
}

// ---- Commands -----------------------------------------------------------------------------------------------------

function loadCsv() {
  const text = readFileSync(CSV_PATH, 'utf8')
  return { text, rows: readCsv(text).rows }
}

async function relatedIssues(issue, proposal, rows) {
  const open = (await paginate(`/repos/${repo}/issues?state=open&labels=${encodeURIComponent(LABELS.data)}`)).filter(item => !item.pull_request && item.number !== issue.number)
  return open.filter(item => {
    const form = parseIssueForm(item.body)
    const target = findTarget(form.fields.datacenter, rows)
    if (proposal.targetId) return target?.id === proposal.targetId
    return proposal.kind === 'new' && fold(form.fields.name) && fold(form.fields.name) === fold(proposal.changes.name)
  }).slice(0, 5)
}

async function triage() {
  const number = event.issue?.number ?? Number(process.env.ISSUE_NUMBER)
  const issue = await getIssue(number)
  if (issue.pull_request || issue.state !== 'open') return console.log('Ikke en åpen sak; hopper over')
  const form = parseIssueForm(issue.body)
  if (!form.isForm && !hasLabel(issue, LABELS.data)) return console.log('Ikke en datainnmelding; hopper over')
  await ensureLabels()
  let comments = await botComments(number)
  if (!findComment(comments, MARKERS.ack)) await api(`${issuePath(number)}/comments`, { method: 'POST', body: { body: ACK_BODY } })

  const hash = bodyHash(issue.body)
  const previous = findComment(comments, MARKERS.assessment)
  const previousHash = markerAttribute(previous?.body, MARKERS.assessment, 'sha')
  if (previousHash === hash && !process.env.FORCE) return console.log('Innholdet er uendret siden siste vurdering')
  const reapproval = Boolean(previousHash) && (hasLabel(issue, LABELS.approved) || hasLabel(issue, LABELS.prCreated))
  if (reapproval) {
    for (const pull of await findPull(number)) {
      await api(`/repos/${repo}/issues/${pull.number}/comments`, { method: 'POST', body: { body: `Innmelding #${number} er endret etter godkjenning. PR-en lukkes; det endrede innholdet må godkjennes på nytt.` } })
      await api(`/repos/${repo}/pulls/${pull.number}`, { method: 'PATCH', body: { state: 'closed' }, auth: prToken })
    }
    await deleteComment(comments, MARKERS.pr)
  }

  const csv = loadCsv()
  const proposal = buildProposal(form, csv.rows)
  let preview = null
  let previewError = null
  if (!proposal.errors.length && proposal.kind !== 'other') {
    try { preview = applyProposal(csv.text, proposal, { issueNumber: number, today: today() }) } catch (error) { previewError = error.message }
  }
  const sources = proposal.sources.slice(0, MAX_SOURCE_CHECKS)
  const sourceChecks = await Promise.all(sources.map(source => checkSource(source, proposal)))
  const body = assessmentBody({
    proposal, preview, previewError, hash, reapproval, sourceChecks, checkedAt: today(),
    duplicates: findDuplicates(proposal, csv.rows), relatedIssues: await relatedIssues(issue, proposal, csv.rows),
  })
  comments = await botComments(number)
  await upsertComment(number, comments, MARKERS.assessment, body)
  const status = previewError ? LABELS.needsInfo : assessmentStatus(proposal)
  const type = proposal.kind === 'new' ? LABELS.newSite : proposal.kind === 'update' ? LABELS.correction : null
  await setLabels(issue, {
    add: [LABELS.data, status, ...(type ? [type] : [])],
    remove: [...STATUS_LABELS, LABELS.newSite, LABELS.correction],
  })
  console.log(`Vurdert #${number}: ${proposal.kind}, ${status}`)
}

function fail(message) {
  writeFileSync(errorPath, message)
  console.error(message)
  process.exit(1)
}

async function approvePrepare() {
  const number = event.issue.number
  const sender = event.sender.login
  const permission = await api(`/repos/${repo}/collaborators/${encodeURIComponent(sender)}/permission`, { allow404: true })
  if (!['admin', 'write', 'maintain'].includes(permission?.permission) && !['admin', 'maintain', 'write'].includes(permission?.role_name)) {
    const issue = await getIssue(number)
    await setLabels(issue, { remove: [LABELS.approved] })
    await api(`${issuePath(number)}/comments`, { method: 'POST', body: { body: `Etiketten \`${LABELS.approved}\` kan bare settes av moderatorer med skrivetilgang til repoet. Den er fjernet.` } })
    setOutput('skip', 'true')
    return console.log(`${sender} mangler skrivetilgang`)
  }
  const issue = await getIssue(number)
  if (issue.state !== 'open') {
    setOutput('skip', 'true')
    return console.log('Saken er lukket')
  }
  const comments = await botComments(number)
  const hash = bodyHash(issue.body)
  const assessedHash = markerAttribute(findComment(comments, MARKERS.assessment)?.body, MARKERS.assessment, 'sha')
  if (assessedHash !== hash) fail('Innmeldingen er endret etter siste automatiske vurdering. Vent til vurderingen er oppdatert, kontroller den og sett etiketten på nytt.')
  const csv = loadCsv()
  const proposal = buildProposal(parseIssueForm(issue.body), csv.rows)
  let applied
  try { applied = applyProposal(csv.text, proposal, { issueNumber: number, today: today() }) } catch (error) { fail(error.message) }
  if (applied.csv === csv.text) fail('Innmeldingen fører ikke til noen endring i datafilen. Dataene er trolig allerede oppdatert.')
  writeFileSync(CSV_PATH, applied.csv)
  writeFileSync(statePath, JSON.stringify({
    number, hash, id: applied.id, approvedBy: sender,
    title: pullRequestTitle(number, applied),
    body: pullRequestBody({ issueNumber: number, proposal, applied, hash, approvedBy: sender, runUrl }),
  }))
  setOutput('branch', branchFor(number))
  setOutput('skip', 'false')
  console.log(`Oppdaterte ${applied.id} i ${CSV_PATH}`)
}

const VERIFY_STEPS = [
  ['Datapipeline (geokoding og JSON)', 'node scripts/prepare-datacenters.mjs'],
  ['Kontroll av generert data', 'npm run data:datacenters:check'],
  ['Enhetstester', 'npm test'],
  ['Bygg', 'npm run build'],
  ['Installer nettleser for e2e', 'npx playwright install --with-deps chromium'],
  ['E2e-test av kartet', 'npm run test:e2e -- --grep "Norway map"'],
]

function approveVerify() {
  for (const [label, command] of VERIFY_STEPS) {
    console.log(`::group::${label}`)
    const result = spawnSync(command, { shell: true, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
    process.stdout.write(result.stdout ?? '')
    process.stderr.write(result.stderr ?? '')
    console.log('::endgroup::')
    if (result.status !== 0) {
      const tail = `${result.stdout ?? ''}\n${result.stderr ?? ''}`.split('\n').filter(line => line.trim()).slice(-30)
        .map(line => line.replace(/[`~]/g, "'").replace(/@/g, '@\u200b').slice(0, 300)).join('\n')
      fail(`Steget «${label}» feilet.\n\n\`\`\`text\n${tail}\n\`\`\``)
    }
  }
}

async function approveFinish() {
  const state = JSON.parse(readFileSync(statePath, 'utf8'))
  const base = event.repository.default_branch
  const [existing] = await findPull(state.number)
  const issue = await getIssue(state.number)
  if (issue.state !== 'open' || bodyHash(issue.body) !== state.hash) {
    if (existing) await api(`/repos/${repo}/pulls/${existing.number}`, { method: 'PATCH', body: { state: 'closed' }, auth: prToken })
    fail('Innmeldingen ble endret eller lukket mens PR-en ble laget. Ingen PR er opprettet. Kontroller den oppdaterte vurderingen og sett etiketten på nytt.')
  }
  const pull = existing
    ? await api(`/repos/${repo}/pulls/${existing.number}`, { method: 'PATCH', body: { title: state.title, body: state.body }, auth: prToken })
    : await api(`/repos/${repo}/pulls`, { method: 'POST', body: { title: state.title, body: state.body, head: branchFor(state.number), base, maintainer_can_modify: true }, auth: prToken })
  const comments = await botComments(state.number)
  await deleteComment(comments, MARKERS.error)
  await upsertComment(state.number, comments, MARKERS.pr, `${marker(MARKERS.pr, `pr=${pull.number}`)}
Innmeldingen er godkjent av en moderator. Endringen ligger i #${pull.number} og blir gjennomgått før den flettes. Du får beskjed her når den er publisert.`)
  await setLabels(issue, { add: [LABELS.prCreated], remove: [LABELS.approved, LABELS.review, LABELS.needsInfo, LABELS.published] })
  console.log(`PR #${pull.number} for sak #${state.number}`)
}

async function approveFailed() {
  const number = event.issue.number
  const detail = existsSync(errorPath) ? readFileSync(errorPath, 'utf8') : 'Et steg i kjøringen feilet før feilen kunne beskrives.'
  const issue = await getIssue(number)
  const comments = await botComments(number)
  await upsertComment(number, comments, MARKERS.error, `${marker(MARKERS.error)}
Klarte ikke å lage en PR for denne innmeldingen. Ingenting er publisert.

${detail}

Se kjøringen: ${runUrl}

Rett opp innmeldingen eller datafilen og sett etiketten \`${LABELS.approved}\` på nytt.`)
  await setLabels(issue, { add: hasLabel(issue, LABELS.needsInfo) ? [] : [LABELS.review], remove: [LABELS.approved] })
}

async function published() {
  const run = event.workflow_run
  if (run.conclusion !== 'success' || !['push', 'workflow_dispatch'].includes(run.event) || run.head_branch !== event.repository.default_branch) return console.log('Ikke en vellykket publisering fra hovedgrenen')
  const deployedIds = new Set(loadCsv().rows.map(row => row.id))
  const issues = (await paginate(`/repos/${repo}/issues?state=open&labels=${encodeURIComponent(LABELS.prCreated)}`)).filter(issue => !issue.pull_request)
  for (const issue of issues) {
    const merged = (await findPull(issue.number, 'closed')).filter(pull => pull.merged_at && markerAttribute(pull.body, MARKERS.issue, 'issue') === String(issue.number))
      .sort((a, b) => b.merged_at.localeCompare(a.merged_at))[0]
    if (!merged) continue
    const comparison = await api(`/repos/${repo}/compare/${merged.merge_commit_sha}...${run.head_sha}`, { allow404: true })
    if (!['ahead', 'identical'].includes(comparison?.status)) {
      console.log(`#${issue.number}: PR #${merged.number} er ikke med i publisert versjon ${run.head_sha}`)
      continue
    }
    const siteId = markerAttribute(merged.body, MARKERS.site, 'site')
    const comments = await botComments(issue.number)
    if (!findComment(comments, MARKERS.published)) {
      const body = siteId && deployedIds.has(siteId) ? publishedBody(siteId) : `${marker(MARKERS.published)}
Endringen er publisert. Se oversikten: <${SITE_URL}#kart>

Takk for bidraget!`
      await api(`${issuePath(issue.number)}/comments`, { method: 'POST', body: { body } })
    }
    await setLabels(issue, { add: [LABELS.published], remove: [LABELS.prCreated, LABELS.approved, LABELS.review, LABELS.needsInfo] })
    await api(issuePath(issue.number), { method: 'PATCH', body: { state: 'closed', state_reason: 'completed' } })
    console.log(`#${issue.number}: publisert ${siteId ? siteLink(siteId) : ''}`)
  }
}

const commands = { labels: ensureLabels, triage, 'approve-prepare': approvePrepare, 'approve-verify': approveVerify, 'approve-finish': approveFinish, 'approve-failed': approveFailed, published }
const command = commands[process.argv[2]]
if (!command) {
  console.error(`Bruk: node scripts/issue-bot.mjs <${Object.keys(commands).join('|')}>`)
  process.exit(2)
}
if (command !== approveVerify && (!repo || !token)) throw new Error('GITHUB_REPOSITORY og GITHUB_TOKEN må være satt')
await command()
