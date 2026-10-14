# Datakraftbehov / Norge

En redaksjonell, responsiv nettside om modellert AI-effektbehov i norsk arbeidsliv. Vite, TypeScript og semantisk HTML, uten backend, dashboard eller legacy-visning. Skrifter leveres lokalt.

Artikkel er publisert på kode24.no: https://www.kode24.no/artikkel/norge-setter-av-10-ganger-mer-kraft-til-datasentre-enn-vi-trenger/272717

Nettside: <https://larserikfinholt.github.io/datasenterbehov/>

Prosjekt: <https://github.com/larserikfinholt/datasenterbehov>

AI-agenter: les [AGENTS.md](AGENTS.md). Gjentakbare prompter, blant annet kildegjennomgang av datasenterkartet, ligger i [.agents/](.agents/).

## Publisering

GitHub Actions bygger, tester og publiserer til GitHub Pages ved push til `main`. GitHub Pages må bruke **GitHub Actions** som kilde i repoets innstillinger. Produksjonsbygget bruker `/datasenterbehov/` som base for skript, stiler og yrkesdata. Lokal forhåndsvisning etter `npm run build` og `npm run preview` ligger på samme understi.

## Presentasjon

Innlegget til Klimacafé i Skien 15.10.2026 ligger som [Marp](https://marp.app/)-lysbilder i [slides/klimacafe.md](slides/klimacafe.md), med snakkepunkter som presentatørnotater i HTML-kommentarer. Temaet i [slides/theme.css](slides/theme.css) bruker samme palett og skrifter som nettsiden. Bygget publiseres sammen med nettsiden på <https://larserikfinholt.github.io/datasenterbehov/presentasjon/> og lenkes fra bunnen av siden. Disposisjonen og talernotatene ligger i [article/Klimacafe-datasenter-disposisjon.md](article/Klimacafe-datasenter-disposisjon.md).

```sh
npm run slides:dev     # Marp-server med omlasting, åpne http://localhost:8080/klimacafe.md
npm run slides:build   # skriver dist/presentasjon/ (kjøres også av npm run build)
npm run slides:pdf     # PDF med notater til article/, krever Chrome eller Edge lokalt
```

Ferdig bygget versjon vises med `npm run build` og `npm run preview` på <http://127.0.0.1:4173/datasenterbehov/presentasjon/>. Marp-serveren viser bare utkastet med omlasting; lenken fra nettsiden testes mot forhåndsvisningen.

Skriftfiler og QR-kode til nettsiden genereres til `slides/fonts/` og `slides/qr.svg` ved bygging og er ikke sjekket inn. I presentasjonen gir `P` presentatørvisning med notater, `F` fullskjerm, og piltaster bytter lysbilde.

## Kjør lokalt

Node.js 22.18+ (eller nyere støttet LTS) og npm.

```sh
npm ci
npm run dev -- --host 127.0.0.1
```

Vite skriver lokal URL i terminalen og velger neste port dersom standardporten er opptatt.

## Kontroller

```sh
npm test
npm run build
npx playwright install chromium
npm run test:e2e
```

Playwright starter selv produksjonsforhåndsvisning på port 4177. Porten må være ledig. Testene dekker desktop, mobil, 320/375/768 px, lineær diagramskala, alle tre metoder, tastaturnavigasjon, FAQ, datalastingsfeil, søk og SSB-rekkefølge. Skjermbilder skrives til `artifacts/`.

## Beregning

`sum(årsverk × basisfaktor × 0,8) × watt / 1 000 000` gir MW i arbeidstiden.

- 2 465 032,25 kjente årsverk fra SSB tabell 11658, gjennomsnitt av fire kvartaler i 2025.
- 22 vurderte basisfaktorer, som dekker 30,5 % av kjente årsverk.
- 385 koder uten vurdert faktor får det årsverksvektede gjennomsnittet 0,2454626993. Vurderte faktorer beholdes. Dette kalles interpolasjon i grensesnittet, men er metodisk en usikker ekstrapolering.
- 14 koder mangler komplett årsverksgrunnlag. De står som ukjent, ikke null, og inngår ikke i summen. Observerte nullverdier beholdes.
- Høyscenario: 80 % adopsjon og `(8 × 700 W + 800 W) / 10 = 640 W` per aktiv referansebruker. Resultat: **309,7976166 MW**, avrundet til 310.
- Oppgitte driftserfaringer med GLM 5.3 Flash de siste ukene viser at serveren med 8 × NVIDIA H100 fint håndterer 20 samtidige brukere. Høyscenarioet beholder konservativt 10 brukere. Dette er ikke en standardisert ytelsestest. Merknaden vises bare når NVIDIA H100 er valgt.
- Lokal Mac: illustrativt 200 W / én bruker. Dette er lokal effekt, ikke datasenterlast eller et mål på likeverdig modellkvalitet.
- Fast effekt: 0 til 10 000 W i grensesnittet. Grensen holder segmentetikettene lesbare på samme lineære skala; den er ikke en fysisk begrensning i modellen.

Antakelsene ligger i [src/model.ts](src/model.ts). `CAPACITY_SCENARIO` inneholder de additive tallene 500 MW eksisterende, 700 MW ytterligere under bygging/forpliktet og 1 100 MW ytterligere planlagt. Både diagram og kapasitetstekster bruker konstanten. **Tallene er foreløpige scenariotall gitt i oppgaven, ikke en verifisert prosjektinventarliste.** Erstatt dem med kildebelagte data med dato, effektdefinisjon og ikke-overlappende prosjektstatus. Kontroller etiketter og diagramskala etter endringer.

## Kilder og reproduksjon

Opprinnelig datakilde (kun for sporbarhet): <https://github.com/larserikfinholt/DatacenterNeed>

Importen er låst til revisjon `9a6f7d727af24171593f15bde34c078bfacd08ad`, filen `data/norway/occupation-workforce-factors-2025-v0.csv`. SSB-data er kreditert Statistisk sentralbyrå, tabell 11658 (2025); kilderepoet oppgir CC BY 4.0 og hentedato 10.09.2026. Yrkesfaktorene er uavhengige scenarioantakelser fra kilderepoet, ikke SSB-estimater.

Bare én CSV kopieres til [data/workforce.csv](data/workforce.csv). [scripts/prepare-data.mjs](scripts/prepare-data.mjs) bruker en CSV-parser, bevarer kildeorden og genererer:

- [src/data/summary.json](src/data/summary.json): aggregater, seks eksempelrader, kilderevisjon og SHA-256 for CSV-en.
- [public/data/occupations.json](public/data/occupations.json): 407 yrkesrader, hentet først når «Vis alle yrker» åpnes. Ingen forhåndslasting eller initial rendering av hele tabellen.

```sh
npm run data:prepare
```

Dette regenererer fra den lokale CSV-en uten nettverk. `npm run data:refresh` henter eksplisitt den samme versjonslåste CSV-en på nytt. Bytt `SOURCE_COMMIT` i modellen ved en bevisst kildeoppdatering, regenerer og kjør testene. Bygg og vanlig sidebruk krever ikke kontakt med GitHub eller SSB.

Beregningsprinsippene er videreført, men ingen dashboardkode er portert. Mac-verdien er en ny illustrativ antakelse, ikke empirisk dokumentasjon.

## Datasenterkart

Kartet under introduksjonen viser et kildebelagt utvalg av 21 anlegg og prosjekter i Fastlands-Norge, ikke et fullstendig register. SVG-kystlinjen og anleggsposisjonene beregnes ved bygging; siden laster verken kartbibliotek eller kartdata over nettverket. Listen kan sorteres etter største oppgitte MW, navn eller status. Kart og liste deler markering ved peker og tastaturfokus; Enter eller mellomrom på en kartmarkør åpner den tilhørende listeposisjonen. Markører med radius under 8 enheter får et usynlig treffområde (`circle.marker-hit`, radius 10) bak den synlige sirkelen, slik at små prikker kan treffes med peker uten at sirkelarealet endres. Treffområdet er ikke fokuserbart; tastaturfokus går alltid til den synlige markøren.

```sh
npm run data:datacenters          # regenerer fra cacher; nett bare ved nye steder eller manglende cache
npm run data:datacenters:check    # offline; feiler hvis JSON eller metadata ikke matcher inndataene
npm run data:datacenters:refresh  # henter Nkom, Brønnøysund og geokoder på nytt
```

[data/datacenters.csv](data/datacenters.csv) er den kuraterte sannhetskilden. Kolonner:

`id,name,operator,operator_orgnr,kommune,place,lat,lon,precision,status,mw_in_use,mw_reserved,mw_planned,mw_planned_basis,mw_queued,power_status,source_urls,source_dates,reviewed_at,note`

- Én rad per fysisk anlegg eller campus; ikke én rad per bygg eller operatør. `id` er unik og bruker små ASCII-bokstaver, tall og bindestrek.
- `precision` er `site`, `place` eller `kommune`. Utvalget bruker omtrentlige stedsposisjoner, ikke verifiserte anleggskoordinater. `status` er `operating`, `construction` eller `planned` og beskriver campus; utvidelser kan fortsatt være planlagt ved et anlegg i drift.
- `mw_in_use` er dokumentert faktisk last. `mw_reserved` er strengt nettreservasjon eller tildelt nettkapasitet fra nettselskap eller Statnett; kundekontrakter og kontrahert IT-kapasitet føres ikke her. `mw_planned` er annonsert kapasitet eller potensial og krever `mw_planned_basis`: `it_capacity` (IT-effekt), `facility_capacity` (total anleggseffekt), `development_potential` (utbyggingspotensial), `announced_total` (annonsert tall uten oppgitt definisjon) eller `grid_connection` (planlagt nettilknytning). Basis uten `mw_planned`, eller omvendt, avvises. `mw_queued` er rapportert omsøkt effekt / kapasitetskø og vises separat som «Omsøkt / ikke tildelt». Tomme MW-felt blir `null` i JSON og betyr ukjent, ikke null MW; UI viser «Ukjent». Publisert operativ kapasitet er ikke målt forbruk og fylles ikke automatisk inn som «i bruk».
- `source_urls` er `|`-separert. `source_dates` har én ISO-dato per URL i samme rekkefølge; tom oppføring betyr udatert side og vises som «udatert». `reviewed_at` er ISO-datoen for prosjektets siste manuelle gjennomgang av raden mot kildene; tom betyr «Ikke gjennomgått mot kilde». Begge vises per anlegg i listen.
- `power_status` beskriver effektdefinisjonen for hvert anlegg, særlig forskjellen mellom IT-effekt, total anleggseffekt og utbyggingspotensial. Alle tall må støttes av `source_urls`. Sirkelareal og eksisterende maksimum-MW-sortering bruker bare maksimum av `mw_in_use`, `mw_reserved` og `mw_planned`; `mw_queued` holdes utenfor begge. Tall kan overlappe og summeres ikke. Ukjent MW i de tre størrelsesfeltene vises med en liten svart prikk med fast størrelse, også om køtall er oppgitt. Bare anlegg med kildebelagt plassering kartfestes. Campusstatus (`status`) holdes atskilt fra krafttildeling (`power_status` og MW-feltene).
- Google Gromstul i Skien har 240 MW innvilget nettkapasitet ifølge Datacenter Forum (12.02.2024) og NRK (20.04.2025), ikke dokumentert faktisk last. `mw_queued: 840` er historisk rapportert av NRK 20.04.2025; Datacenter Forum oppga 860 MW som tidligere behov, og avviket er ikke avklart. Det er uavklart om de tildelte 240 MW inngår i 840 MW eller kommer i tillegg. Ingen total utledes, og hele køtallet beskrives ikke som neste byggetrinn. Kildedato og overlappsforbehold beholdes i merknaden; dette er ikke verifisert som dagens Statnett-kø. Campus er fortsatt under bygging i dette utvalget; planlagt oppstart er ikke dokumentasjon på faktisk drift.
- Frier Vest i Bamble: BW Veloras pressemelding 29.05.2026 oppgir omtrent 250 MW planlagt kapasitet (`announced_total`), ikke en verifisert reservasjon. Molandsmoen i Fyresdal: kommunen oppgir 365 MW planlagt nettilknytning totalt (`grid_connection`), hvorav 140 MW tildelt og 225 MW i kø (`mw_queued`, oppdatert 27.08.2026). Digi omtaler påbegynt bygging 24.09.2026. Både reservasjonen og køtallet inngår i 365 MW og skal ikke legges til totalen. Køtallet er ikke verifisert som dagens Statnett-kø. Posisjonene er Kartverkets omtrentlige stedsposisjoner ved Rafnes og Molandsmoen, ikke verifiserte bygningstomter.
- Forskningsspor Telemark (lagt til 14.10.2026, alle `planned`): HER01 Herøya i Porsgrunn (Polar, 40 MW `it_capacity` fra pressemelding 12.05.2026; lokasjonssiden oppgir 41 MW IT og 100 MW energi), Nscale/Løvenskiold-Fossum ved Bolvik i Skien (ingen tildeling, 576 MW omsøkt ifølge E24 16.09.2026) og Nscales nabotomt til Google på Gromstul (96 MW omsøkt ifølge NRK 29.01.2026). De to Skien-radene har ukjent kapasitet og vises som svarte prikker; køtallene er søknader, ikke reservasjoner, og summeres ikke med Googles tall. Nabotomten deler Gromstul-punktet med Google, så kartet har to overlappende punkter der. Grenland transformatorstasjon er bevisst ikke kartfestet.
- MW for Bulk, Tydal og Røros står som ukjent fremfor å bruke ubekreftede tall. Bulk N01, OS-IX og Tydal kunne ikke leses maskinelt 14.10.2026 (samtykkevegg / uleselig side) og har tom `reviewed_at`. Utvalget utelater fortsatt andre prosjekter; manglende rad betyr ikke at et prosjekt ikke finnes.

### Kildekontroll 14.10.2026

Den opprinnelige Gromstul-raden manglet MW fordi den kun viste til Googles generelle lokasjonsoversikt. Dette var en mangel i kildeutvalget, ikke en beregningsfeil. Nkom-registeret er et operatørregister, ikke en komplett kilde til byggeplaner eller effekt. **Verken vanlig generering, `:check` eller `:refresh` oppdager nye prosjekter eller oppdaterer MW i CSV-en.** Prosjektdekning og effekt må gjennomgås manuelt mot prosjektkilder og nettkilder.

Gjennomgang 14.10.2026 av alle operatør- og pressesider i utvalget ga disse endringene og uløste punktene:

- **OSL-Hamar korrigert:** 90 MW sto som reservert, men kilden beskriver kontrahert IT-kapasitet for TikTok, altså en kundekontrakt. Feltet er tømt; 150 MW står som `it_capacity`, og flyttingen er forklart i merknaden.
- **Herøya:** pressemeldingen oppgir ca. 130 km fra Oslo, lokasjonssiden oppgir prisområde NO1 og 85 km, og IT-tallet er 40 mot 41 MW. Konflikten er notert, ikke løst.
- **Gromstul:** 840 MW (NRK 2025) mot 860 MW (Datacenter Forum 2024) som omsøkt behov. Ikke avstemt.
- **Nscale Skien:** det er uavklart om de 96 MW fra januar 2026 inngår i de 576 MW fra september 2026, og koblingen mellom 96 MW og nabotomten på Gromstul er en redaksjonell tolkning av to kilder. Raden kan fjernes til fordel for en ren README-omtale om tolkningen ikke holder.
- **Narvik:** operatøren beskriver 230 + 290 MW som additive faser (520 MW `announced_total`); DCD 30.01.2026 omtaler 230 og 250 MW separat. Ikke avstemt.
- **Ikke gjennomgått:** Tydal, Bulk N01 og Bulk OS-IX (sidene kunne ikke leses). Røros er gjennomgått, men artikkelen (06.02.2024) oppgir ikke effekt.
- 21 rader er fortsatt et utvalg; Statnett-listene er ikke importert.

Tre tidsstempler holdes atskilt og må ikke leses som verifikasjon av hverandre: `provenance.generatedAt` er tidspunktet inndataene (CSV, Nkom-, Brønnøysund-, totals- og geokodecache) sist endret seg, `nkom.fetchedAt` er når Nkom-listen faktisk ble lastet ned, og `reviewed_at` per rad er prosjektets manuelle kildegjennomgang. Begge de to første vises under «Nkom-registeret» på siden; `reviewed_at` og kildedato vises ved hvert anlegg.

[Statnetts tilknytningsstatistikk](https://www.statnett.no/nettkapasitet-til-produksjon-og-forbruk/foresporsler-og-reservasjon-i-nettet/#reservasjoner) har separate lister for reservasjoner, kapasitetskø og tilknyttet kapasitet i en offentlig Power BI-rapport. Kontrollert 14.10.2026: reservasjonssak 23/01250 (ELB1848) viser EdgeConneX MCN Norway AS ved Brokke med 140 MW; sak 22/00602 (ELB1426) viser WS Computing AS ved Rød med 120 MW. Sistnevnte er ikke uten videre samme størrelse som de historisk rapporterte 240 MW innvilget til Gromstul. Fordelingen mellom gjenværende reservasjon og tilknyttet kapasitet må avstemmes før tallet erstattes. WS Computing-saken ved Tegneby på 480 MW gjelder et annet sted og skal ikke legges på Gromstul.

Statnett-saker er nettilknytninger, ikke nødvendigvis fysiske campuser. Områdeplan er heller ikke fylke: Fyresdal-saken ligger under «Sør Rogaland og Agder». Filtrering bare på «Telemark og Vestfold» vil dermed miste et Telemark-prosjekt. Ikke kartfest transformatorstasjonen som datasenter, koble kun på operatørnavn, eller summer kø og reservasjoner uten å avklare prosjekt, byggetrinn og overlapp. Statnett-listene importeres foreløpig ikke automatisk; kildehenvisningen er en manuell kontroll, ikke en fullført nasjonal avstemming.

[scripts/prepare-datacenters.mjs](scripts/prepare-datacenters.mjs) leser Nkoms operatør-CSV (UTF-16 ved nedlasting), gjør én Brønnøysund-batch og kobler på organisasjonsnummer. Forretningskommune brukes bare som metadata; hovedkontor blir aldri kartfestet som datasenter. Registrerte operatører uten kuratert anlegg vises separat. Tomme `lat/lon` geokodes gjennom Kartverkets stedsnavn-API innen den oppgitte kommunen. Tvetydige treff avvises og krever eksplisitte koordinater; `site` krever kuraterte koordinater.

Kilder lagres under [data/sources](data/sources). Vanlige kjøringer gjenbruker cachene og gir identisk JSON uten nettverk; `--offline` gjør nettbehov til en feil, og `--check` (offline, skriver ingenting) feiler hvis [src/data/datacenters.json](src/data/datacenters.json) eller [data/sources/registry-metadata.json](data/sources/registry-metadata.json) ikke lenger matcher inndataene. `:refresh` henter Nkom, Brønnøysund og relevante geokoder på nytt. Nye steder eller manglende cacher trenger nettverk. JSON-en inneholder projeksjon, kildehenvisninger, registerkoblinger og en `provenance`-blokk med sha256 per inndatafil og en samlet `inputsSha256`. `generatedAt` oppdateres bare når denne samlede hashen endrer seg, og `nkom.fetchedAt` bare når Nkom-listen faktisk lastes ned; en ren regenerering gjør derfor ikke gamle påstander «nye». Linjeskift normaliseres før hashing, så et Windows-utsjekk med `core.autocrlf` rapporteres ikke som utdatert. Kystlinjen er Natural Earth via `world-atlas` (public domain); `d3-geo` og `topojson-client` brukes bare i byggeskriptet.

[data/sources/nkom-totals.json](data/sources/nkom-totals.json) er en manuelt verifisert snapshot av Nkoms oversikt, datert 14.10.2026: **117 registrerte datasentre og 61 kommersielle operatører**. Dette er ulike enheter; differansen 56 er ikke dokumentasjon på antall virksomhetsinterne datasentre. Oppdater snapshot bevisst mot oversiktssiden ved kilderevisjon; `:refresh` oppdaterer ikke disse manuelt kuraterte totalene. Endret operatørantall stanser byggingen til snapshot er gjennomgått.

`npm run build` regenererer og validerer datasentergrunnlaget før TypeScript/Vite. Valideringen ligger i [scripts/datacenter-rows.mjs](scripts/datacenter-rows.mjs): manglende eller ukjente kolonner, duplikate id-er, manglende kilder, ukjent status eller presisjon, negative eller ikke-numeriske MW (også `mw_queued`), `mw_planned` uten basis eller basis uten `mw_planned`, feil antall `source_dates`, ugyldige ISO-datoer, halve koordinatpar og koordinater utenfor Fastlands-Norges bounding box avvises. Fokuserte kontroller: `npm test -- src/datacenters.test.ts src/datacenter-rows.test.ts` og `npm run test:e2e -- --grep "Norway map"` etter bygging. Enhetstestene dekker parseren med malformet inndata, CSV/JSON-samsvar, overlapp (Fyresdal 140 + 225 ⊂ 365, aldri 730), kvadratrotsskala og sortering uten køtall, datainvarianter (datoer, basis, gjennomgang), registerkoblinger og en stale-test som hasher hver inndatafil på disk mot `provenance.inputs` og kjører `--check`. Karttestene kjører på desktop og mobil og kontrollerer også køfeltets tekst og plass, treffområdene for små prikker, tastatur-Enter på en ukjent-MW-prikk, kildedatoer, gjennomgangsmarkører og de to tidsstemplene. Skjermbilder: [artifacts/desktop-map.png](artifacts/desktop-map.png) og [artifacts/mobile-map.png](artifacts/mobile-map.png).

## Avgrensning

MW i arbeidstiden er ikke årsenergi, nettkapasitet eller total anleggseffekt. 1 725 aktive timer gir omtrent 534 GWh per år i høyscenarioet; PUE, tomgang, trening, privat bruk, tradisjonell sky og døgnkontinuerlige agenter er utelatt. Selvstendig næringsdrivende er heller ikke dekket av dette årsverksgrunnlaget.

310 MW er ikke en verifisert øvre grense for hele norsk arbeidsliv. Sammenligningen viser størrelsesorden, ikke ledig kapasitet. Modellen kan heller ikke dokumentere kundenes geografiske fordeling eller at utbygging faktisk primært er eksportrettet. Derfor presenteres dette som et argument som trenger prosjektdata, ikke som en dokumentert årsakssammenheng.