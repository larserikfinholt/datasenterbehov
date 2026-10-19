import { readFileSync } from 'node:fs'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  BOT_LOGIN, FORM_FIELDS, LABELS, LABEL_DEFINITIONS, MARKERS, analyzeSourceText, assessmentBody, assessmentStatus, bodyHash, buildProposal,
  findCandidates, humanComments, includesMerge, isPublishRun, normalizeEol, parseIssueForm, parsePullLinks,
  parseSources, publishedBody, readCsv, reportHash, safeInline,
} from './datacenter-issue.mjs'
import { runBot } from './issue-bot.mjs'

const csvText = readFileSync(new URL('../data/datacenters.csv', import.meta.url), 'utf8')
const { rows } = readCsv(csvText)
const template = normalizeEol(readFileSync(new URL('../.github/ISSUE_TEMPLATE/data-korreksjon.yml', import.meta.url), 'utf8'))

afterEach(() => vi.unstubAllGlobals())

function mockGitHub({ body = '### Beskrivelse\n\nEt nytt tips', pulls = [], comparison = 'ahead', sourceResponse } = {}) {
  const issue = { number: 2, title: 'Ny informasjon', body, state: 'open', labels: [{ name: LABELS.data }] }
  const comments = []
  const requests = []
  const config = { repo: 'test/repo', token: 'test-token' }
  vi.stubGlobal('fetch', vi.fn(async (address, options = {}) => {
    const url = new URL(address)
    const method = options.method ?? 'GET'
    const data = options.body ? JSON.parse(options.body) : undefined
    requests.push({ url: url.href, method, data, headers: options.headers })
    if (url.hostname === '8.8.8.8') return sourceResponse?.() ?? new Response('<main><h1>Plan for Kiseåsen</h1><a href="/plan.pdf">Planprogram</a></main>', { headers: { 'content-type': 'text/html' } })
    if (url.hostname !== 'api.github.com') throw new Error(`Uventet nettverkskall: ${url.href}`)
    const path = url.pathname.replace('/repos/test/repo', '')
    const page = items => items.slice((Number(url.searchParams.get('page') ?? 1) - 1) * 100, Number(url.searchParams.get('page') ?? 1) * 100)
    if (path === '/labels' && method === 'GET') return Response.json(page(LABEL_DEFINITIONS))
    if (path === '/issues' && method === 'GET') return Response.json(page(issue.state === 'open' ? [issue] : []))
    if (path === '/pulls' && method === 'GET') return Response.json(page(pulls.filter(pull => url.searchParams.get('state') === 'all' || pull.state === url.searchParams.get('state'))))
    if (path.startsWith('/pulls/') && method === 'GET') return Response.json(pulls.find(pull => pull.number === Number(path.split('/').at(-1))))
    if (path.startsWith('/compare/')) return comparison === null ? new Response(null, { status: 404 }) : Response.json({ status: comparison })
    if (path === '/issues/2') {
      if (method === 'PATCH') Object.assign(issue, data)
      return Response.json(issue)
    }
    if (path === '/issues/2/comments') {
      if (method === 'POST') {
        const comment = { id: comments.length + 1000, body: data.body, user: { login: BOT_LOGIN, type: 'Bot' } }
        comments.push(comment)
        return Response.json(comment)
      }
      return Response.json(page(comments))
    }
    if (path.startsWith('/issues/comments/')) {
      const index = comments.findIndex(comment => comment.id === Number(path.split('/').at(-1)))
      if (method === 'DELETE') {
        comments.splice(index, 1)
        return new Response(null, { status: 204 })
      }
      Object.assign(comments[index], data)
      return Response.json(comments[index])
    }
    if (path === '/issues/2/labels' && method === 'POST') {
      issue.labels.push(...data.labels.map(name => ({ name })))
      return Response.json(issue.labels)
    }
    if (path.startsWith('/issues/2/labels/') && method === 'DELETE') {
      issue.labels = issue.labels.filter(label => label.name !== decodeURIComponent(path.split('/').at(-1)))
      return new Response(null, { status: 204 })
    }
    throw new Error(`Uventet GitHub-kall: ${method} ${path}`)
  }))
  return { issue, comments, requests, config }
}

