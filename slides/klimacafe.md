---
marp: true
theme: datakraft
paginate: true
lang: nb
title: Trenger vi datasentre? Ja. Men hvor mange? | Klimacafé i Skien 15.10.2026
description: Ni lysbilder om datasentrene på kartet, KI-behovet i norsk arbeidsliv og nettkapasiteten som er reservert til nye datasentre. Lars Erik Finholt, Klimacafé i Skien 15. oktober 2026.
---

<!-- _class: lead -->
<!-- _paginate: false -->

<p class="eyebrow"><span class="mark"></span>Datakraftbehov / Norge <small>Klimacafé i Skien · 15. oktober 2026</small></p>

# Trenger vi datasentre? Ja. Men hvor mye?

<p class="sub">Digitalisering og kunstig intelligens</p>

<div class="byline"><span><strong>Lars Erik Finholt</strong> · 30 år med digitalisering, de siste fire også med KI</span><span>larserikfinholt.github.io/datasenterbehov</span></div>

<!--
Tid: 1,5 minutt.

- «Trenger vi datasentre? Ja. Vi bruker dem allerede hver dag. De driver digitale tjenester, lagrer informasjon og kjører kunstig intelligens. Det er nyttig, og det trenger vi.»
- «Jeg har jobbet med digitalisering i rundt 30 år, og de siste fire årene også med KI. Jeg ser hvor mye nytte dette kan gi.»
- «Men hvor mye ny datasenterkapasitet trenger vi egentlig? Det spørsmålet har jeg forsøkt å regne på.»
- «Her skal vi se på én del av behovet: KI i norsk arbeidsliv.»

Overgang: «Først: hvor mye kraft er det egentlig snakk om? La oss se på kartet.»
-->

---

<!-- _class: buildup-slide -->

<p class="eyebrow">1 / Datasentrene</p>

## Hvor mye kraft vil datasentrene ha?

<div class="buildup" data-datacenter-buildup></div>

<p class="note">Sum av oppgitte tall for 21 anlegg i prosjektets kartutvalg: nettreservasjon, omsøkt effekt og planlagt kapasitet utover dette. Tallene har ulike definisjoner, kan overlappe og er ikke en nasjonal oversikt.</p>

<script src="datacenter-buildup.js" defer></script>

<!--
Tid: 1,5 minutt. Animasjonen starter når lysbildet vises og tar rundt 20 sekunder. Gå tilbake og fram igjen for å spille den av på nytt.

- «Dette er datasentre i Norge som vi har funnet kilder for. De største kommer først: Gromstul her i Skien, så Bolvik i Skien, Narvik og Fyresdal.»
- «Stolpen til høyre legger sammen det som er oppgitt: kraft som er reservert i nettet, kraft det er søkt om, og planlagt kapasitet.»
- «Det blir flere tusen megawatt. Men tallene betyr ulike ting, og noen kan overlappe. Dette er ikke en offisiell oversikt, bare det vi har funnet kilder til.»
- «Noen anlegg har vi ikke tall for i det hele tatt. De vises som små prikker.»

Talernotat: summen er ikke det samme som 3 500 MW reservert nettkapasitet på «Hele arbeidslivet»-lysbildet. Den blander reservasjon, søknader og planer for 21 anlegg. Ikke bruk summen som et presist tall.

Overgang: «Så hvor mye av dette trenger vi selv? For å regne på hele arbeidslivet må vi begynne et sted. Først: hvor skjer egentlig KI-beregningen?»
-->

---

<!-- _class: compute-slide -->

<p class="eyebrow">2 / KI-beregningen</p>

## Hvor skjer KI-beregningen?

