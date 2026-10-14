// Legger lokale skrifter og QR-kode i slides/ slik at både `marp -s slides` og
// det ferdige bygget kan vise presentasjonen uten nettverk.
import { copyFile, mkdir, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import QRCode from 'qrcode'

export const SITE_URL = 'https://larserikfinholt.github.io/datasenterbehov/'
export const SLIDES_DIR = fileURLToPath(new URL('../slides/', import.meta.url))
const ROOT = fileURLToPath(new URL('../', import.meta.url))

export const FONT_FILES = [
  '@fontsource-variable/source-sans-3/files/source-sans-3-latin-wght-normal.woff2',
  '@fontsource/source-serif-4/files/source-serif-4-latin-400-normal.woff2',
  '@fontsource/source-serif-4/files/source-serif-4-latin-500-normal.woff2',
]

export async function prepareSlideAssets() {
  const fontDir = path.join(SLIDES_DIR, 'fonts')
  await mkdir(fontDir, { recursive: true })
  for (const file of FONT_FILES) {
    await copyFile(path.join(ROOT, 'node_modules', file), path.join(fontDir, path.basename(file)))
  }
  const svg = await QRCode.toString(SITE_URL, { type: 'svg', margin: 0, errorCorrectionLevel: 'M', color: { dark: '#252824', light: '#0000' } })
  await writeFile(path.join(SLIDES_DIR, 'qr.svg'), svg)
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await prepareSlideAssets()
  console.log('Presentasjonsressurser skrevet til slides/fonts og slides/qr.svg')
}
