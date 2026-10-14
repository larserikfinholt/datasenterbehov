# Handoff: datasenterkart – kvalitet og kildekontroll (WIP, 14.10.2026)

Arbeid pågår på branch `map`. Denne filen er en midlertidig overlevering mellom maskiner og skal slettes når arbeidet er ferdig. Ikke committet/publisert av agenten; brukeren committer selv.

## Oppgaven (uendret)

Forbedre kvalitet og pålitelighet i datasenterkartet uten redesign og uten full Statnett-import. Seks blokker: (1) kildedatoer og gjennomgangsdatoer, (2) tydelige kapasitetsdefinisjoner, (3) dekning/plassering med Telemark-spor først, (4) pipeline-validering og stale-deteksjon, (5) kartbrukbarhet (overlapp, små prikker, tastatur, datoer), (6) avgrensning og verifisering (README, tester, skjermbilder, ærlig rapport om uløste konflikter). Ikke rør `CAPACITY_SCENARIO` i `src/model.ts`. Ikke commit uten eksplisitt beskjed.

## Gjort så langt (alt ukommittet, verifisert med `npx tsc --noEmit` og `npm test -- src/datacenters.test.ts`)

### data/datacenters.csv
Ny header:
`id,name,operator,operator_orgnr,kommune,place,lat,lon,precision,status,mw_in_use,mw_reserved,mw_planned,mw_planned_basis,mw_queued,power_status,source_urls,source_dates,reviewed_at,note`

- `mw_planned_basis`: påkrevd når `mw_planned` er satt, tom ellers. Enum: `it_capacity | facility_capacity | development_potential | announced_total | grid_connection`.
- `source_dates`: `|`-separert, én oppføring per URL i `source_urls`, ISO-dato eller tom (= udatert side).
- `reviewed_at`: ISO-dato for prosjektets manuelle gjennomgang mot kilde, tom = ikke gjennomgått.
- `mw_reserved` er nå strengt nettreservasjon/tildeling.
- Kildegjennomgang 14.10.2026 (alle sider hentet 14.10.2026):
  - **gm-hamar korrigert**: 90 MW var kontrahert IT-kapasitet (TikTok), ikke nettreservasjon → `mw_reserved` tom, `mw_planned 150 (it_capacity)`; forklart i note.
  - Rennesøy 25 (it), Rjukan 50 (potential), Enebakk 75 (it; 94 MW «line of sight» nett nevnt, ikke ført), Undheim 100 (facility, 80 MW IT), Lefdal 200 (potential), Glomfjord 60 (announced), Narvik 520 (announced; operatøren selv beskriver 230 + 290 som additive), STACK 22/18 (announced), Drangedal 52 (it; DRA02 ca. 40 MW IT 23.07.2026), Frier Vest 250 (announced, 29.05.2026), Fyresdal 365 grid_connection / 140 reservert / 225 kø (kommune 27.08.2026; Digi 24.09.2026 bak betalingsmur, ingress sjekket), Google 240 reservert / 840 kø (NRK 20.04.2025; Datacenter Forum 12.02.2024 oppgir 860 MW tidligere behov – konflikt notert).
  - **Ikke gjennomgått** (`reviewed_at` tom): Tydal (side kunne ikke leses), Bulk N01 og OS-IX (samtykkevegg). Røros: artikkel 06.02.2024, ingen MW.
- **Nye rader (forskningsspor, Telemark)**, alle `planned`, posisjon fra Kartverket:
  - `polar-heroya` HER01 Herøya, Porsgrunn (59.11765, 9.63283), `mw_planned 40 it_capacity`. Kilder: pressemelding 12.05.2026 (40 MW IT, ~130 km fra Oslo) + udatert lokasjonsside (41 MW IT, 100 MW energi, NO1/85 km). **Konflikt NO1/NO2 og 40/41 MW er notert, ikke løst.**
  - `nscale-bolvik` Skien (59.12726, 9.51006), MW ukjent, `mw_queued 576` (E24 16.09.2026; TA 07.07.2026 bak betalingsmur). Grenland trafostasjon er bevisst ikke kartfestet.
  - `nscale-gromstul` nabotomt til Google (deler Gromstul-punktet 59.288, 9.571), MW ukjent, `mw_queued 96` (NRK 29.01.2026, DCD 30.01.2026, E24 16.09.2026). **Koblingen 96 MW ↔ denne tomta er redaksjonell tolkning; uavklart om 96 inngår i 576.** Vurder om denne raden skal beholdes eller bare dokumenteres i README.
  - Nå 21 rader; 5 svarte prikker (Tydal, Røros, Bulk ×2 … + Bolvik, Gromstul-nabo).

