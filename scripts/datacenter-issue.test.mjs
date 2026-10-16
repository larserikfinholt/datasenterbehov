import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import {
  BASIS_OPTIONS, FORM_FIELDS, STATUS_OPTIONS, TYPE_OPTIONS, applyProposal, assessmentBody, bodyHash, buildProposal,
  findDuplicates, markerAttribute, parseIssueForm, parseMwInput, parseSources, pullRequestBody, readCsv, safeInline,
} from './datacenter-issue.mjs'

const csvText = readFileSync(new URL('../data/datacenters.csv', import.meta.url), 'utf8')
const { rows } = readCsv(csvText)
const template = readFileSync(new URL('../.github/ISSUE_TEMPLATE/data-korreksjon.yml', import.meta.url), 'utf8')

/** Renders form values the way GitHub renders a submitted issue form. */
function issueBody(values) {
  return Object.entries(FORM_FIELDS).map(([id, label]) => {
    const value = id === 'confirm' ? `- [${values.confirm === false ? ' ' : 'X'}] Opplysningene er offentlig tilgjengelige og kan publiseres sammen med kildene.` : values[id] || '_No response_'
    return `### ${label}\n\n${value}`
  }).join('\n\n')
}

const proposalFor = values => buildProposal(parseIssueForm(issueBody(values)), rows)
const apply = proposal => applyProposal(csvText, proposal, { issueNumber: 42, today: '2026-10-16' })

describe('issue form', () => {
  it('matches the labels and options in the issue template', () => {
    for (const label of Object.values(FORM_FIELDS)) expect(template).toContain(`label: ${label}\n`)
    for (const option of [...Object.values(TYPE_OPTIONS), ...Object.keys(STATUS_OPTIONS), ...Object.keys(BASIS_OPTIONS)]) {
      expect(template).toMatch(new RegExp(`^ +- ${option}$`, 'm'))
    }
  })

  it('matches the report types used by the site links', () => {
    const source = readFileSync(new URL('../src/report-links.ts', import.meta.url), 'utf8')
    for (const key of ['correction', 'supplement', 'newSite']) expect(source).toContain(`${key}: '${TYPE_OPTIONS[key]}'`)
  })

  it('parses rendered fields, empty answers and checkboxes', () => {
    const form = parseIssueForm(issueBody({ type: TYPE_OPTIONS.correction, datacenter: 'gm-hamar · OSL-Hamar', mw_planned: '160', sources: 'https://example.com/a' }))
    expect(form.isForm).toBe(true)
    expect(form.fields.datacenter).toBe('gm-hamar · OSL-Hamar')
    expect(form.fields.name).toBe('')
    expect(form.fields.confirm).toMatch(/\[X\]/)
    expect(form.duplicates).toEqual([])
  })

  it('reports repeated headings instead of letting the last one win', () => {
    const body = `${issueBody({ type: TYPE_OPTIONS.correction, sources: 'https://example.com' })}\n\n### ${FORM_FIELDS.mw_in_use}\n\n999`
    expect(parseIssueForm(body).duplicates).toEqual(['mw_in_use'])
  })

  it('hashes bodies independent of line endings', () => {
    expect(bodyHash('a\r\nb\r\n')).toBe(bodyHash('a\nb'))
  })
})

