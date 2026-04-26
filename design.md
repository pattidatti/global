# 🌍 GEOPOLITY
### Et klasseromsspill om makt, økonomi og geopolitikk

> **Game Design Document · v0.7**  
> Konfidensielt arbeidsdokument
>
> v0.7 synkroniserer dette dokumentet med `IMPLEMENTATION_PLAN.md` v3 (etter andre plan-audit 2026-04-26). Endringer er listet i §16. Tekniske implementasjonsdetaljer ligger i implementeringsplanen — dette dokumentet er gameplay-sannhetskilden.

---

## Innhold

1. [Hva er nytt i v0.6 – Modell A](#1-hva-er-nytt-i-v06--modell-a)
2. [Verdensmodellen – ingen forhåndsdannede land](#2-verdensmodellen--ingen-forhåndsdannede-land)
3. [Regionkartet – struktur og skala](#3-regionkartet--struktur-og-skala)
4. [Spillerens start – én region](#4-spillerens-start--én-region)
5. [Geografisk ekspansjon – nabo til nabo](#5-geografisk-ekspansjon--nabo-til-nabo)
6. [Nasjonsbygging – «Erklær Norge!»](#6-nasjonsbygging--erklær-norge)
7. [NPC-regioner i Modell A](#7-npc-regioner-i-modell-a)
8. [Balanse – 150 spillere og ~2000 regioner](#8-balanse--150-spillere-og-2000-regioner)
9. [Kartsystemet – oppdatert for Modell A](#9-kartsystemet--oppdatert-for-modell-a)
10. [Fargesystemet – imperiefarger](#10-fargesystemet--imperiefarger)
11. [Spilløkken – oppdatert](#11-spilløkken--oppdatert)
12. [Alle øvrige mekanikker](#12-alle-øvrige-mekanikker)
13. [GitHub Pages og CI/CD](#13-github-pages-og-cicd)
14. [MVP-plan v6](#14-mvp-plan-v6)
15. [Åpne designspørsmål](#15-åpne-designspørsmål)
16. [Endringslogg](#16-endringslogg)

---

## 1. Hva er nytt i v0.6 – Modell A

Dette er den viktigste revisjonen i GDD-en så langt. Modell A endrer spillets grunnleggende premiss:

| Gammelt (Modell B/C) | Nytt (Modell A) |
|---|---|
| Land eksisterer fra start | Ingen land – bare ~2000 løse regioner |
| Spiller velger et land | Spiller velger én startregion |
| Ekspansjon = ta andre lands regioner | Ekspansjon = bygge imperium fra grunnen |
| «Norge» er gitt | «Norge» må bygges og erklæres |
| NPC er land-enheter | NPC er individuelle regioner |

**Konsekvenser for pedagogikken:**
Elevene opplever bokstavelig talt statsbygging. De forstår på kroppen hvorfor historiske riker vokste langs kystlinjer og elvedaler, hvorfor ressurser drev ekspansjon, og hvorfor det å «samle» et folk under ett flagg er et aktivt politisk valg – ikke en naturgitt ting.

---

## 2. Verdensmodellen – ingen forhåndsdannede land

### 2.1 Grunnpremiss

Verden ved spillstart er et kart bestående av **~2000 individuelle regioner** – ingenting annet. Ingen landgrenser. Ingen NATO. Ingen EU. Ingen «Russland» eller «USA».

Hver region er en selvstendig enhet med:
- Geografisk plassering og naboer
- Ressurstype(r) basert på geografi
- Befolkning og tilfredshet
- Forsvarsstyrke (lav ved spillstart)
- Historisk/kulturelt tilhørighetsdata (brukes til nasjonsdanning)

### 2.2 Hva finnes ved spillstart

```
VED SPILLSTART:

✅ ~2000 regioner på kartet
✅ Hver region styres av NPC (autonom, passiv)
✅ Ressurser produseres automatisk i alle regioner
✅ Naboforhold definert (hvem grenser til hvem)
✅ Kulturelle grupper definert (hvilke regioner «hører sammen»)

❌ Ingen land
❌ Ingen allianser
❌ Ingen handelsruter
❌ Ingen militærenheter (bygges av spillere)
❌ Ingen diplomati (ingen å diplomere med – ennå)
```

### 2.3 Kulturelle grupper – nøkkelen til nasjonsdanning

Bak kulissene har hver region en **kulturell tilhørighet** – en usynlig tag som definerer hvilke historiske land de «naturlig» hører til:

```json
{
  "region_vestland": {
    "culturalGroup": "nordic_norwegian",
    "historicalNation": "Norway",
    "iso": "NOR",
    "language": "no"
  },
  "region_ile_de_france": {
    "culturalGroup": "romance_french",
    "historicalNation": "France",
    "iso": "FRA",
    "language": "fr"
  }
}
```

Disse taggene brukes kun til nasjonsdanning (se seksjon 6). De er ikke synlige for spillere under normal spilling – men læreren kan se dem i administrasjonspanelet.

---

## 3. Regionkartet – struktur og skala

### 3.1 Antall regioner per geografisk område

Med ~2000 regioner globalt og 150 spillere trenger vi god dekning overalt – men spesielt i Europa og andre tett befolkede startområder.

```
Europa:          ~350 regioner  (tett befolket, mange startpunkter)
Asia:            ~500 regioner
Afrika:          ~350 regioner
Nord-Amerika:    ~300 regioner
Sør-Amerika:     ~250 regioner
Oseania:         ~100 regioner
Arktis/Antarktis: ~150 regioner (ressursrike, vanskelig å ta)
─────────────────────────────────────────
Totalt:         ~2000 regioner
```

### 3.2 Regiontyper og ressursdistribusjon

Ressurstypen til en region er **deterministisk basert på geografi** – ikke tilfeldig. Dette gjør at elevene lærer ekte geografi og ressursgeografi.

| Biom | Eksempelregioner | Primærressurs | Sekundærressurs |
|---|---|---|---|
| Kystlinje | Vestland, Bretagne, Bengal | 🐟 Fisk / 🌊 Handel | 🌾 Mat |
| Slette | Kansas, Ukraina, Ganges | 🌾 Mat | ⚡ Biomasse |
| Fjellkjede | Alpene, Himalaya, Andes | ⛏️ Metaller | 💎 Sjeldne mineraler |
| Skog/Taiga | Sibir, Canada, Skandinavia | 🌲 Tre | 🐾 Pelsverk |
| Ørken | Sahara, Arabia, Gobi | 🛢️ Olje/Gass | ☀️ Sol-energi |
| Regnskog | Amazonas, Kongo, Borneo | 🌿 Biomasse | 💊 Farmasi |
| Arktis | Svalbard, Grønland | 💎 Sjeldne mineraler | 🛢️ Olje |
| Byregion | London, Tokyo, New York | 💻 Teknologi | 💰 Finans |

### 3.3 Strategisk verdi

Regioner har en **strategisk verdiscore** (1–5 stjerner) som vises på kartet:

```
⭐      Lav verdi     – lite ressurser, ingen strategisk posisjon
⭐⭐    Middels       – nyttig, men ikke avgjørende
⭐⭐⭐  God           – verdifull ressurs ELLER strategisk posisjon
⭐⭐⭐⭐ Høy          – viktig knutepunkt, rik ressurs
⭐⭐⭐⭐⭐ Kritisk     – kontroll gir massiv fordel (Suez, Gibraltar, Baku...)
```

Spillerne ser strategisk verdiscore når de zoomer inn. Det er et naturlig pedagogisk hint om *hvorfor* historiske riker kjempet om bestemte steder.

---

## 4. Spillerens start – én region

### 4.1 Valg av startregion

Ved spillstart velger spilleren sin **én startregion** fra verdenskartet. Dette er den viktigste beslutningen de tar.

```
STARTREGION-VALGSKJERM:

[Verdenskart vises]

Klikk på en region for å se:
┌──────────────────────────────────────┐
│ 📍 VESTLAND                          │
│ Ressurs:    🛢️ Olje + 🌾 Mat        │
│ Naboer:     Rogaland, Møre, Sogn     │
│ Kulturgruppe: Nordisk/Norsk          │
│ Strategisk: ⭐⭐⭐                   │
│ Startbonus: +200🌾 +150🛢️           │
│                                      │
│ [✅ Velg denne regionen]             │
└──────────────────────────────────────┘
```

### 4.2 Startressurser

Alle spillere starter likt, uavhengig av region:

```
Startkapital:
  💰 500 penger
  ⚔️  50 militærstyrke (nok til å forsvare seg, ikke angripe)
  🌟  0 innflytelse (must be earned)

Startregionen gir i tillegg:
  Ressursproduksjon basert på biom (se seksjon 3.2)
  1 ledig byggeplass (starter tom)
  Befolkning: 100 000 – 2 000 000 (varierer per region)
```

### 4.3 De første 24 timene

Spilleren må umiddelbart:
1. Bygge sin første produksjonsbygning (velg strategisk basert på ressurs)
2. Utforske naboer (hvem kontrollerer dem? NPC eller annen spiller?)
3. Bestemme ekspansjonsretning

> **Pedagogisk poeng:** Valget av startregion er en læringssituasjon i seg selv. En spiller som velger en ørkenregion for oljens skyld, men mangler mat, lærer raskt om ressursavhengighet og handel.

---

## 5. Geografisk ekspansjon – nabo til nabo

### 5.1 Nabodefinisjonen

To regioner er naboer hvis deres GeoJSON-polygoner **deler en grense** (adjacency detection). Dette beregnes én gang ved spilloppstart og caches.

```javascript
// Forhåndsberegnet nabostruktur (kjøres én gang, lagres i Firebase)
{
  "adjacency": {
    "region_vestland":   ["region_rogaland", "region_hordaland", "region_sognog"],
    "region_rogaland":   ["region_vestland", "region_agder", "region_telemark"],
    // ... alle ~2000 regioner
  }
}
```

**Sjøgrenser:** Kystregioner er også naboer med havet – men marine-ekspansjon krever at spilleren har bygget en **havn** (en sjøregion teller som nabo for å krysse til neste kystregion).

### 5.2 Ekspansjonsregler

```
KAN angripe / diplomatisk overtakelse / investere i:
  ✅ Regioner som grenser direkte til en region du kontrollerer

KAN IKKE (uten spesialevne):
  ❌ Regioner som ikke er nabo
  ❌ Hopp over en fiendtlig region
  ❌ Oversjøisk ekspansjon (uten havn + marinestyrke)

Spesialregler:
  🚢 Havn bygget → kan nå nabo-kystregioner over hav
  ✈️ Flyplass bygget (sent spill) → kan deployere tropper langt borte
```

### 5.3 Ekspansjonsgrensesnitt på kartet

Når spilleren ser på kartet, vises ekspansjonsmuligheter tydelig:

```
FARGER PÅ NABOER (sett fra ditt territorium):

Din region:            Blå (din imperiumfarge)
Tilgjengelig nabo NPC: Grønn glød på kanten (kan angripes/tas over)
Tilgjengelig nabo spiller: Oransje glød (kan angripes, risikabelt)
Ikke tilgjengelig:     Ingen glød (for langt unna)
```

Klikk på en tilgjengelig naboRegion → ekspansjonsalternativene vises.

---

## 6. Nasjonsbygging – «Erklær Norge!»

Dette er Modell A sitt mest unike og pedagogisk kraftfulle element.

### 6.1 Hva er en nasjon i GEOPOLITY?

En nasjon er et **frivillig politisk konstrukt** – ikke en geografisk selvfølge. Spilleren må aktivt velge å danne den.

En nasjon i spillet gir:
- Felles flagg og navn (velges av spilleren)
- Diplomatisk enhet (andre kan forholde seg til nasjonen som én aktør)
- Handelsavtaler på nasjonsnivå
- Nasjonale bonuser (se nedenfor)
- Historisk-prestisjebonus hvis nasjonen matcher ekte historiske grenser

### 6.2 Krav for å danne en nasjon

```
MINSTEKRAV FOR NASJONSFORMASJON:

Alternativ A – Historisk nasjon (f.eks. «Norge»):
  ✅ Kontrollerer ≥ 70% av regionene som tilhører kulturgruppen «nordic_norwegian»
  ✅ Har minst 3 sammenhengende regioner
  ✅ Har minst én by-region (teknologi/finans-ressurs)
  ✅ Befolkningstilfredshet ≥ 50% i alle regioner

Alternativ B – Egendefinert nasjon (fritt navn og flagg):
  ✅ Kontrollerer ≥ 5 sammenhengende regioner
  ✅ Har minst én by-region
  ✅ Befolkningstilfredshet ≥ 40%
```

> **Endring v0.7:** Terskelen ble hevet fra 60% til 70% etter plan-audit. Den lavere terskelen gjorde nasjonsdanning for tilgjengelig allerede ved få regioner, særlig i kulturgrupper med lav regiondekning (f.eks. nordiske: 4–6 regioner). 70% gir bedre balanse mellom prestasjon og oppnåelighet.

### 6.3 Nasjonsformasjonsprosessen

```
STEG 1: Spilleren klikker «Danne nasjon» i menyen

STEG 2: Systemet sjekker krav
  → Oppfylt: gå til steg 3
  → Ikke oppfylt: viser hva som mangler («Trenger 2 flere norske regioner»)

STEG 3: Velg nasjonstype
  ┌────────────────────────────────────────────────┐
  │ 🏛️ DANNE NASJON                               │
  │                                                │
  │ Du kontrollerer 5 av 8 norske regioner.       │
  │                                                │
  │ [🇳🇴 Erklær Norge]   ← historisk nasjon       │
  │    Bonus: +20% produksjon i alle norske        │
  │    regioner, historisk prestisjebonus 500🌟    │
  │                                                │
  │ [⚑ Egendefinert nasjon]  ← fritt valg        │
  │    Velg navn og flagg selv                    │
  │    Bonus: +10% produksjon                     │
  └────────────────────────────────────────────────┘

STEG 4: Bekreftelse
  → Nasjonen opprettes
  → Flagg vises på alle spillerens regioner
  → Kunngjøring til alle spillere: «Norge er dannet!»
  → Læreren varsles
```

### 6.4 Nasjonsbonuser

| Nasjonstype | Bonus |
|---|---|
| Historisk nasjon (≥70% kulturmatch) | +20% produksjon, 500🌟, diplomatisk anerkjennelse |
| Historisk nasjon (≥85% kulturmatch) | +30% produksjon, 1000🌟, «Historisk imperium»-tittel |
| Historisk nasjon (100% kulturmatch) | +40% produksjon, 2000🌟, «Gjenforent folk»-tittel |
| Egendefinert nasjon | +10% produksjon, 200🌟 |

> **Endring v0.7:** Bonus-tiers rebalansert fra 60/80/100% til 70/85/100% slik at inngangsterskelen (70%) faller sammen med nedre bonus-tier — ingen «dødt vindu» mellom krav og belønning.

### 6.5 Multinasjonal spillerdynamikk

To spillere kan begge prøve å danne «Norge» – den første vinner retten til det historiske navnet. Den andre kan fortsatt danne en egendefinert nasjon med de norske regionene de kontrollerer.

Dette skaper naturlig konkurranse: **hvem når de nok norske regioner først?**

### 6.6 Nasjoner og diplomati

Etter at en nasjon er dannet kan spillere:
- Inngå diplomatiske avtaler som nasjon (ikke bare som enkeltspiller)
- Danne **forbund** med andre nasjoner (NATO-lignende)
- Søke om å **absorbere** en annen spillers nasjon (krever begge parters samtykke eller militær dominans)

---

## 7. NPC-regioner i Modell A

### 7.1 NPC-regionens natur

I Modell A finnes det ingen «NPC-land» – kun **NPC-regioner**. Hver av de ~2000 regionene er ved spillstart styrt av sin egen NPC, helt uavhengig av andre regioner.

```
NPC-region: Rogaland
  Produserer: 🛢️ 30/time, 🌾 20/time
  Forsvarer seg automatisk
  Reagerer på diplomatisk press
  Kan inngå primitive handelsavtaler
  Har INGEN kontakt med NPC-regionen Trøndelag
  (de er to helt separate enheter)
```

### 7.2 NPC-regionens atferd

NPC-regioner i Modell A er **langt enklere** enn Modell B/C sine NPC-land, fordi de er individuelle enheter uten grand strategy:

| Atferd | Beskrivelse |
|---|---|
| 🛡️ Forsvarer | Forsvarer seg hvis angrepet, bygger ikke aktivt opp militær |
| 💰 Handler | Aksepterer handelsforespørsler fra nabospillere |
| 😊 Reagerer | Tilfredshet påvirkes av naboenes handlinger (invasjoner senker tilfredshet i naboer) |
| 😴 Passiv | Gjør aldri første trekk – angriper aldri, ekspanderer aldri |

> **Designvalg:** NPC-regioner er bevisst passive. De er ressurspooler og geografiske hindringer – ikke aktive motstandere. De aktive motstanderne er andre spillere.

### 7.3 NPC-regional tilfredshet og overgivelse

En NPC-region som har lav tilfredshet over tid (på grunn av naboregioners påvirkning, trade-press, eller soft-power-kampanjer) kan **overgi seg frivillig** til en spiller som tilbyr bedre vilkår:

```
NPC-region: Tilfredshet synker til under 30%
  → «Regionens befolkning er misfornøyd med NPC-styret»
  → Naboende spiller ser melding: «Rogaland er ustabilt – klar for overtakelse?»
  → Diplomatisk overtakelse koster nå kun halvparten av normal pris
```

---

## 8. Balanse – 150 spillere og ~2000 regioner

### 8.1 Regnestykket

```
~2000 regioner ÷ 150 spillere = ~13 regioner per spiller ved full dekning

MEN: Ikke alle regioner er like attraktive.
Spillere vil klumpe seg i Europa, Midtøsten og kystregioner.
Arktis, dype ørkenregioner og øyer forblir NPC lenger.

Realistisk fordeling etter 1 måned:
  ~800 regioner kontrollert av spillere (40%)
  ~1200 regioner fortsatt NPC (60%)
```

### 8.2 Veksthastighet og balanse

For å hindre at én spiller dominerer hele spillet innføres **vedlikeholdskostnader**:

```
VEDLIKEHOLDSKOSTNAD PER REGION (per makro-tick/daglig):

Regioner 1–5:    💰 10/region  (nesten gratis)
Regioner 6–10:   💰 25/region  (håndterbart)
Regioner 11–20:  💰 60/region  (krever aktiv handel)
Regioner 21–35:  💰 120/region (krever allianser og effektiv økonomi)
Regioner 36+:    💰 200/region (imperienivå – risikabelt)
```

Dette betyr at ekspansjon uten tilsvarende inntektsvekst er **selvødeleggende** – akkurat som historiske imperier som overekspanderte.

### 8.3 Startsone-anbefaling til læreren

For å sikre at 150 spillere ikke alle starter i Europa, kan læreren **sette startsoner** ved spillopprettelse:

```
LÆRER-OPPSETT:
  «Velg startregion innenfor din tildelte sone»

Eksempel for 3 klasser à 50 elever:
  Klasse A: Kan starte i Europa eller Afrika
  Klasse B: Kan starte i Asia eller Oseania
  Klasse C: Kan starte i Amerika
```

Alternativt: alle velger fritt, men læreren ser fordelingen og kan gi bonus til spillere som velger underrepresenterte soner.

---

## 9. Kartsystemet – oppdatert for Modell A

### 9.1 Hva som endres fra v0.5

I Modell A finnes ingen landgrenser – **regiongrenser er de eneste grensene**. Dette endrer kartrenderingen fundamentalt.

```
MODELL B/C (v0.5):          MODELL A (v0.6):
  Tykke landgrenser           Ingen landgrenser
  Tynne regiongrenser         Kun regiongrenser
  Land = farge-blokk          Region = farge-enhet
  Zoom inn → regioner         Alle nivåer = regioner
```

### 9.2 Oppdaterte zoom-lag

#### Zoom 2–4: Verdensnivå
```
Vises:
  ✅ Regionfyllfarger (imperiumfarger der spillere finnes, grå NPC)
  ✅ Tydelige regiongrenser (1px) der spillere grenser til hverandre
  ✅ Svake NPC-regiongrenser (0.3px, nesten usynlig) – verden ser «uformet» ut
  ✅ Konfliktmarkører (rød puls) på omstridte regioner
  ✅ Imperiumhovedseter (stjerneikon der nasjonen er dannet)
```

#### Zoom 5–7: Nasjonsnivå
```
Vises:
  ✅ Tydelige regiongrenser (1.5px)
  ✅ Imperiumfarger per spiller
  ✅ Nasjonsnavn og flagg (hvis nasjon er dannet)
  ✅ Ressurstype-ikon (ett per region, viktigste ressurs)
  ✅ Strategisk verdi-stjerner
  ✅ NPC-regioner: beige/grå med svakt mønster
```

#### Zoom 8–10: Regionsnivå (Primær spilleskjerm)
```
Vises:
  ✅ Regiongrenser tydelig (2px)
  ✅ Regionsnavn
  ✅ Kontrollstatus-ikon (spiller-flagg eller NPC-ikon)
  ✅ Ressursikoner (alle ressurstyper i regionen)
  ✅ Integrasjonsprosent (ny region: fremdriftslinje)
  ✅ Naboglød (grønn/oransje) på tilgjengelige ekspansjonsmål
```

#### Zoom 11–14: Bygningsdetaljnivå
```
Vises:
  ✅ Bygningsikoner på kartet (Hay Day-stil)
  ✅ Produksjonstimere og [HØST]-knapper
  ✅ Militærstyrke-tall
  ✅ Befolkningstilfredshet (emoji-skala)
```

### 9.3 «Uformet verden»-estetikk

I starten av spillet, når nesten alle regioner er NPC, skal kartet se **uferdig og åpent** ut – en invitasjon til å forme verden:

```css
/* NPC-regioner: subtilt teksturmønster */
.region-npc {
  fill: #3a3f2e;           /* mørk, nøytral */
  fill-opacity: 0.6;
  stroke: #4a5040;
  stroke-width: 0.5;
  stroke-dasharray: 3,3;   /* stiplet grense – «uformelt» */
}

/* Spiller-regioner: solid og definert */
.region-player {
  fill: var(--empire-color);
  fill-opacity: 0.85;
  stroke: var(--empire-color-bright);
  stroke-width: 2;
}

/* Ekspansjonsmål (nabo): grønn glød */
.region-available {
  stroke: #4caf7d;
  stroke-width: 3;
  animation: border-pulse 2s ease-in-out infinite;
}
```

---

## 10. Fargesystemet – imperiefarger

### 10.1 Imperiefarger i stedet for landfarger

I Modell A finnes ingen landfarger – i stedet har **hver spiller sin unike imperiumfarge**. Denne velges ved spillstart og brukes på alle deres regioner.

```
SPILLERENS IMPERIUMFARGE:

Velges fra en palett av 150 distinkte farger (én per spiller)
Algoritme sikrer at naboer ikke deler nær-identisk farge
Beholdes gjennom hele spillet – selv om spilleren danner nasjon
Kan IKKE endres etter valg (identitet er viktig)
```

### 10.2 Fargepaletten – 150 distinkte farger

```javascript
// Genereres algoritmisk med HSL-fargerom
// Fordeler 150 farger jevnt over fargehjulet
// med varierende lysstyrke og metning for distinkthet

function generateEmpireColors(n = 150) {
  const colors = [];
  const goldenRatio = 0.618033988749895;
  let hue = 0;

  for (let i = 0; i < n; i++) {
    hue = (hue + goldenRatio) % 1;
    const saturation = 55 + (i % 3) * 15;   // 55%, 70%, 85%
    const lightness  = 35 + (i % 5) * 8;    // 35%–67%
    colors.push(`hsl(${Math.round(hue * 360)}, ${saturation}%, ${lightness}%)`);
  }
  return colors;
}
```

### 10.3 Nasjonsfarger

Når en historisk nasjon dannes, kan spilleren **velge å adoptere nasjonens historiske farge** som sin imperiumfarge:

```
Norge dannet → tilbud: «Bytt til norsk rød? 🇳🇴»
  → Ja: alle regioner skifter til norsk rød
  → Nei: beholder sin opprinnelige imperiumfarge
```

---

## 11. Spilløkken – oppdatert

Spilløkken er den samme som v0.5, men med Modell A-kontekst:

### De tre løkkene i Modell A

```
🌾 HØSTELØKKEN              🗺️ EKSPANSJONSLØKKEN         🤝 SOSIALLØKKEN
(minutter til timer)        (timer til dager)             (hele dagen)

Klikk bygning               Sjekk nabokart                Les meldinger
  ↓                           ↓                             ↓
Vent på timer               Hvem er i nærheten?           Forhandle handel
  ↓                           ↓                             ↓
Klikk igjen                 Velg neste region             Diskuter nasjonsdanning
  ↓                           ↓                             ↓
Prosesser i fabrikk         Militær/diplomatisk/øko.      Inngå forbund
  ↓                           ↓                             ↓
Selg/bruk/lagre             Integrer ny region            Erklær krig
  ↓                           ↓                             ↓
Reinvestér                  Nå nok? → Danne nasjon?       Vis makt på kartet
```

### Spenningskurve – Modell A over én måned

```
Uke 1: Bygge og høste én region   ─── Lav spenning, høy nysgjerrighet
       Første ekspansjon (2–3 reg)     «Hvem er naboene mine?»

Uke 2: Territoriumkamp            ─── Stigende spenning
       Flere spillere møtes           «De er nær meg!»
       Nasjonsdanningskappløp         «Kan jeg nå Norge?»

Uke 3: Nasjoner dannes            ─── Høy spenning
       Diplomati mellom nasjoner      Allianser og fiendskap
       Første store kriger            Territorielle konflikter

Uke 4: Storpolitikk               ─── Maksimal spenning
       Forbund vs forbund             Hvem dominerer kontinentet?
       Economic Hitman aktiveres      Gjeldsfeller i nasjonsdiplomati
       FN-møte og avslutning
```

---

## 12. Alle øvrige mekanikker

Følgende seksjoner er **uendret fra v0.4/v0.5** og refereres dit:

- **Høstemekanikken** (timere, lager, produksjonskjeder, boost) → v0.5 seksjon 8
- **Overtagelse av regioner** (militær, diplomatisk, økonomisk) → v0.5 seksjon 9
- **Handel og økonomi** (marked, automatiske avtaler, politiske valg) → v0.4 seksjon 11
- **Hendelseskort** (kategorier, kortdesign, lærerstyrt injeksjon) → v0.4 seksjon 12
- **Kommunikasjon** (chat + diplomatiske noter + FN-møte) → v0.4 seksjon 13
- **Konfliktsystem** (eskalering, kampalgortime, fredsavtaler) → v0.4 seksjon 14
- **Lærerpanel** (dashboard, varsler, frys-og-diskuter) → v0.4 seksjon 15
- **Economic Hitman-lag** → v0.4 seksjon 16

**Modell A-spesifikke tilpasninger:**

- Diplomatiske noter sendes nå mellom **spillere** (ikke land) inntil nasjon er dannet
- Handelsavtaler er mellom spillere inntil nasjon er dannet, deretter mellom nasjoner
- FN eksisterer ikke til minst 3 nasjoner er dannet – læreren velger tidspunkt

---

## 13. GitHub Pages og CI/CD

Uendret fra v0.5. Se seksjon 8 i v0.5 for:
- Komplett GitHub Actions workflow
- Firebase Secrets-oppsett
- Vite-konfigurasjon med `base: '/geopolity/'`
- Firebase Security Rules
- Lokal utvikling vs. produksjon
- Custom domain

---

## 14. MVP-plan v6

### Fase 0 – Fundament og kart *(2–3 uker)*
- [ ] GitHub-repo med Actions-workflow (fra v0.5)
- [ ] Firebase-prosjekt (Auth, Realtime DB, Cloud Functions)
- [ ] React + Vite + Leaflet + designsystem
- [ ] World GeoJSON med ~2000 NPC-regioner (stiplet, grå)
- [ ] Naboskap-beregning og lagring i Firebase ved spilloppstart
- [ ] Innlogging med klassekode → velg startregion → bli spiller
- [ ] Imperiumfarge tildeles ved innlogging

### Fase 1 – Høsting og ekspansjon *(3–5 uker)*
- [ ] Første bygningsikoner (AI-generert): gård, gruve, militærbase
- [ ] Høstemekanikk (klikk → timer → klikk igjen)
- [ ] Lokalt lager + sentrallager
- [ ] Ekspansjonsgrensesnitt (naboglød på kartet)
- [ ] Militær overtakelse av NPC-naboregion
- [ ] Integrasjonsprosess med fremdriftslinje

### Fase 2 – Nasjonsdanning og mellomspiller *(4–6 uker)*
- [ ] Nasjonsformasjonssystem (krav-sjekk, UI, bonuser)
- [ ] Kulturell tilhørighet-data for alle regioner
- [ ] Diplomatiske noter mellom spillere
- [ ] Chat (globalt, privat)
- [ ] Handel (globalt marked)
- [ ] Krig mellom spillere

### Fase 3 – Forbund og storpolitikk *(4–6 uker)*
- [ ] Nasjonsforbund (NATO-mekanikk)
- [ ] FN-møte (utløses av lærer når ≥3 nasjoner finnes)
- [ ] Allianse-kart (nettverksgraf som i mock)
- [ ] Vedlikeholdskostnad-skalering
- [ ] Startsone-verktøy for læreren
- [ ] Lærerpanel komplett

### Fase 4 – Dybde og polish *(3–4 uker)*
- [ ] Economic Hitman-lag
- [ ] Alle bygningsikoner (erstatter AI-genererte)
- [ ] Læringsrapporter
- [ ] Frys-og-diskuter
- [ ] Mobiloptimalisering

---

## 15. Åpne designspørsmål

### Avgjort i v0.7 (synk med plan v3)

- ✅ **Nasjonsterskel:** 70% kulturmatch (ikke 60% som v0.6 foreslo)
- ✅ **NPC frivillig tilslutning:** Ja — implementert som attraktivitetsscore basert på rykte, handelsvolum, fred, kulturmatch og innflytelse (se plan §2)
- ✅ **Hav som region:** Nei — kun et hinder; sjøhopp via havn
- ✅ **GDPR:** Lærer-roster lagrer kun elevnavn; kobling til elev kun hos læreren (se plan §3.1). Krever formell vurdering av Datatilsynet før første pilot.

### Fortsatt åpent

- ❓ **To spillere vil danne «Norge»:** Hva skjer med den som taper kappløpet? Foreslått: de kan danne «Norrønt Rike» eller eget navn med sine norske regioner – men mister historisk-prestisjebonusen. (Avgjøres i fase 2a-balansering.)
- ❓ **Regionsammenslåing:** Kan to spillere slå sammen sine territorier til én nasjon (union)? F.eks. danne «Skandinavia» i stedet for Norge + Sverige separat? (Fase 3.)
- ❓ **Strategisk verdi-mekanikk:** Stjernerangering brukes pt. til å bestemme antall byggeplasser per region. Bør den også påvirke kamputfall eller integrasjonshastighet? (Fase 2b.)
- ❓ **Chat-moderasjon:** Profanity-filter, lærer-mute, foreldreklage-logg (Fase 2a.)

### Lav prioritet (fase 4+)

- ❓ Animert karthistorie («timelapse» av imperiumvekst over spillets gang)
- ❓ Eksportformat for læringsrapporter (CSV bestemt for MVP; PDF senere)
- ❓ Flerspråklig støtte (norsk hardkodet i MVP)

---

## 16. Endringslogg

| Versjon | Dato | Endringer |
|---|---|---|
| v0.1 | – | Første utkast – systemdesign |
| v0.2 | – | Spilløkke, hendelseskort, UI-konsept, Firebase |
| v0.3 | – | Regionsystem, høstemekanikk, NPC, fullt UI-plan |
| v0.4 | – | UI-analyse av mock-screenshots, bindende designsystem |
| v0.5 | – | Kartsystem, zoom-lag, GeoJSON-pipeline, ikoner, GitHub Pages/Actions |
| v0.6 | – | **Modell A** (ingen forhåndsdannede land, ~2000 løse NPC-regioner), **Geografisk ekspansjon** (nabo-til-nabo med sjøhopp via havn), **Nasjonsbygging** («Erklær Norge!»-system med kulturmatch og bonuser), **Imperiumfarger** (150 distinkte farger, algoritmisk generert), **Oppdatert kartstil** (stiplet NPC-verden, «uformet»-estetikk), **Balansesystem** (vedlikeholdskostnad skalerer med antall regioner), **Startsone-verktøy** for lærer |
| v0.7 | 2026-04-26 | **Synk med plan v3** etter andre plan-audit: kulturmatch-terskel 60→70%, bonus-tiers rebalansert til 70/85/100%, NPC frivillig tilslutning bekreftet (attraktivitetsscore i plan §2), hav bekreftet ikke-spillbart, GDPR-strategi via lærer-roster avklart. Tre nye åpne spørsmål dokumentert (strategisk verdi-mekanikk, chat-moderasjon). Tekniske implementasjonsdetaljer flyttet til `IMPLEMENTATION_PLAN.md`. |

---

*GEOPOLITY · Game Design Document v0.7 · Konfidensielt arbeidsdokument*