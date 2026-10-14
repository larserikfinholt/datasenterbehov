# AGENTS.md

Instruksjoner for AI-agenter som jobber i dette repoet. README.md er den fullstendige dokumentasjonen; denne filen sier hva som gjelder for deg som agent.

## Hva prosjektet er

En statisk, redaksjonell nettside (Vite + TypeScript, ingen rammeverk) som regner ut hvor mye datasenterkraft norsk arbeidsliv trenger til AI, og setter det opp mot et kildebelagt kart over norske datasentre. Troverdigheten hviler på at hvert tall har kilde, dato og tydelig definisjon. Et ubekreftet tall er verre enn «Ukjent».

## Regler

- **Ikke commit eller push.** Brukeren gjennomgår og committer selv. Si fra når arbeidet er klart.
- **Ikke rør `CAPACITY_SCENARIO` i `src/model.ts`** uten eksplisitt beskjed.
- **Ikke importer Statnett-lister automatisk.** De kontrolleres manuelt; se README «Kildekontroll».
- **Ikke gjett tall.** Tomt MW-felt betyr ukjent og vises som «Ukjent». Overlappende tall summeres aldri.
- **Rapporter ærlig.** Konflikter mellom kilder løses bare når kildene faktisk avklarer dem; ellers noteres de med dato i `note`-kolonnen og i README.
- **Behold de fire `dd`-feltene og rekkefølgen** i anleggslisten (`I bruk`, `Nettreservasjon`, `Planlagt / kapasitet`, `Omsøkt / ikke tildelt`). E2E-testene sjekker tekstene.
- Språk i UI, README, CSV-notater og commit-meldinger er norsk bokmål.

## Datasenterkartet

`data/datacenters.csv` er sannhetskilden. Kolonnedefinisjonene står i README «## Datasenterkart». Kort:

- `mw_reserved` er bare nettreservasjon eller tildelt nettkapasitet, aldri kundekontrakter.
- `mw_planned` krever `mw_planned_basis` (`it_capacity | facility_capacity | development_potential | announced_total | grid_connection`).
- `mw_queued` er søknad eller kapasitetskø og inngår ikke i sirkelareal eller sortering.
- `source_dates` har én ISO-dato per URL i `source_urls` (tom = udatert). `reviewed_at` er datoen raden sist ble gjennomgått mot kildene; tom = ikke gjennomgått.
- Validering ligger i `scripts/datacenter-rows.mjs`. Pipeline: `scripts/prepare-datacenters.mjs` med `--offline`, `--check` og `--refresh`.
- Uløste kildekonflikter står i README «### Kildekontroll <dato>» og i radens `note`. Hold de to i sync.

## Verifisering før du sier deg ferdig

```sh
node scripts/prepare-datacenters.mjs --offline   # regenerer JSON fra cacher
npm run data:datacenters:check                   # feiler hvis JSON er utdatert
npm test                                         # vitest
npx tsc --noEmit
npm run build
npm run test:e2e -- --grep "Norway map"          # Playwright, desktop + mobil
```

Se på `artifacts/desktop-map.png` og `artifacts/mobile-map.png` etter e2e.

Windows / Git Bash: `npm run` kan feile stille med exit 1 hvis `COMSPEC` er tom. Kjør `export COMSPEC='C:\Windows\System32\cmd.exe'` først. Utsjekket bruker `core.autocrlf`; pipelinen normaliserer linjeskift før hashing, så det er ikke en feil.

## Gjentakbare oppgaver

Ferdige prompter ligger i [`.agents/`](.agents/):

- [`.agents/kildegjennomgang.md`](.agents/kildegjennomgang.md): gå gjennom alle kilder på nytt, let etter nye og oppdaterte tall og nye anlegg, oppdater CSV og README.

## Andre deler

- `scripts/prepare-data.mjs` og `data/workforce.csv`: SSB-grunnlaget for beregningen. Se README «Kilder og reproduksjon».
- `slides/` og `scripts/build-slides.mjs`: Marp-presentasjon. Bygges av `npm run build`.
- `.github/workflows/pages.yml`: publisering til GitHub Pages.
