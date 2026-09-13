# Datakraftbehov / Norge

En redaksjonell, responsiv nettside om modellert AI-effektbehov i norsk arbeidsliv. Vite, TypeScript og semantisk HTML, uten backend, dashboard eller legacy-visning. Skrifter leveres lokalt.

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
- Lokal Mac: illustrativt 200 W / én bruker. Dette er lokal effekt, ikke datasenterlast eller et mål på likeverdig modellkvalitet.
- Fast effekt: 0 til 10 000 W i grensesnittet. Grensen holder segmentetikettene lesbare på samme lineære skala; den er ikke en fysisk begrensning i modellen.

Antakelsene ligger i [src/model.ts](src/model.ts). `CAPACITY_SCENARIO` inneholder de additive tallene 500 MW eksisterende, 700 MW ytterligere under bygging/forpliktet og 1 100 MW ytterligere planlagt. Både diagram og kapasitetstekster bruker konstanten. **Tallene er foreløpige scenariotall gitt i oppgaven, ikke en verifisert prosjektinventarliste.** Erstatt dem med kildebelagte data med dato, effektdefinisjon og ikke-overlappende prosjektstatus. Kontroller etiketter og diagramskala etter endringer.

## Kilder og reproduksjon

Kilderepo: <https://github.com/larserikfinholt/DatacenterNeed>

Importen er låst til revisjon `9a6f7d727af24171593f15bde34c078bfacd08ad`, filen `data/norway/occupation-workforce-factors-2025-v0.csv`. SSB-data er kreditert Statistisk sentralbyrå, tabell 11658 (2025); kilderepoet oppgir CC BY 4.0 og hentedato 10.09.2026. Yrkesfaktorene er uavhengige scenarioantakelser fra kilderepoet, ikke SSB-estimater.

Bare én CSV kopieres til [data/workforce.csv](data/workforce.csv). [scripts/prepare-data.mjs](scripts/prepare-data.mjs) bruker en CSV-parser, bevarer kildeorden og genererer:

- [src/data/summary.json](src/data/summary.json): aggregater, seks eksempelrader, kilderevisjon og SHA-256 for CSV-en.
- [public/data/occupations.json](public/data/occupations.json): 407 yrkesrader, hentet først når «Vis alle yrker» åpnes. Ingen forhåndslasting eller initial rendering av hele tabellen.

```sh
npm run data:prepare
```

Dette regenererer fra den lokale CSV-en uten nettverk. `npm run data:refresh` henter eksplisitt den samme versjonslåste CSV-en på nytt. Bytt `SOURCE_COMMIT` i modellen ved en bevisst kildeoppdatering, regenerer og kjør testene. Bygg og vanlig sidebruk krever ikke kontakt med GitHub eller SSB.

Beregningsprinsippene er videreført, men ingen dashboardkode er portert. H100-scenarioet er en synlig lokal tilpasning av kilderepoets delingsprinsipp, ikke dets 220 W-baseline. Mac-verdien er en ny illustrativ antakelse, ikke empirisk dokumentasjon.

## Avgrensning

MW i arbeidstiden er ikke årsenergi, nettkapasitet eller total anleggseffekt. 1 725 aktive timer gir omtrent 534 GWh per år i høyscenarioet; PUE, tomgang, trening, privat bruk, tradisjonell sky og døgnkontinuerlige agenter er utelatt. Selvstendig næringsdrivende er heller ikke dekket av dette årsverksgrunnlaget.

310 MW er ikke en verifisert øvre grense for hele norsk arbeidsliv. Sammenligningen viser størrelsesorden, ikke ledig kapasitet. Modellen kan heller ikke dokumentere kundenes geografiske fordeling eller at utbygging faktisk primært er eksportrettet. Derfor presenteres dette som et argument som trenger prosjektdata, ikke som en dokumentert årsakssammenheng.