<div class="compute">
  <div class="dev">
    <span class="person" aria-hidden="true"></span>
    <div class="screen" aria-hidden="true"><i></i><i></i><i></i><span class="chip agent">Kodeagent</span></div>
    <p class="caption">Utvikler med kodeagent<small>Agenten sender forespørsler og mottar svar</small></p>
  </div>
  <svg class="links" viewBox="0 0 300 380" aria-hidden="true">
    <g class="link cloud">
      <path class="lane" d="M12 172 C150 172 150 89 288 89"/>
      <path class="lane" d="M288 101 C150 101 150 184 12 184"/>
      <text x="288" y="76" text-anchor="end">forespørsel →</text>
      <text x="288" y="126" text-anchor="end">← svar</text>
    </g>
    <g class="link local">
      <path class="lane" d="M12 196 C150 196 150 279 288 279"/>
      <path class="lane" d="M288 291 C150 291 150 208 12 208"/>
    </g>
  </svg>
  <div class="target cloud">
    <div class="dc" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i><span class="chip model">Modell</span></div>
    <p class="caption">Skymodell, f.eks. i USA<small>API: betaling per token</small></p>
  </div>
  <div class="target local" data-marpit-fragment>
    <div class="server compact" aria-hidden="true"><div class="box"><div class="gpu"></div><div class="gpu"></div><div class="gpu"></div><div class="gpu"></div><div class="gpu"></div><div class="gpu"></div><div class="gpu"></div><div class="gpu"></div></div><span class="chip model">Modell</span></div>
    <p class="caption">Lokal server med lokal modell<small>Egen maskinvare og strømforbruk</small></p>
  </div>
</div>

<p class="compute-takeaway" data-marpit-fragment>Vi kjører modellen lokalt. Derfor kan vi måle strømforbruket.</p>

<!--
Tid: 1,5 minutt. Utvikleren og forbindelsen til skymodellen vises med en gang. Første trykk viser den lokale serveren. Andre trykk fremhever den lokale forbindelsen og viser konklusjonen.

- «Når en utvikler bruker en kodeagent, er det ikke PC-en som gjør KI-beregningen. Agenten sender forespørsler til en språkmodell og får svar tilbake.»
- «Ofte kjører modellen i et stort datasenter, for eksempel i USA. Bruker man den via et API, betaler man gjerne per token. Strømforbruket ser man ikke.»
- (trykk) «Alternativet er en egen server. Da trenger man både maskinvaren og en modell som kan kjøres der. Og man betaler strømmen selv.»
- (trykk) «Vi kjører modellen lokalt. Derfor kan vi måle strømforbruket.»

Talernotat: skill agenten, som bruker modellen, fra modellen, som utfører KI-beregningen. Skymodeller kan kjøre flere steder; USA er bare et eksempel. Ikke alle utviklerverktøy fakturerer brukeren per token; det gjelder API-bruk.

Overgang: «Så la oss se på serveren vår.»
-->

---

<p class="eyebrow">3 / Utgangspunktet</p>

## Vi begynner med én maskin og 20 utviklere

<div class="machine">
  <figure class="server" aria-label="Én KI-server med åtte kort">
    <div class="box">
    <div class="gpu">KI-KORT</div><div class="gpu">KI-KORT</div><div class="gpu">KI-KORT</div><div class="gpu">KI-KORT</div>
    <div class="gpu">KI-KORT</div><div class="gpu">KI-KORT</div><div class="gpu">KI-KORT</div><div class="gpu">KI-KORT</div>
    </div>
    <figcaption>Én server. Målt: 4 400 W til KI-kortene.</figcaption>
  </figure>
  <div>
    <div class="people" aria-label="20 utviklere">
      <span></span><span></span><span></span><span></span><span></span><span></span><span></span><span></span><span></span><span></span>
      <span></span><span></span><span></span><span></span><span></span><span></span><span></span><span></span><span></span><span></span>
    </div>
    <p class="people-caption">20 utviklere deler maskinen</p>

* <p class="formula">4 400 W ÷ 20 = 220 W per utvikler<small>KI-kortene alene. Øvrig serverforbruk og kjøling kommer i tillegg.</small></p>

  </div>
</div>

<!--
Tid: 2 minutter. Regnestykket kommer fram ved neste trykk, etter at du har forklart hvem som deler maskinen.

