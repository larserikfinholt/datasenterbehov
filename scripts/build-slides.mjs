// Bygger presentasjonen til dist/presentasjon/ etter at Vite har bygget nettsiden.
import { cp, mkdir } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { marpCli } from '@marp-team/marp-cli'
import { SLIDES_DIR, SLIDE_SCRIPTS, prepareSlideAssets } from './slides-assets.mjs'

const outDir = fileURLToPath(new URL('../dist/presentasjon/', import.meta.url))

await prepareSlideAssets()
await mkdir(outDir, { recursive: true })
const exitCode = await marpCli([path.join(SLIDES_DIR, 'klimacafe.md'), '-o', path.join(outDir, 'index.html')])
if (exitCode !== 0) process.exit(exitCode)
await cp(path.join(SLIDES_DIR, 'fonts'), path.join(outDir, 'fonts'), { recursive: true })
await cp(path.join(SLIDES_DIR, 'qr.svg'), path.join(outDir, 'qr.svg'))
for (const { file } of SLIDE_SCRIPTS) await cp(path.join(SLIDES_DIR, file), path.join(outDir, file))
console.log(`Presentasjon skrevet til ${path.relative(process.cwd(), outDir)}`)
