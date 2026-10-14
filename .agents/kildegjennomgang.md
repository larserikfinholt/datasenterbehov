# Kildegjennomgang av datasenterkartet

Bruk: start en ny agentøkt i repo-roten og lim inn teksten under streken. Les først [AGENTS.md](../AGENTS.md).

Sist kjørt: 14.10.2026 (se README «### Kildekontroll 14.10.2026»).

---

Gjør en kildegjennomgang av datasenterkartet på branch `map`. Ikke commit.

Kontekst: `data/datacenters.csv` er sannhetskilden. Les AGENTS.md, så README.md «## Datasenterkart» og den nyeste «### Kildekontroll»-seksjonen, inkludert kolonnedefinisjonene. Ikke rør `CAPACITY_SCENARIO` i `src/model.ts`. Ikke importer Statnett-lister automatisk.

For hver rad i CSV-en:

1. Hent hver URL i `source_urls` på nytt. Sammenlign med `mw_in_use`, `mw_reserved`, `mw_planned` (+ `mw_planned_basis`), `mw_queued`, `status` og `power_status`. Oppdater `source_dates` hvis siden nå har en dato. Sett `reviewed_at` til dagens dato for rader du faktisk fikk lest; la den stå tom hvis siden ikke kunne leses (samtykkevegg, betalingsmur, feil).
2. Søk etter nyere kilder for samme anlegg: operatørens egne sider, NRK, E24, DN, Digi, TA, Datacenter Dynamics, kommunens sider. Legg nye URL-er til `source_urls` med dato i `source_dates`.
3. Følg feltdefinisjonene strengt. `mw_reserved` er bare nettreservasjon eller tildeling fra nettselskap/Statnett, aldri kundekontrakter eller kontrahert IT-kapasitet. `mw_planned` krever `mw_planned_basis`. Søknader og kø går i `mw_queued`. Tomt felt betyr ukjent. Summer aldri overlappende tall.
4. Prøv eksplisitt å avklare de åpne konfliktene i nyeste «Kildekontroll»-seksjon i README. Løs bare det kildene faktisk avklarer; ellers oppdater radens `note` med ny dato og status.

Let også etter nye anlegg eller prosjekter i Norge (særlig Telemark og Grenland) som mangler i utvalget. Legg til rad bare med kildebelagt plassering. Posisjon fra Kartverket: `https://api.kartverket.no/stedsnavn/v1/sted?sok=<navn>&treffPerSide=100`, med eksplisitte `lat`/`lon` i CSV hvis stedsnavnet er tvetydig. Ikke kartfest transformatorstasjoner eller forretningsadresser som anlegg.

Etterpå:

```sh
export COMSPEC='C:\Windows\System32\cmd.exe'   # bare Windows / Git Bash
node scripts/prepare-datacenters.mjs --offline
npm run data:datacenters:check
npm test
npx tsc --noEmit
npm run build
npm run test:e2e -- --grep "Norway map"
```

Legg til en ny seksjon «### Kildekontroll <dagens dato>» i README under den forrige: hva som ble endret (rad, felt, gammelt og nytt tall, kilde og dato), hva som ble avklart, hva som fortsatt er åpent, og hvilke sider som ikke kunne leses. Hvis radantallet eller tekster som e2e sjekker endres (Gromstul, Fyresdal, Hamar, Herøya, Bolvik), oppdater `e2e/story.spec.ts` tilsvarende. Oppdater «Sist kjørt» øverst i denne filen.

Rapporter til slutt: endrede tall per rad med kilde og dato, nye rader, konflikter løst og uløst, sider som ikke kunne leses. Ikke gjett.