### scripts/datacenter-rows.mjs (ny, ren modul – importerbar fra vitest)
`parseSiteRows(csvText)` validerer kolonner (mangler/uventet → feil), id, status/precision-enum, påkrevde tekstfelt, orgnr, MW (`''` → null, kun `^\d+(\.\d+)?$`, negativ/NaN → feil), `mw_planned_basis`-regler, URL-er, `source_dates`-antall og ISO-datoer, `reviewed_at`, koordinatpar + bbox, `site` krever koordinater. Eksporterer `SITE_COLUMNS`, `PLANNED_BASES`, `MW_COLUMNS`, `parseMw`, `parseIsoDate`, `withinNorway`.

### scripts/prepare-datacenters.mjs (refaktorert)
- Bruker `parseSiteRows`. Flagg: `--refresh`, `--offline` (feiler ved nettbehov), `--check` (impliserer offline; skriver ingenting; feiler hvis `registry-metadata.json` eller `src/data/datacenters.json` ikke matcher inndataene).
- `provenance` i JSON: `generatedAt`, `nkomFetchedAt`, `inputsSha256`, `inputs` (sha256 per fil: CSV, nkom-operatorer.csv, brreg-enheter.json, nkom-totals.json, geocode-cache.json), `note`.
- `generatedAt` endres **bare** når inndata-hash endres (lagret i `data/sources/registry-metadata.json` som `inputsSha256`/`generatedAt`); `registryFetchedAt` (migrert fra `lastUpdated`) endres bare ved `--refresh`/ny Nkom-sha. Rebuild gjør altså ikke gamle påstander «nye».
- Verifisert: `node scripts/prepare-datacenters.mjs --offline` kjører uten nett; `--check` passerer; kjøring to ganger gir identisk JSON.
- `package.json`: nytt skript `data:datacenters:check`.

### src/datacenters.ts
Lagt til `PlannedBasis`, feltene `mw_planned_basis`, `source_dates`, `reviewed_at` i `DataCenter`, `plannedBasisLabels`, `formatIsoDate(iso) → dd.mm.yyyy`. Ingen endring i `maxMw`/`markerRadius`/`byMwDesc` (kø er fortsatt utenfor areal/sortering).

### Regenerert
`src/data/datacenters.json`, `data/sources/registry-metadata.json`.

## Gjenstår (i rekkefølge)

1. **Enhetstester** (nytt `src/datacenter-rows.test.ts` eller utvid `src/datacenters.test.ts`; vitest-include er `src/**/*.test.ts`):
   - `parseSiteRows` med malformet input: manglende kolonne, ukjent kolonne, `mw_planned` uten basis / basis uten `mw_planned`, negativ MW, `'abc'`, `source_dates`-antall ≠ URL-antall, ugyldig dato (`2026-13-01`), halvt koordinatpar, ugyldig URL. Ikke-regresjon: `''` → `null`, `'0'` → `0`.
   - Overlapp: Fyresdal 140 + 225 ⊂ 365 → `maxMw` 365, aldri 730; Google 240/840 → 240.
   - Stale-deteksjon: for hver nøkkel i `dataset.provenance.inputs`, sha256 av fila på disk === lagret hash; `dataset.provenance.inputsSha256` = sha256 av `name:hash`-linjer joinet med `\n` (samme formel som skriptet). Evt. også `execFileSync('node', ['scripts/prepare-datacenters.mjs', '--check'])`.
   - Datasett-invarianter: `source_dates.length === source_urls.length`; `reviewed_at`/datoer matcher ISO-regex; `mw_planned !== null ⇔ mw_planned_basis !== null`; gm-hamar `mw_reserved === null`; `reviewed_at` null for tydal/bulk-n01/bulk-osix.
