---
marp: true
theme: datakraft
paginate: true
lang: nb
title: Trenger vi datasentre? Ja. Men hvor mange? | Klimacafé i Skien 15.10.2026
description: Fem lysbilder om KI-behovet i norsk arbeidsliv og nettkapasiteten som er reservert til nye datasentre. Lars Erik Finholt, Klimacafé i Skien 15. oktober 2026.
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

Overgang: «For å regne på hele arbeidslivet må vi begynne et sted. Vi begynner med én maskin.»
-->

---

<p class="eyebrow">1 / Utgangspunktet</p>

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

<p class="eyebrow">2 / Yrkene</p>

## Trenger en gartner like mye KI som en utvikler?

<div class="trio">
  <div>Utvikler<span>Flere KI-programmer i arbeid gjennom store deler av dagen</span></div>
  <div>Gartner<span>Hjelp til planlegging og tilbud. Mye av dagen går til plantene</span></div>
  <div>Barnehagelærer<span>Arbeider først og fremst med barna</span></div>
</div>

<p class="note">Alle kan ha nytte av KI. Det betyr ikke at alle trenger like mye datakraft.</p>

<!--
Tid: 2 minutter.

- «En utvikler kan ha flere KI-programmer i arbeid gjennom store deler av dagen, for eksempel til å skrive og teste kode.»
- «En gartner kan få hjelp med planlegging og tilbud, men bruker også mye av dagen på å stelle planter. En barnehagelærer arbeider først og fremst med barna.»
- «Alle kan ha nytte av KI. Det betyr ikke at alle trenger like mye datakraft.»
- «Vi bruker SSBs kartlegging av arbeidsoppgaver til å anslå forskjellene mellom yrkene. Det er ikke en strømmåling, men en antakelse vi kan undersøke og diskutere.»

Talernotat: SSB kartlegger hvilke arbeidsoppgaver KI kan påvirke, ikke strømbruk. Koblingen er en sentral usikkerhet. Ulik type arbeid, ikke ulik verdi av arbeidet.

Overgang: «Hva blir summen hvis vi regner som om hele norsk arbeidsliv tar KI i bruk?»
-->

---

<p class="eyebrow">3 / Hele arbeidslivet</p>

## Hva blir det for hele norsk arbeidsliv?

<div class="bars" role="img" aria-label="To vannrette stolper på samme skala fra 0 til 3 500 MW. Anslått KI-behov i norsk arbeidsliv: 300 MW. Reservert nettkapasitet til nye datasentre per mars 2026: 3 500 MW.">
  <div>
    <p class="label">Anslått KI-behov i norsk arbeidsliv<small>GPU-effekt når arbeidslivet er aktivt</small></p>
    <div class="track"><div class="bar" style="width: 8.57%"></div><span class="value" style="left: calc(8.57% + 18px)">300 MW</span></div>
  </div>
  <div>
    <p class="label">Reservert nettkapasitet til nye datasentre<small>Per mars 2026</small></p>
    <div class="track"><div class="bar capacity" style="width: 100%"></div><span class="value inside">3 500 MW</span></div>
  </div>
  <div class="scale" aria-hidden="true"><span>0</span><span style="left: 28.57%">1 000</span><span style="left: 57.14%">2 000</span><span style="left: 85.71%">3 000</span><span style="left: 100%">3 500 MW</span></div>
</div>

<p class="note">Regnet på KI-kortene i arbeid. Resten av serverne, kjøling, modelltrening og privat bruk kommer i tillegg. Reservert kapasitet er ikke ferdigbygde anlegg.</p>

<!--
Tid: 2,5 minutter.

- «Vi regner som om hele arbeidslivet tar KI i bruk. Vi bruker den KI-intensive utvikleren som referanse, justerer for yrkene og runder opp.»
- «Da kommer vi til omtrent 300 megawatt når arbeidslivet er aktivt. Megawatt er et mål på hvor mye strøm som brukes på én gang.»
- «Til sammenligning var 3 500 megawatt reservert til nye datasentre per mars 2026. Det reserverte tallet er over ti ganger større.»
- «Men husk hva vi har regnet på: KI-kortene i arbeid. Resten av serverne, kjøling, modelltrening og privat KI-bruk er ikke med. Og reservert kapasitet betyr ikke ferdigbygde anlegg.»
- «Forskjellen betyr ikke at resten er unødvendig. Datasentre brukes også til andre tjenester og av utenlandske kunder. Men vårt regnestykke gir grunn til å spørre om norsk arbeidslivs KI-bruk kan forklare størrelsen.»

Talernotat: effekt, ikke årlig energibruk. Hold deg til MW. Si avgrensningene høyt. Et høyt scenario er ikke en sikker øvre grense.
Før framføring: kontroller primærkilden til 3 500 MW per mars 2026.

Overgang: «Og hvor stort er egentlig 300 megawatt? Her i Skien har vi en lokal sammenligning.»
-->

---

<p class="eyebrow">4 / Gromstul, Skien</p>

## Hva skal kapasiteten brukes til?

<div class="compare">
  <div><p class="mw">240<small>MW</small></p><p>Tildelt kraftkapasitet, første fase på Gromstul<small>Google, pressemelding via NTB. Kapasitet til anlegget.</small></p></div>
  <div><p class="mw">300<small>MW</small></p><p>Anslått GPU-effekt til KI i norsk arbeidsliv<small>Vårt høye scenario. Bare KI-kortene i arbeid.</small></p></div>
</div>

<p class="question">Hva får Norge igjen?</p>

<div class="linkline"><span>Regnestykket og forutsetningene: <strong>larserikfinholt.github.io/datasenterbehov</strong></span><img src="qr.svg" alt="QR-kode til larserikfinholt.github.io/datasenterbehov"></div>

<!--
Tid: 2 minutter.

- «For å gjøre 300 megawatt litt mer konkret: Google oppgir 240 megawatt tildelt kraftkapasitet i første fase på Gromstul her i Skien.»
- «Tallene er ikke direkte sammenlignbare. Vårt tall gjelder KI-kortene, mens Googles tall gjelder kapasitet til anlegget. Men de viser størrelsesordenen.»
- «Hvis kapasiteten skal brukes til eksport av datakraft, må det sies tydelig. Da må vi også få vite hva Norge får igjen.»

Avslutning, kort pause før spørsmålene:
«Vi trenger datasentre. Men vi trenger også tydelige svar: Hvem skal bruke kapasiteten, og hva får Norge igjen for kraften, nettet og naturen vi stiller til disposisjon?»

Kilde 240 MW: https://kommunikasjon.ntb.no/pressemelding/18046820/google-starter-bygging-av-et-nytt-datasenter-i-skien-investerer-600-millioner-euro?lang=no&publisherId=8930805
Bilde fra Gromstul med kilde og dato kan legges til her når et bilde med bruksrett er på plass.
-->