- «Vi kan kjøre KI på en egen server og måle hvor mye strøm den bruker.»
- «Hos oss deler 20 utviklere én kraftig KI-server. Vi målte rundt 4 400 watt til kortene som gjør KI-beregningene. Fordelt på 20 utviklere blir det 220 watt hver.»
- «Dette er en fordeling av det målte forbruket, ikke en egen måling av hver utvikler. Resten av maskinen og kjølingen kommer i tillegg.»
- «Det gir oss et konkret utgangspunkt. Så må vi gjøre noen antakelser for å regne videre.»

Ved spørsmål: åtte NVIDIA H100-kort, åpne språkmodeller. Ikke nødvendig å nevne i innlegget.

Overgang: «Men trenger alle i arbeidslivet like mye KI som en utvikler?»
-->

---

<p class="eyebrow">4 / Yrkene</p>

## Trenger en gartner like mye KI som en utvikler?

<div class="trio">
  <div><div class="meter" data-occupation-meter data-value="100" data-marpit-fragment><p class="meter-number"><span class="meter-value">100</span>&nbsp;%<small>av utviklerens KI-datakraft</small></p><div class="meter-track" aria-hidden="true"><div class="meter-fill" style="height: 100%"></div></div></div>Utvikler<span>Flere KI-programmer i arbeid gjennom store deler av dagen</span></div>
  <div><div class="meter" data-occupation-meter data-value="3" data-marpit-fragment><p class="meter-number"><span class="meter-value">3</span>&nbsp;%<small>av utviklerens KI-datakraft</small></p><div class="meter-track" aria-hidden="true"><div class="meter-fill" style="height: 3%"></div></div></div>Gartner<span>Hjelp til planlegging og tilbud. Mye av dagen går til plantene</span></div>
  <div><div class="meter" data-occupation-meter data-value="8" data-fragment-follows-previous><p class="meter-number"><span class="meter-value">8</span>&nbsp;%<small>av utviklerens KI-datakraft</small></p><div class="meter-track" aria-hidden="true"><div class="meter-fill" style="height: 8%"></div></div></div>Barnehagelærer<span>Arbeider først og fremst med barna</span></div>
</div>

<p class="note">Alle kan ha nytte av KI. Det betyr ikke at alle trenger like mye datakraft. <small>Prosent: modellens basisfaktor for yrket, med utvikleren som referanse. En antakelse, ikke en måling.</small><small>Kilde til årsverk: SSB, tabell 11658 (2025). KI-faktorene er modellantakelser, ikke SSB-statistikk over KI-eksponering.</small></p>

<script src="occupation-meters.js" defer></script>

<!--
Tid: 2 minutter. Første trykk viser utvikleren. Andre trykk viser gartner og barnehagelærer samtidig. Tallene teller opp og stolpene fylles.

- «En utvikler kan ha flere KI-programmer i arbeid gjennom store deler av dagen, for eksempel til å skrive og teste kode.» (trykk: 100 %)
- (trykk: 3 % og 8 %) «En gartner kan få hjelp med planlegging og tilbud, men bruker også mye av dagen på å stelle planter.» «En barnehagelærer arbeider først og fremst med barna.»
- «Alle kan ha nytte av KI. Det betyr ikke at alle trenger like mye datakraft.»
- «Vi bruker SSBs kartlegging av arbeidsoppgaver til å anslå forskjellene mellom yrkene. Det er ikke en strømmåling, men en antakelse vi kan undersøke og diskutere.»

Talernotat: SSB kartlegger hvilke arbeidsoppgaver KI kan påvirke, ikke strømbruk. Koblingen er en sentral usikkerhet. Ulik type arbeid, ikke ulik verdi av arbeidet.
Prosentene er basisfaktorene i data/workforce.csv (Programvareutviklere 1,00, Gartnere 0,03, Førskole-/barnehagelærere 0,08). Lav–høy: gartner 1–8 %, barnehagelærer 2–18 %. Faktorene er scenarioantakelser fra kilderepoet, ikke SSB-estimater; SSB-grunnlaget er årsverkene (tabell 11658).

