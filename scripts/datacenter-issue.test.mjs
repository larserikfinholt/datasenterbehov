import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import {
  FORM_FIELDS, LABELS, TYPE_OPTIONS, applyProposal, assessmentBody, assessmentStatus, bodyHash, buildProposal,
  findDuplicates, markerAttribute, parseIssueForm, parseSources, readCsv, safeInline,
} from './datacenter-issue.mjs'

const csvText = readFileSync(new URL('../data/datacenters.csv', import.meta.url), 'utf8')
const { rows } = readCsv(csvText)
const template = readFileSync(new URL('../.github/ISSUE_TEMPLATE/data-korreksjon.yml', import.meta.url), 'utf8')
const values = { type: TYPE_OPTIONS.correction, datacenter: 'OSL-Hamar', sources: 'https://example.com/kilde', description: 'Rett kapasiteten. ![Bilde](https://example.com/bilde.png)' }
const issueBody = fields => Object.entries(FORM_FIELDS).map(([id, label]) => `### ${label}\n\n${fields[id] || '_No response_'}`).join('\n\n')
const proposalFor = fields => buildProposal(parseIssueForm(issueBody(fields)), rows)

describe('issue form', () => {
  it('has only four fields matching the parser and website types', () => {
    expect([...template.matchAll(/^    id: (.+)$/gm)].map(match => match[1])).toEqual(Object.keys(FORM_FIELDS))
    for (const label of Object.values(FORM_FIELDS)) expect(template).toContain(`label: ${label}\n`)
    for (const option of Object.values(TYPE_OPTIONS)) expect(template).toMatch(new RegExp(`^ +- ${option}$`, 'm'))
    const source = readFileSync(new URL('../src/report-links.ts', import.meta.url), 'utf8')
    for (const key of ['correction', 'supplement', 'newSite']) expect(source).toContain(`${key}: '${TYPE_OPTIONS[key]}'`)
  })

  it.each([
    [TYPE_OPTIONS.correction, 'OSL-Hamar', 'update'],
    [TYPE_OPTIONS.newSite, 'Et nytt datasenter', 'new'],
    [TYPE_OPTIONS.other, 'Et ukjent navn', 'other'],
  ])('accepts a simple report for manual review: %s', (type, datacenter, kind) => {
    const proposal = proposalFor({ ...values, type, datacenter })
    expect(proposal.errors).toEqual([])
    expect(proposal).toMatchObject({ kind, manualReview: true, description: values.description })
    expect(assessmentStatus(proposal)).toBe(LABELS.review)
    expect(() => applyProposal(csvText, proposal, { issueNumber: 42, today: '2026-10-16' })).toThrow(/manuelt/)
    const assessment = assessmentBody({ proposal, hash: 'abc', checkedAt: '2026-10-16' })
    expect(assessment).toContain('Klar for manuell vurdering.')
    expect(assessment).toContain('oppdater CSV manuelt')
    expect(markerAttribute(assessment, 'datasenter-bot:vurdering', 'sha')).toBe('abc')
  })

  it.each(['type', 'datacenter', 'sources', 'description'])('requires %s', field => {
    expect(proposalFor({ ...values, [field]: '' }).errors).toHaveLength(1)
  })

  it('accepts an already registered source without inventing a data change', () => {
    const site = rows.find(row => row.id === 'gm-hamar')
    const proposal = proposalFor({ ...values, sources: site.source_urls.split('|')[0] })
    expect(proposal.errors).toEqual([])
    expect(proposal.changes).toEqual({})
  })

  it('reports repeated headings instead of letting the last one win', () => {
    const form = parseIssueForm(`${issueBody(values)}\n\n### ${FORM_FIELDS.sources}\n\nhttps://example.com/other`)
    expect(form.duplicates).toEqual(['sources'])
    expect(buildProposal(form, rows).errors.join(' ')).toContain('står flere ganger')
  })

  it('flags existing sites as possible duplicates', () => {
    const proposal = proposalFor({ ...values, type: TYPE_OPTIONS.newSite, datacenter: 'Lefdal utvidelse' })
    expect(findDuplicates(proposal, rows).map(item => item.id)).toContain('lefdal')
  })

  it('hashes bodies independent of line endings', () => {
    expect(bodyHash('a\r\nb\r\n')).toBe(bodyHash('a\nb'))
  })

  it('reads sources with optional dates', () => {
    const { sources, warnings } = parseSources('https://example.com/a 2026-05-12\nhttps://example.com/b (12.5.2026)\nbare tekst\nhttps://example.com/a')
    expect(sources).toEqual([{ url: 'https://example.com/a', date: '2026-05-12' }, { url: 'https://example.com/b', date: '2026-05-12' }])
    expect(warnings).toHaveLength(1)
  })

  it('escapes untrusted text for markdown', () => {
    const text = safeInline('@everyone <img src=x> | [lenke](https://evil) `kode`')
    expect(text).not.toMatch(/(^|[^\\])[<|[`]/)
    expect(text).toContain('@' + String.fromCharCode(0x200b) + 'everyone')
  })
})
