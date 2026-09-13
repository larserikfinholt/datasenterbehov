import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { parse } from 'csv-parse/sync'
import { SOURCE_COMMIT, SOURCE_REPO, weightedFactor } from '../src/model.ts'

const sourcePath = new URL('../data/workforce.csv', import.meta.url)
const sourceUrl = `https://raw.githubusercontent.com/larserikfinholt/DatacenterNeed/${SOURCE_COMMIT}/data/norway/occupation-workforce-factors-2025-v0.csv`
if (process.argv.includes('--refresh')) {
  const response = await fetch(sourceUrl)
  if (!response.ok) throw new Error(`Source download failed: ${response.status}`)
  const content = await response.text()
  if (parse(content, { columns: true, skip_empty_lines: true }).length !== 407) throw new Error('Expected 407 source rows')
  await mkdir(new URL('../data/', import.meta.url), { recursive: true })
  await writeFile(sourcePath, content)
}
const csv = await readFile(sourcePath, 'utf8')
const numeric = value => {
  if (value === '') return null
  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed < 0) throw new Error(`Invalid source number: ${value}`)
  return parsed
}
const rows = parse(csv, { columns: true, skip_empty_lines: true }).map(row => ({
  code: row.styrk08_code,
  title: row.occupation_label_no.replace(/\s+/g, ' ').trim(),
  fte: numeric(row.annual_fte_proxy_2025),
  factor: numeric(row.occupation_factor_base),
}))
if (rows.length !== 407 || new Set(rows.map(row => row.code)).size !== 407 || rows.some(row => !/^\d{4}$/.test(row.code))) {
  throw new Error('Expected 407 unique STYRK codes')
}
const fallback = weightedFactor(rows)
const exampleCodes = ['2512', '6113', '2611', '7115']
const sumFte = selection => selection.reduce((total, row) => total + (row.fte ?? 0), 0)
const otherAssessed = rows.filter(row => row.factor !== null && !exampleCodes.includes(row.code))
const unknown = rows.filter(row => row.factor === null)
const summary = {
  sourceRepo: SOURCE_REPO,
  sourceCommit: SOURCE_COMMIT,
  sourceSha256: createHash('sha256').update(csv).digest('hex'),
  sourceTable: 'SSB 11658, kvartalsgjennomsnitt 2025',
  count: rows.length,
  assessedCount: rows.filter(row => row.factor !== null).length,
  missingFteCount: rows.filter(row => row.fte === null).length,
  knownFte: sumFte(rows),
  assessedFte: sumFte(rows.filter(row => row.factor !== null)),
  fallback,
  equivalentsBeforeAdoption: rows.reduce((total, row) => total + (row.fte ?? 0) * (row.factor ?? fallback), 0),
  examples: [
    ...exampleCodes.map(code => rows.find(row => row.code === code)),
    { code: 'other-assessed', title: 'Øvrige vurderte yrker', fte: sumFte(otherAssessed), factor: weightedFactor(otherAssessed) },
    { code: 'interpolated', title: 'Andre/interpolerte yrker', fte: sumFte(unknown), factor: null },
  ],
}
await mkdir(new URL('../src/data/', import.meta.url), { recursive: true })
await mkdir(new URL('../public/data/', import.meta.url), { recursive: true })
await writeFile(new URL('../src/data/summary.json', import.meta.url), JSON.stringify(summary, null, 2) + '\n')
await writeFile(new URL('../public/data/occupations.json', import.meta.url), JSON.stringify(rows) + '\n')
console.log(JSON.stringify({ codes: rows.length, knownFte: summary.knownFte, weightedFactor: fallback, highScenarioMw: summary.equivalentsBeforeAdoption * 0.8 * 640 / 1e6 }, null, 2))