Overgang: «Da kan vi sette sammen regnestykket.»
-->

---

<p class="eyebrow">5 / Regnestykket</p>

## Fra én utvikler til hele arbeidslivet

<div class="equation">
  <p class="term">3 mill.<small>i arbeid i Norge</small></p>
  <span class="times" aria-hidden="true">×</span>
  <p class="term">220 W<small>per utvikler, målt</small></p>
  <span class="times" aria-hidden="true">×</span>
  <p class="term">yrkesvekting<small>fra 3 % til 100 % av utvikleren</small></p>
</div>

<p class="note">Forenklet regnestykke. Den fullstendige formelen, med alle forutsetninger, står på nettsiden: <strong>larserikfinholt.github.io/datasenterbehov</strong></p>

<!--
Tid: 1 minutt.

- «Nå har vi det vi trenger for å regne. Rundt tre millioner mennesker i arbeid. 220 watt per utvikler, som vi målte. Og en vekting etter yrke: gartneren får 3 prosent, utvikleren 100.»
- «Dette er en forenklet versjon. Hele formelen, med alle antakelsene, ligger på nettsiden.»

Talernotat: forenklingen går ikke opp til 300 MW hvis man regner den ut. SSB-grunnlaget er rundt 2,5 millioner årsverk (tabell 11658, 2025), og årsverksvektet snitt av yrkesfaktorene er omtrent 0,25. Med 220 W gir det rundt 135–165 MW. 300 MW på neste lysbilde er nettsidens høyscenario: 640 W per aktiv referansebruker (hele H100-serveren delt på 10 brukere) og 80 % KI-adopsjon. Ved spørsmål: vis til nettsiden.

Overgang: «Hva blir summen hvis vi regner som om hele norsk arbeidsliv tar KI i bruk?»
-->

---

<p class="eyebrow">6 / Hele arbeidslivet</p>

## Hva blir det for hele norsk arbeidsliv?

<div class="bars" role="img" aria-label="To vannrette stolper på samme skala fra 0 til 3 500 MW. Anslått KI-behov i norsk arbeidsliv: 300 MW. Reservert nettkapasitet til nye datasentre per mars 2026: 3 500 MW.">
  <div>
    <p class="label">Anslått KI-behov i norsk arbeidsliv<small>GPU-effekt når arbeidslivet er aktivt</small></p>
    <div class="track"><div class="bar" style="width: 8.57%"></div><span class="value" style="left: calc(8.57% + 18px)">300 MW</span></div>
  </div>
  <div class="grow" data-marpit-fragment>
    <p class="label">Reservert nettkapasitet til nye datasentre<small>Per mars 2026</small></p>
    <div class="track"><div class="bar capacity" style="width: 100%"></div><span class="value inside">3 500 MW</span></div>
  </div>
  <div class="scale" aria-hidden="true"><span>0</span><span style="left: 28.57%">1 000</span><span style="left: 57.14%">2 000</span><span style="left: 85.71%">3 000</span><span style="left: 100%">3 500 MW</span></div>
</div>

<p class="note">Regnet på KI-kortene i arbeid. Resten av serverne, kjøling, modelltrening og privat bruk kommer i tillegg. Reservert kapasitet er ikke ferdigbygde anlegg.</p>

<!--
Tid: 2,5 minutter. Begge tekstene og stolpen for 300 MW vises med en gang. Ett trykk får stolpen for 3 500 MW til å vokse fram.

