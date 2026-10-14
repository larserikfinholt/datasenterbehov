# Datakraftbehov / Norge

En redaksjonell, responsiv nettside om modellert AI-effektbehov i norsk arbeidsliv. Vite, TypeScript og semantisk HTML, uten backend, dashboard eller legacy-visning. Skrifter leveres lokalt.

Artikkel er publisert på kode24.no: https://www.kode24.no/artikkel/norge-setter-av-10-ganger-mer-kraft-til-datasentre-enn-vi-trenger/272717

Nettside: <https://larserikfinholt.github.io/datasenterbehov/>

Prosjekt: <https://github.com/larserikfinholt/datasenterbehov>

## Publisering

GitHub Actions bygger, tester og publiserer til GitHub Pages ved push til `main`. GitHub Pages må bruke **GitHub Actions** som kilde i repoets innstillinger. Produksjonsbygget bruker `/datasenterbehov/` som base for skript, stiler og yrkesdata. Lokal forhåndsvisning etter `npm run build` og `npm run preview` ligger på samme understi.

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

Kartet under introduksjonen viser et kildebelagt utvalg av 18 anlegg og prosjekter i Fastlands-Norge, ikke et fullstendig register. SVG-kystlinjen og anleggsposisjonene beregnes ved bygging; siden laster verken kartbibliotek eller kartdata over nettverket. Listen kan sorteres etter største oppgitte MW, navn eller status. Kart og liste deler markering ved peker og tastaturfokus; Enter eller mellomrom på en kartmarkør åpner den tilhørende listeposisjonen.

```sh
npm run data:datacenters
npm run data:datacenters:refresh
```

[data/datacenters.csv](data/datacenters.csv) er den kuraterte sannhetskilden. Kolonner:

`id,name,operator,operator_orgnr,kommune,place,lat,lon,precision,status,mw_in_use,mw_reserved,mw_planned,power_status,source_urls,note`

- Én rad per fysisk anlegg eller campus; ikke én rad per bygg eller operatør. `id` er unik og bruker små ASCII-bokstaver, tall og bindestrek.
- `precision` er `site`, `place` eller `kommune`. Utvalget bruker omtrentlige stedsposisjoner, ikke verifiserte anleggskoordinater. `status` er `operating`, `construction` eller `planned` og beskriver campus; utvidelser kan fortsatt være planlagt ved et anlegg i drift.
- `mw_in_use` er dokumentert faktisk last, `mw_reserved` er kontrahert eller reservert effekt, og `mw_planned` er annonsert kapasitet eller utbyggingspotensial. Tomme felt betyr ukjent, ikke null. Publisert operativ kapasitet er ikke målt forbruk og fylles ikke automatisk inn som «i bruk».
- `power_status` beskriver effektdefinisjonen for hvert anlegg, særlig forskjellen mellom IT-effekt, total anleggseffekt og utbyggingspotensial. Alle tall må støttes av `source_urls`, separert med `|`. Sirkelareal følger maksimum av feltene; ulike effekttyper summeres ikke. Ukjent MW vises med en liten svart prikk med fast størrelse, ikke som null kapasitet. Bare anlegg med kildebelagt plassering kartfestes.
- Google Gromstul i Skien har 240 MW innvilget nettkapasitet ifølge Datacenter Forum (12.02.2024) og NRK (20.04.2025), ikke dokumentert faktisk last. NRK omtaler også 840 MW i kapasitetskø. Køtallet beholdes i merknaden, ikke som reservasjon eller et antatt samlet campustall. Campus er fortsatt under bygging i dette utvalget; planlagt oppstart er ikke dokumentasjon på faktisk drift.
- Frier Vest i Bamble: BW Veloras pressemelding 29.05.2026 oppgir omtrent 250 MW planlagt kapasitet, ikke en verifisert reservasjon. Molandsmoen i Fyresdal: kommunen oppgir 365 MW planlagt nettilknytning totalt, hvorav 140 MW tildelt og 225 MW i kø (oppdatert 27.08.2026). Digi omtaler påbegynt bygging 24.09.2026. Reservasjonen på 140 MW inngår i 365 MW og legges ikke til. Posisjonene er Kartverkets omtrentlige stedsposisjoner ved Rafnes og Molandsmoen, ikke verifiserte bygningstomter.
- MW for Bulk, Tydal og Røros står foreløpig som ukjent fremfor å bruke ubekreftede tall. Utvalget utelater fortsatt andre prosjekter; manglende rad betyr ikke at et prosjekt ikke finnes.

### Kildekontroll 14.10.2026

Den opprinnelige Gromstul-raden manglet MW fordi den kun viste til Googles generelle lokasjonsoversikt. Dette var en mangel i kildeutvalget, ikke en beregningsfeil. Nkom-registeret er et operatørregister, ikke en komplett kilde til byggeplaner eller effekt. **Verken vanlig generering eller `:refresh` oppdager nye prosjekter eller oppdaterer MW i CSV-en.** Prosjektdekning og effekt må gjennomgås manuelt mot prosjektkilder og nettkilder. `generatedAt` i JSON er Nkom-registerets hentetid, ikke verifikasjonsdato for alle prosjektopplysninger.