2. **UI `src/datacenter-view.ts`** (behold de fire `dd`-feltene og rekkefølgen – e2e sjekker tekstene):
   - `dt` «Reservert» → «Nettreservasjon»; «Planlagt / kapasitet» får `<small>` med `plannedBasisLabels[site.mw_planned_basis]` når satt.
   - Kildelenker: `Kilde N (dd.mm.yyyy)` eller `Kilde N (udatert)` fra `source_dates`; legg til `<span class="site-review">Gjennomgått dd.mm.yyyy</span>` eller «Ikke gjennomgått mot kilde».
   - Små markører: for sirkler med `r < 8` tegn en usynlig treffsirkel `<circle class="marker-hit" data-site r="10" fill="transparent" pointer-events="all">` **før** den synlige (så synlig ligger øverst), uten `tabindex`; synlig sirkel beholder `r=3`, `tabindex`, `role=button`. Hover/klikk via `closest('[data-site]')` virker allerede.
   - Sterkere fokus/aktiv-ring for `.marker.unknown-mw.is-active / :focus-visible` (f.eks. stroke-width 4, stroke #a04429) i `src/editorial.css`; `.marker-hit { fill: transparent; stroke: none; cursor: pointer; }`.
   - Oppdater `figcaption#map-note`: reservert = nettreservasjon/tildeling; planlagt har oppgitt basis per anlegg; dato per kilde og gjennomgangsdato vises per anlegg; `generatedAt` er inndata-tidspunkt, ikke verifikasjon. Nevn at Gromstul har to overlappende punkter (Google + Nscale-nabotomt).
   - Vis `provenance.generatedAt` og `nkom.fetchedAt` separat i `details.map-registry` (formater med `Intl.DateTimeFormat('nb-NO', {dateStyle:'medium', timeStyle:'short', timeZone:'UTC'})`).
3. **E2E `e2e/story.spec.ts`** («Norway map»-testen): endre `.norway-outline circle` → `.norway-outline circle.marker` der radier sammenlignes; `toHaveCount(datacenters.sites.length)` for `circle.marker[data-site]`; legg til sjekk at `.marker-hit` finnes for alle `unknown-mw`, at tastatur-Enter på Bolvik-prikken fokuserer `#site-nscale-bolvik`, at Herøya viser «Kilde 1 (12.05.2026)» og «Kilde 2 (udatert)», at gm-hamar viser Nettreservasjon «Ukjent», og at «Gjennomgått 14.10.2026» finnes. Gromstul-tekstsjekkene finnes fortsatt i note.
4. **Kjør**: `npm test -- src/datacenters.test.ts src/datacenter-rows.test.ts`, `npm run build`, `npm run test:e2e -- --grep "Norway map"`. Se på `artifacts/desktop-map.png` og `artifacts/mobile-map.png`: Grenland-klyngen (Gromstul ×2, Frier Vest, Herøya, Bolvik, Drangedal) – vurder om prikker er synlige oppå Google-ringen; ikke endre tilsynelatende kapasitet.
5. **README.md** «## Datasenterkart»: ny kolonneliste og definisjoner (`mw_reserved` = nettreservasjon; `mw_planned_basis`-enum; `source_dates`; `reviewed_at`), tre tidsstempler (generatedAt = inndata, nkom.fetchedAt = Nkom-henting, reviewed_at = prosjektgjennomgang), `--offline`/`--check`, stale-test. Oppdater «### Kildekontroll 14.10.2026» med: Hamar-korrigeringen, Herøya NO1/NO2-konflikt, 840 vs 860 for Gromstul, Nscale Skien 96 vs 576 uavklart, Narvik Kvandal/Narvik (DCD 30.01.2026 omtaler 230 + 250 separat – ikke avstemt), Bulk/Tydal ikke lesbare, 21 rader er fortsatt et utvalg. Statnett-avsnittet beholdes (manuell kontroll, ingen import).
6. Slett denne filen, rapporter uløste konflikter ærlig. Ikke commit uten beskjed.

## Nyttig
- Nkom CSV er UTF-16LE ved nedlasting; 117 datasentre vs 61 operatører er ulike enheter.
- Kartverket: `https://api.kartverket.no/stedsnavn/v1/sted?sok=<navn>&treffPerSide=100` – Herøya og Bolvik er tvetydige, derfor eksplisitte koordinater i CSV.
- PowerShell: unngå doble anførselstegn inne i `node -e`.