describe('issue form', () => {
  it('asks only for a description, with the native GitHub title left blank', () => {
    expect([...template.matchAll(/^    id: (.+)$/gm)].map(match => match[1])).toEqual(Object.keys(FORM_FIELDS))
    expect(template).toContain('name: Ny informasjon eller rettelse\n')
    expect(template).toContain('label: Beskrivelse\n')
    expect(template).not.toMatch(/^title:/m)
  })

  it.each([
    'Vet ikke om dette er et nytt datasenter eller ny informasjon.',
    'Se https://example.com/a og [planen](https://example.com/b).',
  ])('accepts a description without a known name or category: %s', description => {
    const proposal = buildProposal(parseIssueForm(`### Beskrivelse\n\n${description}`), rows)
    expect(proposal.errors).toEqual([])
    expect(proposal).toMatchObject({ manualReview: true, description })
    expect(assessmentStatus(proposal)).toBe(LABELS.review)
    expect(proposal).not.toHaveProperty('changes')
  })

  it('only requests more information for an empty description', () => {
    const proposal = buildProposal(parseIssueForm('### Beskrivelse\n\n_No response_'), rows)
    expect(proposal.errors).toEqual(['Legg inn en kort beskrivelse, her eller i en kommentar.'])
    expect(assessmentStatus(proposal)).toBe(LABELS.needsInfo)
  })

  it('preserves markdown headings and accepts plain text', () => {
    expect(parseIssueForm('### Beskrivelse\n\nEt tips\n\n### Beskrivelse\n\nMer informasjon').fields.description)
      .toBe('Et tips\n\n### Beskrivelse\n\nMer informasjon')
    expect(parseIssueForm('Et tips uten skjema').fields.description).toBe('Et tips uten skjema')
  })

  it('extracts all links from prose, markdown and images and removes duplicates', () => {
    const { sources, warnings } = parseSources('En [kilde](https://example.com/a) og https://example.com/b.\n![Kart](https://example.com/c.png) https://example.com/a')
    expect(sources).toEqual(['a', 'b', 'c.png'].map(path => ({ url: `https://example.com/${path}` })))
    expect(warnings).toEqual([])
    expect(parseSources('Et tips uten lenke')).toEqual({ sources: [], warnings: [] })
  })

  it('preserves balanced parentheses in URLs and rejects embedded credentials', () => {
    expect(parseSources('[Plan](https://example.com/plan_(2026))').sources).toEqual([{ url: 'https://example.com/plan_(2026)' }])
    expect(parseSources('https://user:secret@example.com/').sources).toEqual([])
  })

  it('limits the number of sources', () => {
    const result = parseSources(Array.from({ length: 12 }, (_, index) => `https://example.com/${index}`).join(' '))
    expect(result.sources).toHaveLength(10)
    expect(result.warnings).toHaveLength(1)
  })

  it('hashes bodies independent of line endings', () => {
    expect(bodyHash('a\r\nb\r\n')).toBe(bodyHash('a\nb'))
  })

  it('escapes untrusted text for markdown', () => {
    const text = safeInline('@everyone <img src=x> | [lenke](https://evil) `kode`')
    expect(text).not.toMatch(/(^|[^\\])[<|[`]/)
    expect(text).toContain('@' + String.fromCharCode(0x200b) + 'everyone')
  })

  it('includes human comments and the title, but ignores bot comments', () => {
    const issue = { title: 'Ny informasjon om OSL-Hamar', body: '### Beskrivelse\n\n_No response_' }
    const human = { id: 1, body: 'Se https://example.com/plan', user: { login: 'leser', type: 'User' } }
    const bot = { id: 2, body: 'Se https://example.com/bot', user: { login: 'github-actions[bot]', type: 'Bot' } }
    const comments = [human, bot]
    expect(humanComments(comments)).toEqual([human])
    const proposal = buildProposal(parseIssueForm(issue.body), rows, { title: issue.title, comments })
    expect(proposal.errors).toEqual([])
    expect(proposal.sources).toEqual([{ url: 'https://example.com/plan' }])
    expect(proposal.candidates.map(item => item.id)).toContain('gm-hamar')
    expect(reportHash(issue, comments)).toBe(reportHash(issue, [human]))
    expect(reportHash(issue, comments)).not.toBe(reportHash(issue, []))
    expect(reportHash({ ...issue, title: 'Endret' }, comments)).not.toBe(reportHash(issue, comments))
    expect(reportHash(issue, [{ ...human, body: 'Endret' }])).not.toBe(reportHash(issue, comments))
  })

  it('suggests possible sites without assuming that a municipality identifies an existing site', () => {
    expect(findCandidates('Reguleringsplan for Kiseåsen i Skien', rows).map(item => item.id)).toContain('google-skien')
    expect(findCandidates('Reguleringsplan for Kiseåsen i Skien', rows).every(item => item.reasons.includes('kommune er nevnt'))).toBe(true)
    expect(findCandidates('Ukjent sted', rows)).toEqual([])
  })

  it('reads page metadata and document links without script content', () => {
    const analysis = analyzeSourceText('<html><head><meta property="article:published_time" content="2026-08-24"></head><body><main><h1>Kiseåsen &amp; omegn</h1><p>Planlagt datasenter</p><a href="/plan.pdf">Planprogram</a><a href="javascript:alert(1)">Feil</a><a href="https://user:secret@example.com/privat.pdf">Privat</a></main><script>falske tall</script><footer>Gromstul</footer></body></html>', 'https://example.com/kilde')
    expect(analysis.title).toBe('Kiseåsen & omegn')
    expect(analysis.reportedDate).toBe('2026-08-24')
    expect(analysis.documents).toEqual([{ url: 'https://example.com/plan.pdf', title: 'Planprogram' }])
    expect(analysis.text).not.toContain('falske tall')
    expect(analysis.text).not.toContain('Gromstul')
  })

  it('keeps unavailable sources and missing names out of the missing-information status', () => {
    const proposal = buildProposal(parseIssueForm('Se https://example.com/kilde'), rows)
    const body = assessmentBody({ proposal, hash: 'abc', issueNumber: 2, checkedAt: '2026-10-19', sourceChecks: [{ url: 'https://example.com/kilde', status: 'error', note: 'kunne ikke hentes' }] })
    expect(assessmentStatus(proposal)).toBe(LABELS.review)
    expect(body).toContain('klart for manuell vurdering')
    expect(body).toContain('Kontrolleres manuelt')
    expect(body).toContain('<details>')
    expect(body).toContain('Innmelding: #2')
    expect(body).toContain('Tildel saken til Copilot under Assignees')
    expect(body).toContain('ikke en godkjenning av opplysningene')
    expect(body).toContain('Ingen godkjenningsetikett trengs')
    expect(body).toContain('utenfor kodeblokk')
    expect(body).toContain('@copilot i PR-en')
    expect(body).not.toContain('fant ikke')
  })

  it('only links PRs with explicit non-closing references outside code fences', () => {
    expect(parsePullLinks('Innmelding: #2\r\nInnmelding: #2\r\nInnmelding: #3\r\nDatasenter: gm-hamar')).toEqual({ issues: [2, 3], sites: ['gm-hamar'] })
    expect(parsePullLinks('Fixes #2\nSe #3\n> Innmelding: #4\n```text\nInnmelding: #5\n```')).toEqual({ issues: [], sites: [] })
    expect(parsePullLinks('Innmelding: #0\nInnmelding: #999999999999999999999\nDatasenter: ../feil')).toEqual({ issues: [], sites: [] })
  })

  it('only accepts successful default-branch deployments containing the merge', () => {
    const run = { conclusion: 'success', event: 'push', head_branch: 'main' }
    expect(isPublishRun(run, 'main')).toBe(true)
    expect(isPublishRun({ ...run, conclusion: 'failure' }, 'main')).toBe(false)
    expect(isPublishRun({ ...run, head_branch: 'annen' }, 'main')).toBe(false)
    expect(isPublishRun({ ...run, event: 'pull_request' }, 'main')).toBe(false)
    for (const status of ['ahead', 'identical']) expect(includesMerge({ status })).toBe(true)
    for (const status of ['behind', 'diverged', undefined]) expect(includesMerge({ status })).toBe(false)
    expect(includesMerge(null)).toBe(false)
    expect(publishedBody(['gm-hamar'])).toContain('#site-gm-hamar')
    expect(publishedBody()).toContain('#kart')
  })
})

describe('GitHub issue flow', () => {
  const repository = { default_branch: 'main' }
  const pullFor = overrides => ({
    number: 10, body: 'Innmelding: #2\nDatasenter: gm-hamar', state: 'open', merged_at: null,
    merge_commit_sha: 'merged', base: { ref: 'main', repo: { full_name: 'test/repo' } }, ...overrides,
  })
  const deployEvent = overrides => ({ repository, workflow_run: { conclusion: 'success', event: 'push', head_branch: 'main', head_sha: 'deployed', ...overrides } })

  it('acknowledges once and updates the same assessment for added, edited and deleted comments', async () => {
    const state = mockGitHub()
    const event = { issue: { number: 2 } }
    await runBot('triage', { ...state.config, event })
    expect(state.comments).toHaveLength(2)
    const assessment = state.comments.find(comment => comment.body.includes(MARKERS.assessment))
    const originalBody = assessment.body
    await runBot('triage', { ...state.config, event })
    expect(state.comments).toHaveLength(2)
    expect(assessment.body).toBe(originalBody)
    const human = { id: 3, body: 'Se https://8.8.8.8/kilde', user: { login: 'leser', type: 'User' } }
    state.comments.push(human)
    await runBot('triage', { ...state.config, event: { ...event, comment: human } })
    expect(state.comments).toHaveLength(3)
    expect(assessment.body).toContain('Plan for Kiseåsen')
    expect(assessment.body).toContain('https://8.8.8.8/plan.pdf')
    expect(state.requests.find(request => request.url === 'https://8.8.8.8/kilde').headers.authorization).toBeUndefined()
    human.body = 'Oppdatert beskrivelse uten lenke'
    await runBot('triage', { ...state.config, event: { ...event, comment: human } })
    expect(assessment.body).not.toContain('Plan for Kiseåsen')
    state.comments.splice(state.comments.indexOf(human), 1)
    await runBot('triage', { ...state.config, event: { ...event, action: 'deleted', comment: human } })
    expect(state.comments).toHaveLength(2)
    expect(assessment.body).toBe(originalBody)
  })

  it('ignores bot comments and never interprets PR comments as data issues', async () => {
    const state = mockGitHub()
    await runBot('triage', { ...state.config, event: { issue: { number: 2 }, comment: { user: { login: BOT_LOGIN, type: 'Bot' } } } })
    expect(state.requests).toEqual([])
    state.issue.pull_request = {}
    await runBot('triage', { ...state.config, event: { issue: { number: 2 } } })
    expect(state.comments).toEqual([])
  })

  it('reads all pages of comments and preserves the linked-PR status on new information', async () => {
    const state = mockGitHub()
    state.issue.labels.push({ name: LABELS.prCreated })
    state.comments.push(...Array.from({ length: 101 }, (_, index) => ({ id: index, body: 'En opplysning', user: { login: 'leser', type: 'User' } })))
    await runBot('triage', { ...state.config, issueNumber: 2 })
    expect(state.requests.some(request => request.url.includes('/comments?per_page=100&page=2'))).toBe(true)
    expect(state.issue.labels.map(label => label.name)).toContain(LABELS.prCreated)
    expect(state.requests.filter(request => request.method !== 'GET').every(request => request.url.includes('/issues/'))).toBe(true)
  })

  it.each([
    ['http://127.0.0.1/private', undefined],
    ['https://8.8.8.8/kilde', () => new Response(null, { status: 302, headers: { location: 'http://127.0.0.1/private' } })],
    ['https://8.8.8.8/kilde', () => new Response(null, { status: 503 })],
  ])('keeps blocked or unavailable sources for manual review: %s', async (url, sourceResponse) => {
    const state = mockGitHub({ body: `### Beskrivelse\n\nSe ${url}`, sourceResponse })
    await runBot('triage', { ...state.config, issueNumber: 2 })
    expect(state.issue.labels.map(label => label.name)).toContain(LABELS.review)
    expect(state.requests.some(request => request.url.includes('127.0.0.1'))).toBe(false)
    expect(state.comments.find(comment => comment.body.includes(MARKERS.assessment)).body).toContain('Kontrolleres manuelt')
  })

  it('links an ordinary PR without closing the issue, and removes the link if the PR is rejected', async () => {
    const pull = pullFor({})
    const state = mockGitHub({ pulls: [pull] })
    const event = { repository, pull_request: pull }
    await runBot('link-pr', { ...state.config, event })
    expect(state.issue.state).toBe('open')
    expect(state.issue.labels.map(label => label.name)).toContain(LABELS.prCreated)
    expect(state.comments).toHaveLength(1)
    pull.state = 'closed'
    await runBot('link-pr', { ...state.config, event })
    expect(state.issue.labels.map(label => label.name)).toContain(LABELS.review)
    expect(state.issue.labels.map(label => label.name)).not.toContain(LABELS.prCreated)
    expect(state.comments).toHaveLength(0)
  })

  it('removes a connection deleted from the PR description and ignores other base branches', async () => {
    const pull = pullFor({ body: 'Ingen innmelding' })
    const state = mockGitHub({ pulls: [pull] })
    state.issue.labels.push({ name: LABELS.prCreated })
    await runBot('link-pr', { ...state.config, event: { repository, pull_request: pull, changes: { body: { from: 'Innmelding: #2' } } } })
    expect(state.issue.labels.map(label => label.name)).not.toContain(LABELS.prCreated)
    pull.body = 'Innmelding: #2'
    pull.base.ref = 'annen-gren'
    await runBot('link-pr', { ...state.config, event: { repository, pull_request: pull } })
    expect(state.comments).toEqual([])
  })

  it.each(['behind', 'diverged', null])('does not publish a merge outside the deployed revision: %s', async comparison => {
    const state = mockGitHub({ comparison, pulls: [pullFor({ state: 'closed', merged_at: '2026-10-19T12:00:00Z' })] })
    await runBot('published', { ...state.config, event: deployEvent() })
    expect(state.issue.state).toBe('open')
    expect(state.comments).toEqual([])
  })

  it.each([{ conclusion: 'failure' }, { head_branch: 'annen' }, { event: 'pull_request' }])('ignores non-publication runs: %j', async overrides => {
    const state = mockGitHub()
    await runBot('published', { ...state.config, event: deployEvent(overrides) })
    expect(state.requests).toEqual([])
  })

  it('publishes manually created PRs even without a preceding linking run and is idempotent', async () => {
    const state = mockGitHub({ pulls: [pullFor({ state: 'closed', merged_at: '2026-10-19T12:00:00Z' })] })
    state.comments.push({ id: 1, body: `<!-- ${MARKERS.published} --> Ikke stol på dette`, user: { login: 'leser', type: 'User' } })
    await runBot('published', { ...state.config, event: deployEvent() })
    expect(state.issue.state).toBe('closed')
    expect(state.issue.labels.map(label => label.name)).toContain(LABELS.published)
    expect(state.comments).toHaveLength(2)
    expect(state.comments[1].body).toContain('#site-gm-hamar')
    await runBot('published', { ...state.config, event: deployEvent() })
    expect(state.comments).toHaveLength(2)
  })

  it('falls back to the map for unknown site IDs and ignores closed-but-unmerged PRs', async () => {
    const pull = pullFor({ state: 'closed', merged_at: '2026-10-19T12:00:00Z', body: 'Innmelding: #2\nDatasenter: finnes-ikke' })
    const state = mockGitHub({ pulls: [pull] })
    await runBot('published', { ...state.config, event: deployEvent() })
    expect(state.comments[0].body).toContain('#kart')
    state.issue.state = 'open'
    state.comments.length = 0
    pull.merged_at = null
    await runBot('published', { ...state.config, event: deployEvent() })
    expect(state.issue.state).toBe('open')
    expect(state.comments).toEqual([])
  })
})