[Statnetts tilknytningsstatistikk](https://www.statnett.no/nettkapasitet-til-produksjon-og-forbruk/foresporsler-og-reservasjon-i-nettet/#reservasjoner) har separate lister for reservasjoner, kapasitetskø og tilknyttet kapasitet i en offentlig Power BI-rapport. Kontrollert 14.10.2026: reservasjonssak 23/01250 (ELB1848) viser EdgeConneX MCN Norway AS ved Brokke med 140 MW; sak 22/00602 (ELB1426) viser WS Computing AS ved Rød med 120 MW. Sistnevnte er ikke uten videre samme størrelse som de historisk rapporterte 240 MW innvilget til Gromstul. Fordelingen mellom gjenværende reservasjon og tilknyttet kapasitet må avstemmes før tallet erstattes. WS Computing-saken ved Tegneby på 480 MW gjelder et annet sted og skal ikke legges på Gromstul.

Statnett-saker er nettilknytninger, ikke nødvendigvis fysiske campuser. Områdeplan er heller ikke fylke: Fyresdal-saken ligger under «Sør Rogaland og Agder». Filtrering bare på «Telemark og Vestfold» vil dermed miste et Telemark-prosjekt. Ikke kartfest transformatorstasjonen som datasenter, koble kun på operatørnavn, eller summer kø og reservasjoner uten å avklare prosjekt, byggetrinn og overlapp. Statnett-listene importeres foreløpig ikke automatisk; kildehenvisningen er en manuell kontroll, ikke en fullført nasjonal avstemming.

[scripts/prepare-datacenters.mjs](scripts/prepare-datacenters.mjs) leser Nkoms operatør-CSV (UTF-16 ved nedlasting), gjør én Brønnøysund-batch og kobler på organisasjonsnummer. Forretningskommune brukes bare som metadata; hovedkontor blir aldri kartfestet som datasenter. Registrerte operatører uten kuratert anlegg vises separat. Tomme `lat/lon` geokodes gjennom Kartverkets stedsnavn-API innen den oppgitte kommunen. Tvetydige treff avvises og krever eksplisitte koordinater; `site` krever kuraterte koordinater.

Kilder lagres under [data/sources](data/sources). Vanlige kjøringer gjenbruker cachene og gir identisk JSON uten nettverk. `:refresh` henter Nkom, Brønnøysund og relevante geokoder på nytt og oppdaterer hentetid. Nye steder eller manglende cacher trenger nettverk. [src/data/datacenters.json](src/data/datacenters.json) inneholder projeksjon, kildehenvisninger, datostempel og registerkoblinger. Kystlinjen er Natural Earth via `world-atlas` (public domain); `d3-geo` og `topojson-client` brukes bare i byggeskriptet.

[data/sources/nkom-totals.json](data/sources/nkom-totals.json) er en manuelt verifisert snapshot av Nkoms oversikt, datert 14.10.2026: **117 registrerte datasentre og 61 kommersielle operatører**. Dette er ulike enheter; differansen 56 er ikke dokumentasjon på antall virksomhetsinterne datasentre. Oppdater snapshot bevisst mot oversiktssiden ved kilderevisjon; `:refresh` oppdaterer ikke disse manuelt kuraterte totalene. Endret operatørantall stanser byggingen til snapshot er gjennomgått.

`npm run build` regenererer og validerer datasentergrunnlaget før TypeScript/Vite. Duplikate id-er, manglende kilder, ukjent status eller presisjon, negative MW og koordinater utenfor Fastlands-Norges bounding box avvises. Tester dekker kvadratrotsskala, sortering, datainvarianter, registerkoblinger, interaksjon og null datakall ved sidelasting. Skjermbilder: [artifacts/desktop-map.png](artifacts/desktop-map.png) og [artifacts/mobile-map.png](artifacts/mobile-map.png).

## Avgrensning

MW i arbeidstiden er ikke årsenergi, nettkapasitet eller total anleggseffekt. 1 725 aktive timer gir omtrent 534 GWh per år i høyscenarioet; PUE, tomgang, trening, privat bruk, tradisjonell sky og døgnkontinuerlige agenter er utelatt. Selvstendig næringsdrivende er heller ikke dekket av dette årsverksgrunnlaget.

310 MW er ikke en verifisert øvre grense for hele norsk arbeidsliv. Sammenligningen viser størrelsesorden, ikke ledig kapasitet. Modellen kan heller ikke dokumentere kundenes geografiske fordeling eller at utbygging faktisk primært er eksportrettet. Derfor presenteres dette som et argument som trenger prosjektdata, ikke som en dokumentert årsakssammenheng.