describe('values', () => {
  it('reads MW and rejects energy and text', () => {
    expect(parseMwInput('')).toEqual({ value: undefined })
    expect(parseMwInput('ukjent')).toEqual({ value: null })
    expect(parseMwInput('12,5')).toEqual({ value: '12.5' })
    expect(parseMwInput('40 MW')).toEqual({ value: '40' })
    expect(parseMwInput('12 GWh').error).toMatch(/energi/)
    expect(parseMwInput('ca. 40').error).toBeTruthy()
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

describe('proposals', () => {
  it('changes only the line of the target row and keeps line endings', () => {
    const proposal = proposalFor({
      type: TYPE_OPTIONS.correction, datacenter: 'gm-hamar · OSL-Hamar', description: 'Ny kilde oppgir 40 MW i bruk.',
      mw_in_use: '40', sources: 'https://example.com/hamar 2026-09-01',
    })
    expect(proposal.errors).toEqual([])
    expect(proposal.kind).toBe('update')
    expect(proposal.changes).toEqual({ mw_in_use: '40' })
    const applied = apply(proposal)
    const before = csvText.split('\r\n')
    const after = applied.csv.split('\r\n')
    expect(after).toHaveLength(before.length)
    expect(after.filter((line, index) => line !== before[index])).toHaveLength(1)
    expect(applied.after.source_urls.endsWith('|https://example.com/hamar')).toBe(true)
    expect(applied.after.source_dates.endsWith('|2026-09-01')).toBe(true)
    expect(applied.after.reviewed_at).toBe('2026-10-16')
  })

  it('never fills in values that were left empty', () => {
    const proposal = proposalFor({ type: TYPE_OPTIONS.supplement, datacenter: 'lefdal', description: 'Legger til ny kilde om anlegget.', sources: 'https://example.com/lefdal' })
    expect(proposal.changes).toEqual({})
    const applied = apply(proposal)
    for (const column of ['mw_in_use', 'mw_reserved', 'mw_planned', 'mw_queued']) expect(applied.after[column]).toBe(applied.before[column])
  })

  it('rejects energy in MW fields and a planned number without basis', () => {
    const energy = proposalFor({ type: TYPE_OPTIONS.correction, datacenter: 'lefdal', description: 'Forbruket var 120 GWh i fjor.', mw_in_use: '120 GWh', sources: 'https://example.com' })
    expect(energy.errors.join(' ')).toMatch(/energi/)
    expect(() => apply(energy)).toThrow()
    const basis = proposalFor({ type: TYPE_OPTIONS.newSite, name: 'Testsenter', operator: 'Test AS', kommune: 'Bergen', place: 'Bergen', status: 'Planlagt', power_status: 'Planlagt kapasitet.', mw_planned: '10', description: 'Nytt planlagt anlegg i Bergen.', sources: 'https://example.com' })
    expect(basis.errors.join(' ')).toMatch(/Hva det planlagte tallet beskriver/)
  })

  it('requires sources and confirmation', () => {
    const proposal = proposalFor({ type: TYPE_OPTIONS.correction, datacenter: 'lefdal', description: 'Tallet er feil.', mw_in_use: '3', confirm: false })
    expect(proposal.errors.join(' ')).toMatch(/kilde/)
    expect(proposal.errors.join(' ')).toMatch(/Bekreftelsen/)
  })

  it('adds a new site as a valid row and flags likely duplicates', () => {
    const proposal = proposalFor({
      type: TYPE_OPTIONS.newSite, name: 'Fjordsenter Øst', operator: 'Fjord Data AS', operator_orgnr: '123 456 789', kommune: 'Bergen', place: 'Bergen',
      status: 'Planlagt', mw_planned: '20', mw_planned_basis: 'IT-kapasitet', power_status: 'Annonsert IT-kapasitet 20 MW.',
      description: 'Nytt anlegg omtalt i lokalavisen.', sources: 'https://example.com/fjord 2026-08-01',
    })
    expect(proposal.errors).toEqual([])
    const applied = apply(proposal)
    expect(applied.id).toBe('fjordsenter-ost')
    expect(applied.after).toMatchObject({ precision: 'place', operator_orgnr: '123456789', mw_planned_basis: 'it_capacity', note: 'Innmeldt via GitHub-sak #42.' })
    expect(applied.csv.split('\r\n')).toHaveLength(csvText.split('\r\n').length + 1)
    const existing = rows.find(row => row.id === 'lefdal')
    expect(findDuplicates({ kind: 'new', changes: { name: existing.name, kommune: existing.kommune } }, rows).map(item => item.id)).toContain('lefdal')
  })

  it('renders comments with markers the bot can read back', () => {
    const proposal = proposalFor({ type: TYPE_OPTIONS.correction, datacenter: 'gm-hamar', description: 'Ny kilde oppgir 40 MW i bruk.', mw_in_use: '40', sources: 'https://example.com/hamar' })
    const applied = apply(proposal)
    const assessment = assessmentBody({ proposal, preview: applied, hash: 'abc123', checkedAt: '2026-10-16', sourceChecks: [{ url: 'https://example.com/hamar', status: 'error', note: 'svarte ikke' }] })
    expect(markerAttribute(assessment, 'datasenter-bot:vurdering', 'sha')).toBe('abc123')
    expect(assessment).toContain('| I bruk (MW) | *tom (ukjent)* | 40 MW |')
    expect(assessment).toContain('usikkerhet')
    const pr = pullRequestBody({ issueNumber: 42, proposal, applied, hash: 'abc123', approvedBy: 'moderator', runUrl: 'https://example.com/run' })
    expect(markerAttribute(pr, 'datasenter-bot:issue', 'issue')).toBe('42')
    expect(markerAttribute(pr, 'datasenter-bot:site', 'site')).toBe('gm-hamar')
  })
})
