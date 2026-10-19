import { lookup } from 'node:dns/promises'
import { readFileSync } from 'node:fs'
import { isIP } from 'node:net'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  ACK_BODY, BOT_LOGIN, LABELS, LABEL_DEFINITIONS, MARKERS, MAX_SOURCE_CHECKS, STATUS_LABELS,
  analyzeSourceText, assessmentBody, assessmentStatus, buildProposal, findCandidates, fold, humanComments,
  includesMerge, isPublishRun, marker, markerAttribute, parseIssueForm, parsePullLinks, publishedBody, readCsv, reportHash,
} from './datacenter-issue.mjs'

const CSV_PATH = 'data/datacenters.csv'
const today = () => new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Oslo' }).format(new Date())

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

async function checkSource(source) {
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
      return { url: source.url, status: 'ok', analysis: analyzeSourceText(text, url.href) }
    }
  } catch (error) {
    const note = error.name === 'TimeoutError' ? 'svarte ikke innen 8 sekunder' : error.message?.startsWith('lenken') ? error.message : 'kunne ikke hentes'
    return { url: source.url, status: 'error', note }
  }
}

export async function runBot(command, { repo, token, event = {}, issueNumber, force = false }) {
  if (!repo || !token) throw new Error('GITHUB_REPOSITORY og GITHUB_TOKEN må være satt')
  const prefix = `/repos/${repo}`
  const issuePath = number => `${prefix}/issues/${number}`
  const hasLabel = (issue, name) => issue.labels.some(label => (typeof label === 'string' ? label : label.name) === name)
  const findComment = (comments, name) => comments.find(comment => comment.user?.login === BOT_LOGIN && comment.body?.includes(`<!-- ${name}`))

  async function api(path, { method = 'GET', body, allow404 = false } = {}) {
    const response = await fetch(`https://api.github.com${path}`, {
      method,
      headers: { authorization: `Bearer ${token}`, accept: 'application/vnd.github+json', 'x-github-api-version': '2022-11-28', 'user-agent': 'datasenterbehov-bot' },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
    if (allow404 && response.status === 404) return null
    if (!response.ok) throw new Error(`GitHub API ${method} ${path}: ${response.status}`)
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

  async function ensureLabels() {
    const existing = new Set((await paginate(`${prefix}/labels`)).map(label => label.name))
    for (const label of LABEL_DEFINITIONS.filter(label => !existing.has(label.name))) await api(`${prefix}/labels`, { method: 'POST', body: label })
  }

  async function setLabels(issue, add, remove = []) {
    const toAdd = add.filter(label => !hasLabel(issue, label))
    if (toAdd.length) await api(`${issuePath(issue.number)}/labels`, { method: 'POST', body: { labels: toAdd } })
    for (const label of remove.filter(label => hasLabel(issue, label) && !add.includes(label))) {
      await api(`${issuePath(issue.number)}/labels/${encodeURIComponent(label)}`, { method: 'DELETE', allow404: true })
    }
  }

  async function upsertComment(number, comments, name, body) {
    const existing = findComment(comments, name)
    if (existing) {
      if (existing.body !== body) await api(`${prefix}/issues/comments/${existing.id}`, { method: 'PATCH', body: { body } })
    } else await api(`${issuePath(number)}/comments`, { method: 'POST', body: { body } })
  }

  async function triage() {
    if (event.comment && !humanComments([event.comment]).length) return
    const number = event.issue?.number ?? Number(issueNumber)
    if (!Number.isSafeInteger(number) || number < 1) throw new Error('Oppgi et gyldig saksnummer')
    const issue = await api(issuePath(number))
    if (issue.pull_request || issue.state !== 'open') return
    const form = parseIssueForm(issue.body)
    if (!form.isForm && !hasLabel(issue, LABELS.data)) return
    await ensureLabels()
    const comments = await paginate(`${issuePath(number)}/comments`)
    await upsertComment(number, comments, MARKERS.ack, ACK_BODY)
    const hash = reportHash(issue, comments)
    if (!force && markerAttribute(findComment(comments, MARKERS.assessment)?.body, MARKERS.assessment, 'sha') === hash) return
    const { rows } = readCsv(readFileSync(CSV_PATH, 'utf8'))
    const proposal = buildProposal(form, rows, { title: issue.title, comments })
    const sourceChecks = await Promise.all(proposal.sources.slice(0, MAX_SOURCE_CHECKS).map(checkSource))
    const candidates = findCandidates([proposal.text, ...sourceChecks.map(check => check.analysis?.text ?? '')].join('\n'), rows)
    const open = await paginate(`${prefix}/issues?state=open&labels=${encodeURIComponent(LABELS.data)}`)
    const relatedIssues = open.filter(item => !item.pull_request && item.number !== number && (
      (fold(issue.title) && fold(issue.title) === fold(item.title)) ||
      proposal.sources.some(source => String(item.body ?? '').includes(source.url))
    )).slice(0, 5)
    const body = assessmentBody({ proposal, candidates, relatedIssues, sourceChecks, hash, issueNumber: number, checkedAt: today() })
    const latest = await api(issuePath(number))
    const latestComments = await paginate(`${issuePath(number)}/comments`)
    if (latest.state !== 'open' || reportHash(latest, latestComments) !== hash) return
    await upsertComment(number, latestComments, MARKERS.assessment, body)
    const status = proposal.errors.length ? assessmentStatus(proposal) : hasLabel(latest, LABELS.prCreated) ? LABELS.prCreated : LABELS.review
    await setLabels(latest, [LABELS.data, status], STATUS_LABELS)
    console.log(`Vurdert #${number}: ${status}`)
  }

  async function linkPull() {
    const pull = await api(`${prefix}/pulls/${event.pull_request.number}`)
    const base = event.repository.default_branch
    if (pull.base.repo.full_name !== repo || pull.base.ref !== base) return
    const numbers = new Set([...parsePullLinks(pull.body).issues, ...parsePullLinks(event.changes?.body?.from).issues, ...parsePullLinks(event.pull_request.body).issues])
    if (!numbers.size) return
    await ensureLabels()
    const pulls = await paginate(`${prefix}/pulls?state=all&base=${encodeURIComponent(base)}`)
    const current = [...pulls.filter(item => item.number !== pull.number), pull]
    for (const number of numbers) {
      const issue = await api(issuePath(number), { allow404: true })
      if (!issue || issue.pull_request || issue.state !== 'open' || !hasLabel(issue, LABELS.data)) continue
      const active = current.filter(item => (item.state === 'open' || item.merged_at) && parsePullLinks(item.body).issues.includes(number))
      const comments = await paginate(`${issuePath(number)}/comments`)
      if (active.length) {
        await upsertComment(number, comments, MARKERS.pr, `${marker(MARKERS.pr)}\nEn endring er foreslått i ${active.map(item => `#${item.number}`).join(', ')}. Saken holdes åpen til endringen er publisert. Ingenting er godkjent eller publisert automatisk.`)
        await setLabels(issue, [LABELS.prCreated], STATUS_LABELS)
      } else {
        const existing = findComment(comments, MARKERS.pr)
        if (existing) await api(`${prefix}/issues/comments/${existing.id}`, { method: 'DELETE' })
        await setLabels(issue, [hasLabel(issue, LABELS.needsInfo) ? LABELS.needsInfo : LABELS.review], [LABELS.prCreated])
      }
    }
  }

  async function published() {
    const run = event.workflow_run
    if (!isPublishRun(run, event.repository.default_branch)) return
    const deployedIds = new Set(readCsv(readFileSync(CSV_PATH, 'utf8')).rows.map(row => row.id))
    const pulls = await paginate(`${prefix}/pulls?state=closed&base=${encodeURIComponent(event.repository.default_branch)}`)
    for (const pull of pulls) {
      const links = parsePullLinks(pull.body)
      if (!pull.merged_at || !pull.merge_commit_sha || !links.issues.length) continue
      const comparison = await api(`${prefix}/compare/${pull.merge_commit_sha}...${run.head_sha}`, { allow404: true })
      if (!includesMerge(comparison)) continue
      for (const number of links.issues) {
        const issue = await api(issuePath(number), { allow404: true })
        if (!issue || issue.pull_request || issue.state !== 'open' || !hasLabel(issue, LABELS.data)) continue
        const comments = await paginate(`${issuePath(number)}/comments`)
        await upsertComment(number, comments, MARKERS.published, publishedBody(links.sites.filter(id => deployedIds.has(id))))
        await setLabels(issue, [LABELS.published], STATUS_LABELS)
        await api(issuePath(number), { method: 'PATCH', body: { state: 'closed', state_reason: 'completed' } })
        console.log(`#${number}: publisert fra PR #${pull.number}`)
      }
    }
  }

  const commands = { labels: ensureLabels, triage, 'link-pr': linkPull, published }
  if (!Object.hasOwn(commands, command)) throw new Error(`Bruk: node scripts/issue-bot.mjs <${Object.keys(commands).join('|')}>`)
  await commands[command]()
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await runBot(process.argv[2], {
    repo: process.env.GITHUB_REPOSITORY,
    token: process.env.GITHUB_TOKEN,
    event: process.env.GITHUB_EVENT_PATH ? JSON.parse(readFileSync(process.env.GITHUB_EVENT_PATH, 'utf8')) : {},
    issueNumber: process.env.ISSUE_NUMBER,
    force: Boolean(process.env.FORCE),
  })
}