- «Vi regner som om hele arbeidslivet tar KI i bruk. Vi bruker den KI-intensive utvikleren som referanse, justerer for yrkene og runder opp.»
- «Da kommer vi til omtrent 300 megawatt når arbeidslivet er aktivt. Megawatt er et mål på hvor mye strøm som brukes på én gang.»
- «Til sammenligning var 3 500 megawatt reservert til nye datasentre per mars 2026. Det reserverte tallet er over ti ganger større.» (trykk: stolpen vokser til 3 500 MW)
- «Men husk hva vi har regnet på: KI-kortene i arbeid. Resten av serverne, kjøling, modelltrening og privat KI-bruk er ikke med. Og reservert kapasitet betyr ikke ferdigbygde anlegg.»
- «Forskjellen betyr ikke at resten er unødvendig. Datasentre brukes også til andre tjenester og av utenlandske kunder. Men vårt regnestykke gir grunn til å spørre om norsk arbeidslivs KI-bruk kan forklare størrelsen.»

Talernotat: effekt, ikke årlig energibruk. Hold deg til MW. Si avgrensningene høyt. Et høyt scenario er ikke en sikker øvre grense.
Før framføring: kontroller primærkilden til 3 500 MW per mars 2026.

Overgang: «Og hvor stort er egentlig 300 megawatt? Her i Skien har vi en lokal sammenligning.»
-->

---

<!-- _class: benefit-slide -->

<div class="benefit">
  <div class="benefit-map" data-datacenter-map data-highlight="google-skien" data-label="Gromstul, Skien"></div>
  <div class="benefit-text">
    <p class="eyebrow">7 / Samfunnsnytten</p>
    <h2>Hva er samfunnsnytten?</h2>
    <ul class="claims"><li>«Digitalisering»</li><li>«Grønt skifte»</li><li>«KI for norske bedrifter»</li></ul>
    <p class="verdict">Dette er ikke tilstrekkelige begrunnelser. Vårt anslag for KI-behovet i norsk arbeidsliv forklarer ikke omfanget av utbyggingen.</p>
    <div class="linkline"><span>Regnestykket og forutsetningene:<br><strong>larserikfinholt.github.io/datasenterbehov</strong></span><img src="qr.svg" alt="QR-kode til larserikfinholt.github.io/datasenterbehov"></div>
  </div>
</div>

<script src="datacenter-buildup.js" defer></script>

<!--
Tid: 2 minutter. Kartet er det samme som på første lysbilde, nå uten animasjon. Gromstul er merket.

- «Her er kartet vi startet med. Gromstul her i Skien er merket.»
- «Når utbyggingen skal begrunnes, hører vi ofte: digitalisering, grønt skifte, KI for norske bedrifter. Det er gode formål. Men de er ikke nok til å begrunne en utbygging i denne størrelsen.»
- «Regnestykket vårt utfordrer begrunnelsen for størrelsen. KI-behovet i norsk arbeidsliv forklarer ikke omfanget av det som bygges og planlegges.»
- «Det betyr ikke at sentrene er uten nytte for norske bedrifter. Det har vi ikke regnet på, og det er ikke det jeg sier.»
- «Hvis mye av kapasiteten skal brukes til å eksportere datakraft, må samfunnsnytten vurderes ut fra verdien Norge får igjen. Den må veies opp mot kraften, nettet og naturen som brukes, og mot hva de ressursene ellers kunne gått til.»

Avslutning, kort pause før spørsmålene:
«Vi trenger datasentre. Men vi trenger også tydelige svar: Hvem skal bruke kapasiteten, og hva får Norge igjen for kraften, nettet og naturen vi stiller til disposisjon?»

Ved spørsmål om Gromstul: Google oppgir 240 MW tildelt kraftkapasitet i første fase. Ikke direkte sammenlignbart med 300 MW: vårt tall gjelder bare KI-kortene, Googles tall gjelder kapasitet til hele anlegget.
Kilde 240 MW: https://kommunikasjon.ntb.no/pressemelding/18046820/google-starter-bygging-av-et-nytt-datasenter-i-skien-investerer-600-millioner-euro?lang=no&publisherId=8930805
-->

---

<!-- _class: website-slide -->
<!-- _paginate: false -->

<iframe src="https://larserikfinholt.github.io/datasenterbehov/" title="Datakraftbehov i Norge" loading="lazy"></iframe>
