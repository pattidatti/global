# 🛠️ GEOPOLITY – Implementeringsplan

> Detaljert teknisk plan for å bygge GEOPOLITY (jf. `design.md` v0.6 — avvik dokumentert i §0).
> Status: utkast **v3** (revidert etter andre plan-audit 2026-04-26) · for et tomt repo (kun `README.md` + `design.md`).

---

## Innhold

0. [Avvik fra design.md v0.6](#0-avvik-fra-designmd-v06)
1. [Mål og premisser](#1-mål-og-premisser)
2. [Avklarte designspørsmål](#2-avklarte-designspørsmål)
3. [Teknologivalg](#3-teknologivalg)
4. [UI-rammeverk (basert på mockup)](#4-ui-rammeverk-basert-på-mockup)
5. [Mappestruktur](#5-mappestruktur)
6. [Datamodell (Firebase RTDB)](#6-datamodell-firebase-rtdb)
7. [GeoJSON-pipeline – hvordan vi får ~2000 regioner](#7-geojson-pipeline--hvordan-vi-får-2000-regioner)
8. [Naboskaps-beregning (adjacency)](#8-naboskaps-beregning-adjacency)
9. [Backend-funksjoner (Cloud Functions)](#9-backend-funksjoner-cloud-functions)
10. [Sikkerhetsregler](#10-sikkerhetsregler)
11. [Frontend-arkitektur](#11-frontend-arkitektur)
12. [Karthåndtering (Leaflet)](#12-karthåndtering-leaflet)
13. [Spilløkken – tikk-system](#13-spilløkken--tikk-system)
14. [Implementeringsfaser med oppgaver](#14-implementeringsfaser-med-oppgaver)
15. [Risikoer og gjenstående spørsmål](#15-risikoer-og-gjenstående-spørsmål)
16. [Definition of Done per fase](#16-definition-of-done-per-fase)

---

## 0. Avvik fra design.md v0.6

Denne planen overskriver flere konkrete tall og mekanismer i `design.md` v0.6. Når disse to dokumentene strider, **vinner planen** inntil `design.md` oppdateres til v0.7 (planlagt umiddelbart etter at v3 av denne planen er godkjent).

| Tema | design.md v0.6 | plan v3 | Begrunnelse |
|---|---|---|---|
| Kulturmatch-terskel (historisk nasjon) | ≥60% | **≥70%** | Plan-audit 2026-04-26: 60% gir for lett nasjonsdanning på liten regiondekning |
| Bonus-tier kulturmatch | 60/80/100% | **70/85/100%** | Rebalansert så det ikke finnes "dødt vindu" mellom inngangskrav og bonus |
| Empire-color-valg | Brukervalgt fra hele palett | **Brukeren velger fra 6 ledige farger** ved `pickStartRegion` | Atomisk reservasjon mot kollisjoner; identitetsfølelsen bevares |
| Diplomatic + economic takeover | Beskrevet, ikke spec'd | **Stub i fase 1, full impl. fase 2a** (se §9) | Dekkes ikke i militær-only ekspansjon |
| By-region-krav for nasjon | Påkrevd (tech/finans-ressurs) | **Beholdt** — ny `data/cities.json` definerer city-tag | Pipeline §7a hadde ingen mekanisme for dette |
| Tilfredshet-krav for nasjon | ≥50% (historisk) / ≥40% (egendefinert) | **Beholdt** | Var falt bort fra v2 |
| Egendefinert nasjon (Alternativ B) | 5 sammenhengende regioner | **Beholdt** — egen UI-flow i `NationModal` | Var falt bort fra v2 |
| Mikro-tikk (klient-trigget) | Antydet | **Fjernet** (se §13) | Skapte fairness-problem (faner åpne = fordel) |
| `production`-aggregat per region | Implisitt | **Flyttet til per-bygning** (`pendingHarvest`) | Nødvendig for aktiv klikk-for-å-høste-mekanikken |

---

## 1. Mål og premisser

- **Klassetelling:** opp til 150 samtidige spillere per spill-instans
- **Verden:** ~2000 regioner, ingen forhåndsdannede land (Modell A)
- **Plattform:** Web (desktop primær, mobil sekundær), GitHub Pages-hosting
- **Backend:** Firebase (Auth, Realtime DB, Cloud Functions, Hosting valgfritt)
- **Språk:** Norsk bokmål i all UI og innhold
- **Persistens:** Spill kan vare 4+ uker (timere over flere dager)
- **Lærerstyrt:** Lærer oppretter spill via klassekode, kan fryse, injisere hendelser
- **Aksessibilitet:** WCAG 2.1 AA for alle UI-komponenter — kontrast-ratio på tokens (§4.6), tastaturnavigering for hovedhandlinger, skjermleser-merking på regions-tooltip og knapper. Norsk UU-krav (likestillings- og diskrimineringsloven §17) er bindende for skoleløsninger.

**Ikke-mål for MVP:**
- Innfødt mobilapp
- Offline-modus
- Lyd/musikk
- Animert «timelapse» av imperievekst (fase 4+)

---

## 2. Avklarte designspørsmål

| Spørsmål (fra design.md kap. 15) | Beslutning | Konsekvens for implementasjon |
|---|---|---|
| Nasjonsterskel for kulturmatch | **70 %** | `formNation`-validering: `culturalMatch >= 0.70` for historisk nasjon. Bonusene i kap. 6.4 skalerer fortsatt fra 60→80→100, men inngangsterskelen er 70. |
| Hav som spillbar region | **Nei** | GeoJSON-pipelinen ekskluderer hav-polygoner. Hav er kun et hinder. Sjøhopp via havn forblir mekanisme — `seaAdjacency` definerer hvilke kystregioner som er «sjø-naboer», havet selv er ikke en entitet. |
| NPC frivillig tilslutning (uten press) | **Ja** | `macroTick` skal beregne en *attraktivitetsscore* per nabospiller for hver NPC-region. Når en NPC-region har høy nok score over tid, kan den frivillig tilslutte seg. Se [§9 Cloud Functions](#9-backend-funksjoner-cloud-functions) for spec. |

### Detaljer: NPC frivillig tilslutning

```ts
// Per makro-tikk, for hver NPC-region:
attractiveness(npcRegion, neighborPlayer) =
    0.3 * (neighborPlayer.satisfactionAvg / 100)        // godt rykte
  + 0.2 * (neighborPlayer.tradeVolumeWith(npcRegion))   // handelsbånd
  + 0.2 * (1 - neighborPlayer.warCount / 5)             // fredelig
  + 0.2 * (neighborPlayer.culturalMatchWith(npcRegion)) // kulturell affinitet
  + 0.1 * (neighborPlayer.influence / 1000)             // soft power

// Hvis høyeste score > 0.7 i 5 makro-tikker på rad → frivillig tilslutning
// (Mye lavere terskel hvis NPC-tilfredshet < 30 % – se design.md §7.3)
```

Dette gir spillere et klart insentiv til å bygge rykte og handelsnett — ikke bare militær.

---

## 3. Teknologivalg

| Lag | Valg | Begrunnelse |
|---|---|---|
| Build | Vite 5 + React 18 + TypeScript | Standard på tvers av eksisterende prosjekter |
| UI | Tailwind CSS + headless komponenter | Konsistent med `eiriksbok`/`Hadleliste` |
| Kart | Leaflet 1.9 + react-leaflet 4 | Lett, GeoJSON-vennlig, ingen WebGL-krav |
| Geo | turf.js (`@turf/turf`) | Adjacency-beregning, area, centroid |
| State | React Context + Zustand for kart-/spill-state | Unngår Redux-overhead |
| Backend | Firebase Auth + Realtime DB + Cloud Functions (Node 20) | RTDB > Firestore for tikk-baserte spill (lavere kostnad ved hyppige skriv) |
| Auth (elev) | Anonym Auth + match mot lærer-roster | Elever slipper e-post; navnematch mot lærer-vedlikeholdt liste gjenoppretter spilleren ved enhetsbytte. Se [§3.1](#31-auth-strategi--lærer-roster) |
| Auth (lærer) | Google Auth (Firebase Auth provider) | Lærer trenger varig identitet; Google er praktisk i skolemiljø |
| Deploy | GitHub Pages via Actions, base `/geopolity/` | Som beskrevet i v0.5 |
| Test | Vitest + Playwright (fase 3+) | Standard |

**Avklart:** RTDB foretrukket fremfor Firestore fordi:
- Tikk-data (ressurser, timere) skrives ofte
- Listeners er lettere
- Pris ved 150 samtidige spillere er forutsigbar
- Trade-off: ingen kompleks query – akseptabelt fordi vi cacher mye klient-side

### 3.1 Auth-strategi – lærer-roster

Et 4-ukers spill kan ikke være avhengig av at en anonym Firebase Auth-uid overlever — eleven vil bytte enhet (skole/hjem), tømme nettleserdata, eller logge inn på en ny PC midt i klasserommet. Løsningen:

**Lærer-vedlikeholdt spillerliste er sannhetskilden.**

```
LÆRER (Google Auth)
  └─ /games/{gameId}/roster/{slotId}
        ├── displayName: "Ola Nordmann"
        ├── currentUid: "anon_xxx" | null
        └── createdAt: ts
```

1. **Spillopprettelse:** Lærer logger inn med Google og oppretter spillet. Lærer fyller inn klasselista (én rad per elev) i lærerpanelet — dette genererer N tomme `roster/{slotId}`-rader.
2. **Elev-innlogging (første gang):** Elev åpner spillet, skriver inn klassekoden + sitt navn fra lista. Cloud Function `joinGame` matcher navnet mot `roster/{slotId}` (case-insensitive, trim), oppretter en anonym Auth-sesjon, og setter `roster/{slotId}/currentUid = auth.uid`. Elevens player-record opprettes på `players/{slotId}` (ikke `players/{uid}`).
3. **Elev-innlogging (gjenkobling):** Samme flyt — `joinGame` finner slotId via navn, oppretter ny anonym uid, oppdaterer `roster/{slotId}/currentUid`. Tidligere uid overskrives. Spillerens imperium er intakt fordi det ligger på `players/{slotId}`.
4. **Identitet:** Spilleren refereres alltid med `slotId` i resten av datamodellen (`regions/{id}/ownerId = slotId`, ikke uid). Anonym uid er kun en transport-mekanisme for Firebase Auth-klaim.

**Fordeler:**
- Ingen PIN-koder eller tokens elever må bære
- Lærer har fullt overblikk over hvem som er hvem
- Bytte av enhet = bare logge inn på nytt med samme navn
- Hvis to elever har samme navn (f.eks. to «Ola»), løser læreren det i lista (Ola N., Ola S.)

**GDPR:** Kun elevnavn (kortnavn) lagres — ingen e-post, ingen fødselsdato. Lista er kun synlig for lærer. Ved spillets slutt kan hele `/games/{gameId}` slettes med ett klikk. **Må gjennomgås av Datatilsynet/skolens personvernombud før første pilot.**

### 3.2 Test-strategi

| Lag | Verktøy | Innføres |
|---|---|---|
| Cloud Functions (validering, tikk, kamp) | **Vitest fra fase 0** | Hver funksjon med ekspansjons-/territorium-/penge-logikk SKAL ha enhetstest før den deployes |
| Klient-utils (selectors, score-formler, fargegenerering) | Vitest fra fase 0 | Pure-funksjoner er trivielle å teste |
| Komponent-tester | Vitest + Testing Library, fase 1+ | Når UI-en stabiliseres |
| End-to-end | Playwright, fase 3+ | Krever flere komplette flows å være verdt oppsettet |

Begrunnelse: Cloud Functions med pengeoverføringer og territorium-overtakelse er nøyaktig den typen kode som ikke skal oppdages-bug på i et live klasserom med 150 elever.

---

## 4. UI-rammeverk (basert på mockup)

`mockup.png` viser fire hovedskjermer som deler **felles chrome** (top-bar + bunn-navigering) og varierer kun i sentralt innhold. Dette gir en enkel layout-arkitektur.

### 4.1 Felles chrome (alltid synlig)

```
┌─────────────────────────────────────────────────────────────────────┐
│ GEOPOLITY  [🌾 12.4B] [🛢️ 5.2K] [⛏️ 8.7K] [💰 1.2M] [⚔️ 1.2K] [🌟] │ ← TopBar
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│              [Skjerm-spesifikt sentralt innhold]                   │
│                                                                     │
├─────────────────────────────────────────────────────────────────────┤
│   [🗺️ Kart] [💰 Marked] [⚔️ Militær] [🤝 Diplomati] [📜 Hendelser]  │ ← BottomNav
└─────────────────────────────────────────────────────────────────────┘
```

- **TopBar**: 6 ressurstellere (mat, olje, metall, penger, militær, innflytelse) + dato («Mai 12, år 1») + spilleravatar. Tellerne lyser gult når tom, grønt ved overskudd.
- **BottomNav**: 5–6 hovedskjermer som tab-ikoner. Aktiv fane uthevet i imperiumfarge.

### 4.2 Skjerm 1 – Kart (`Game.tsx`, default-fane)

```
┌──────────────┬─────────────────────────────────┬──────────────┐
│ NasjonsPanel │       Verdenskart (Leaflet)     │  KontekstPanel│
│              │                                 │  (valgt regn) │
│ 🇳🇴 NORGE   │                                 │               │
│ Befolkning   │   [interaktivt regionkart]      │  Eller skjult │
│ Tilfredshet  │                                 │  ved ingen    │
│ Inntekter    │                                 │  seleksjon    │
│              │                                 │               │
│ RESSURSER    │                                 │               │
│ 🌾 2.4B      │                                 │               │
│ 🛢️ 5.2K     │                                 │               │
│              │                                 │               │
│ BYGNINGER    │                                 │               │
│ Gård (3)     │                                 │               │
│ Gruve (1)    │                                 │               │
└──────────────┴─────────────────────────────────┴──────────────┘
```

### 4.3 Skjerm 2 – Marked (`MarketScreen.tsx`)

```
┌──────────────────────────────────────────┬──────────────────┐
│ GLOBALT MARKED                           │ ØKONOMI          │
│ ┌──────┬──────┬───────┬────────┬───────┐│ Nasjonalformue   │
│ │Ressurs│Selg │Kjøp   │Volum   │Trend  ││ BNP/innbygger    │
│ ├──────┼──────┼───────┼────────┼───────┤│ Statskasse       │
│ │🌾 Mat │ 5.20│  4.80 │ 12.3B  │ ▲+1.2%││ Innflytelse      │
│ │🛢️ Olj │28.40│ 27.10 │ 4.5B   │ ▼-0.5%││ Arbeidsledighet  │
│ │ ...  │     │       │        │       │├──────────────────┤
│ └──────┴──────┴───────┴────────┴───────┘│ HANDELSAVTALER  │
│                                          │ 🇺🇸 USA  +12%   │
│ MARKEDSGRAF: OLJE                        │ 🇪🇺 EU   +8%    │
│ [linje-graf over tid]                    │ 🇨🇳 Kina +15%   │
└──────────────────────────────────────────┴──────────────────┘
```

### 4.4 Skjerm 3 – Diplomati (`DiplomacyScreen.tsx`)

```
┌─────────────┬────────────────────┬─────────────────────────┐
│ DIPLOMATER  │ 🇸🇪 SVERIGE        │ DIPLOMATISK NETTVERK    │
│ Norge   --  │ Skandinavia        │                         │
│ Sverige Nøy │                    │   [force-graph av       │
│ Danmark Ven │ Avtale: Venn       │    nasjonsflagg-noder   │
│ ...         │                    │    forbundet med        │
│             │ [Send melding]     │    fargede linjer]      │
│             │ [Foreslå avtale]   │                         │
│             │ [Forbered krig]    │                         │
└─────────────┴────────────────────┴─────────────────────────┘
```

### 4.5 Skjerm 4 – Krig (`WarScreen.tsx`)

Aktiveres når spilleren er i en aktiv konflikt; ellers vises «ingen aktive konflikter».

```
┌──────────────────────────────────────────┬──────────────────┐
│ KRIG: NORGE vs RUSSLAND   Dag 3          │ KRIGSVERDIER     │
│                                          │ 🇳🇴 NORGE        │
│ [Kart sentrert på konflikt-region]      │ Militærstyrke    │
│ Rød pulserende glød på omstridte regs    │ Tap              │
│                                          │ Territorium      │
│                                          │ ─────────────    │
│                                          │ 🇷🇺 RUSSLAND     │
│                                          │ ...              │
│ ENHETER                                  │                  │
│ [tank-ikoner]                            │ SISTE HENDELSER  │
│                                          │ [event-log]      │
└──────────────────────────────────────────┴──────────────────┘
```

### 4.6 Designsystem-tokens

```ts
// src/ui/tokens.ts
export const colors = {
  bg:        '#0e1a26',  // dyp navy bakgrunn
  panel:     '#15273a',  // sidepaneler
  panelEdge: '#1f3550',  // border
  accent:    '#3da9fc',  // teal-blå primær
  textHi:    '#e8f1ff',
  textLo:    '#8aa3bf',
  good:      '#4caf7d',  // grønn (vekst, fred)
  warn:      '#f4a261',  // oransje (varsler)
  danger:    '#e63946',  // rød (krig, tap)
  npc:       '#3a3f2e',  // mørk olivengrå (NPC-regioner)
};

export const fonts = {
  sans: 'Inter, system-ui, sans-serif',
  mono: 'JetBrains Mono, monospace',  // for tall i top-bar
};
```

### 4.7 Felles komponenter (alle 4 skjermer)

| Komponent | Brukt i |
|---|---|
| `TopBar` | Alle |
| `BottomNav` | Alle |
| `ResourceCounter` | TopBar |
| `Panel` (kort med tittel + content) | Skjerm 1, 2, 3, 4 |
| `FlagBadge` | Skjerm 3, 4 |
| `DataTable` | Skjerm 2, 3 |
| `LineChart` (Recharts) | Skjerm 2 |
| `ForceGraph` (`react-force-graph-2d`) | Skjerm 3 |
| `EventLog` | Skjerm 4 + event-toasts |

Dette betyr at fase 0 må etablere `TopBar` + `BottomNav` + `Panel` som første ting — alt annet bygger inn i denne shell-en.

---

## 5. Mappestruktur

```
geopolity/
├── .github/workflows/deploy.yml
├── public/
│   ├── geo/
│   │   ├── regions.geojson          # Fullt regionkart (forprosessert)
│   │   ├── adjacency.json           # Naboskap-graf
│   │   └── cultural-groups.json     # Kulturelle tags per region
│   └── icons/                       # Bygnings- og ressursikoner
├── scripts/
│   ├── build-regions.ts             # Henter & forprosesserer GeoJSON
│   ├── compute-adjacency.ts         # Beregner naboskap én gang
│   └── seed-firebase.ts             # Seeder NPC-regioner i RTDB
├── functions/                       # Firebase Cloud Functions
│   ├── src/
│   │   ├── tick.ts                  # Makro-tikk (ressurser, vedlikehold)
│   │   ├── expansion.ts             # Validerer og utfører ekspansjon
│   │   ├── nation.ts                # Nasjonsformasjon (krav-sjekk)
│   │   ├── trade.ts                 # Handelsavtaler
│   │   └── teacher.ts               # Lærer-spesifikke endpoints
│   └── package.json
├── src/
│   ├── main.tsx
│   ├── App.tsx
│   ├── routes/
│   │   ├── Login.tsx
│   │   ├── PickRegion.tsx
│   │   ├── Game.tsx                 # Shell med TopBar + BottomNav
│   │   └── Teacher.tsx              # Lærerpanel
│   ├── screens/                     # 4 hovedskjermer fra mockup
│   │   ├── MapScreen.tsx
│   │   ├── MarketScreen.tsx
│   │   ├── DiplomacyScreen.tsx
│   │   └── WarScreen.tsx
│   ├── ui/
│   │   ├── TopBar.tsx
│   │   ├── BottomNav.tsx
│   │   ├── Panel.tsx
│   │   ├── ResourceCounter.tsx
│   │   ├── FlagBadge.tsx
│   │   ├── DataTable.tsx
│   │   └── tokens.ts                # Farger, fonter, spacing
│   ├── map/
│   │   ├── MapView.tsx              # Leaflet-wrapper
│   │   ├── RegionLayer.tsx          # GeoJSON-lag, fargestyring
│   │   ├── ZoomController.tsx       # Stylelogikk per zoom-nivå
│   │   └── styles.ts                # CSS-regler for region-states
│   ├── game/
│   │   ├── store.ts                 # Zustand-store (spillstate)
│   │   ├── selectors.ts
│   │   ├── tick.ts                  # Klient-side tikk for UI-counters
│   │   └── empire-colors.ts         # Algoritme for 150 distinkte farger
│   ├── features/
│   │   ├── harvest/
│   │   ├── expansion/
│   │   ├── nation/
│   │   ├── trade/
│   │   ├── chat/
│   │   ├── diplomacy/
│   │   └── events/                  # Hendelseskort
│   ├── firebase/
│   │   ├── config.ts
│   │   ├── auth.ts
│   │   └── db.ts                    # Typed RTDB wrappers
│   └── types/
│       ├── region.ts
│       ├── player.ts
│       └── nation.ts
├── design.md
├── IMPLEMENTATION_PLAN.md           # ← dette dokumentet
├── package.json
├── vite.config.ts
├── tailwind.config.ts
├── tsconfig.json
└── README.md
```

---

## 6. Datamodell (Firebase RTDB)

**Identifikator-konvensjon:** Spillere refereres med `slotId` (fra lærer-roster, se §3.1), aldri med Firebase Auth-uid. Dette gjør at en spiller overlever uid-bytte (ny enhet, ny anonym sesjon).

```ts
// /games/{gameId}/meta
{
  classCode: "GEO-7B-2026",
  teacherId: "google_uid_xxx",            // Google Auth uid (lærer)
  createdAt: 1714000000000,
  status: "active" | "frozen" | "ended",
  startZones?: { classA: ["EU", "AF"], classB: ["AS", "OC"], classC: ["AM"] },
  unFormed: false,
  nationCount: 0,                          // skrives av formNation/onNationDelete
  schemaVersion: 1,                        // for migreringer mid-spill
  lastMacroTickAt: 1714000000000           // for monitoring og recovery
}

// /games/{gameId}/roster/{slotId}        // se §3.1
{
  displayName: "Ola Nordmann",
  currentUid: "anon_xxx" | null,           // settes av joinGame
  createdAt: 1714000000000,
  joinedAt: 1714000000000 | null
}

// /games/{gameId}/regions/{regionId}
{
  ownerId: null | "slotId",                // null = NPC
  nationId: null | "nation_xxx",
  population: 1_200_000,
  satisfaction: 65,                        // 0–100, endres av tickSatisfaction
  defense: 50,
  resources: { food: 320, oil: 180 },      // central stockpile (player-tilgjengelig etter høsting)
  // production-aggregat FJERNET — produksjon skjer per bygning, se buildings/
  buildQueue: [                            // bygg-i-arbeid
    { buildingId: "build_xxx", type: "mine", startedAt: 1714000000000, completesAt: 1714000300000 }
  ],
  maxSlots: 2,                             // 1 + floor(strategicValue / 2), 1–3
  integration: 100,                        // 0–100
  integrationStartedAt: null | 1714000000000,
  contestedAt: null | 1714000000000,       // satt når krig involverer regionen
  lastTickAt: 1714000000000
}

// /games/{gameId}/regions/{regionId}/buildings/{buildingId}
{
  type: "farm" | "mine" | "oilrig" | "harbor" | "barracks" | "cityExpand",
  builtAt: 1714000000000,
  pendingHarvest: { food: 120 },           // akkumuleres av macroTick til maxStorage
  lastHarvestedAt: 1714000000000,
  maxStorage: 500                          // tvinger spilleren til å klikke høst
}

// /games/{gameId}/players/{slotId}        // merk: nøkkel = slotId, ikke uid
{
  displayName: "Ola N.",
  empireColor: "hsl(127, 70%, 45%)",
  empireColorIdx: 42,
  treasury: 500,
  influence: 0,                            // soft power; oppdateres av gainInfluence
  military: 50,                            // manpower-pool (rekrutter), fase 1+
  regionIds: ["region_vestland", "region_rogaland"],
  nationId: null | "nation_xxx",
  joinedAt: 1714000000000,
  lastSeenAt: 1714000000000                // for offline-detektering og lærer-dashboard
}

// Forhold mellom players.military og units (fase 2b+):
//   players.military = aggregert manpower-pool (rekrutter klare til deployering)
//   units            = deployerte militære enheter på kart, brukes i kamp (§13.1)
//   declareWar trekker fra military → konverteres til units i target-region

// /games/{gameId}/usedColors                // bookkeeping for empire-color-tildeling
{
  "42": "slot_xxx",                          // empireColorIdx → slotId
  "73": "slot_yyy"
}

// /games/{gameId}/units/{unitId}          // militærenheter (krig-mekanikk, fase 2b)
{
  ownerId: "slotId",
  regionId: "region_xxx",                  // hvor enheten står nå
  type: "infantry" | "armor" | "navy",
  strength: 100,                           // HP-lignende
  movedAt: 1714000000000                   // for movement-cooldown
}

// /games/{gameId}/wars/{warId}            // aktive konflikter (fase 2b)
{
  attacker: "slotId_a",
  defender: "slotId_b",
  startedAt: 1714000000000,
  contestedRegionIds: ["region_xxx"],
  battleLog: [                             // begrenset (siste N), arkiveres til /games/.../archive ved fred
    { tick: 12, regionId: "...", attackerLoss: 10, defenderLoss: 15 }
  ],
  status: "active" | "ceasefire" | "ended",
  endedAt: null | 1714000000000
}

// /games/{gameId}/nations/{nationId}
{
  founderId: "slotId",
  name: "Norge",
  flag: "🇳🇴",
  type: "historical" | "custom",
  cultureMatch: 0.75,
  bonus: { production: 0.2, prestige: 500 },
  members: ["slotId"],                     // for unioner senere
  formedAt: 1714000000000
}

// /games/{gameId}/diplomacy/{a__b}        // a < b alfabetisk (slotId)
{
  status: "neutral" | "alliance" | "war" | "trade",
  since: 1714000000000,
  notes: [...]
}

// /games/{gameId}/markets/orders/{resource}/{side}/{orderId}   // marked (fase 2)
// side = "buy" | "sell". Indeksert på pricePerUnit slik at matchOrders kan
// finne beste motpart i O(log n) uten full scan.
{
  ownerId: "slotId",
  resource: "oil",
  side: "buy" | "sell",
  quantity: 100,
  pricePerUnit: 28.4,
  postedAt: 1714000000000,
  status: "open" | "filled" | "cancelled"
}
// .indexOn: ["pricePerUnit"] per resource/side (sett i sikkerhetsregler §10)

// /games/{gameId}/markets/priceHistory/{resource}/{tickIdx}
{
  avgPrice: 27.8,
  volume: 1200,
  ts: 1714000000000
}

// /games/{gameId}/events                  // hendelseskort-strøm
// /games/{gameId}/chat/{channelId}/messages
// /games/{gameId}/teacher/log             // varsler til lærer

// Statiske data (ikke per spill, hostet i /public)
// /public/geo/regions.geojson
// /public/geo/adjacency.json
// /public/geo/cultural-groups.json
```

**Skrivemønster:**
- All ressursproduksjon → Cloud Function (server-tid sannhetskilde)
- Klient skriver kun: byggevalg, ekspansjons-intent, chat, diplomati
- Server validerer og utfører

### 6.5 Bygningstabell

Statisk konfigurasjon, hostet i `public/data/buildings.json` og lastet av klient + Cloud Functions ved oppstart. Verdiene er førsteforslag — finjusteres i fase 1-balansering.

```ts
{
  "farm":       { cost: 100, buildTimeMin: 5,  output: { food: 30 },                biomeMul: { plains: 1.5, coast: 1.0, regnskog: 1.2, desert: 0.3, arctic: 0.2, others: 0.7 } },
  "mine":       { cost: 200, buildTimeMin: 15, output: { metal: 20 },               biomeMul: { mountain: 1.8, arctic: 1.2, plains: 0.5, others: 0.6 } },
  "oilrig":     { cost: 250, buildTimeMin: 20, output: { oil: 25 },                 biomeMul: { desert: 1.6, arctic: 1.4, others: 0.4 } },
  "harbor":     { cost: 400, buildTimeMin: 30, output: { trade: 10 },               biomeMul: { coast: 1.0 }, requires: "coast",   unlocks: "seaAdjacency" },
  "barracks":   { cost: 300, buildTimeMin: 20, output: { military: 15 } },
  "cityExpand": { cost: 800, buildTimeMin: 60, output: { influence: 5, taxBase: 50 }, requires: "city" }
}
```

**Regler:**
- `cost` trekkes fra `players.treasury` ved `buildBuilding`
- `buildTimeMin` er minutter; bygning entrer `regions/{id}/buildQueue` til den er ferdig
- Når ferdig flyttes til `regions/{id}/buildings/{buildingId}` med `pendingHarvest = {}`
- Hver `macroTick` (10 min): `pendingHarvest[res] += output[res] * biomeMul[regionBiome] * 1.0` (clamp til `maxStorage`)
- `harvestBuilding` callable flytter `pendingHarvest` → `regions/{id}/resources` og setter `lastHarvestedAt = now`
- `requires: "coast"` valideres mot region.biome; `requires: "city"` mot region.cityTag
- `maxSlots = 1 + floor(region.strategicValue / 2)` (1–3 byggeplasser)

**`data/cities.json`** (ny, lukker by-region-krav):
```json
{
  "region_london":   { "cityTag": "city", "type": "tech_finans" },
  "region_tokyo":    { "cityTag": "city", "type": "tech_finans" },
  "region_new_york": { "cityTag": "city", "type": "tech_finans" }
}
```
~80–100 historiske kjernebyer manuelt utvalgt; dekkes av §7b kuration.

---

## 7. GeoJSON-pipeline – hvordan vi får ~2000 regioner

Dette er den **største tekniske risikoen i fase 0**, og består egentlig av to uavhengige arbeidsstrømmer som må kjøre parallelt: et automatisert pipeline-skript (kort) og et betydelig datakurations-arbeid (langt).

### 7a. Pipeline-skript (~1 uke arbeid)

**Strategi:**
1. **Base-kilde:** Natural Earth Admin-1 (delstater/fylker globalt) ≈ 4500 polygoner
2. **Filtrer:** Kollaps små USA-counties til delstater, behold Admin-1 i Europa/Asia
3. **Ressurs-tagging (auto):** Bruk WorldClim/biom-shapefiler for biome → primær/sekundær-ressurs
4. **Kultur-tagging (auto):** Map ISO-A3 → `culturalGroup` via håndlaget JSON (input fra 7b)
5. **Forenkle:** `mapshaper -simplify 5%` for å holde GeoJSON < 5 MB
6. **Output:** statisk `regions.geojson` lastet direkte i klient

```bash
# scripts/build-regions.ts
npx tsx scripts/build-regions.ts \
  --input data/ne_10m_admin_1_states_provinces.geojson \
  --biomes data/biomes.geojson \
  --culture data/cultural-tags.json \
  --overrides data/strategic-overrides.json \
  --output public/geo/regions.geojson
```

Skriptet:
- Tildeler `regionId` (slug)
- Beregner `centroid` for ikon-plassering
- Tildeler `biome` → `primaryResource` + `secondaryResource`
- Tildeler `strategicValue` (1–5) fra override-tabell
- Tildeler `culturalGroup`, `historicalNation`, `iso`, `language` fra culture-tags-fila

**Hav er ekskludert** (§2): pipelinen filtrerer bort havpolygoner. Kun landregioner blir entiteter.

### 7b. Datakurations-arbeid (~3-4 uker, kan kjøre parallelt med fase 0-1)

Pipelinen er verdiløs uten dataene den slår opp i. Disse må kurateres manuelt:

| Datafil | Innhold | Volum | Estimert arbeid |
|---|---|---|---|
| `data/cultural-tags.json` | `culturalGroup`, `historicalNation`, `language` per region | ~2000 rader | 2-3 uker |
| `data/strategic-overrides.json` | `strategicValue` 1-5 for navngitte knutepunkter (Suez, Gibraltar, Baku, …) | ~150 rader | 1 uke |
| `data/biome-resource-map.json` | Biom → primær/sekundær-ressurs | ~30 rader | 2 dager |
| `data/historical-nations.json` | Hvilke regioner som «hører til» f.eks. Norge, Frankrike, Tyrkia | ~80 historiske nasjoner | 1-2 uker |

**Dekningsmål per fase:**
- **Fase 0 ferdig:** Globalt biom + ressurs (auto). Kulturell tagging for **Europa (100%)** + utvalgte historiske kjernenasjoner (Russland, Tyrkia, Egypt, Japan, USA, Brasil) — dette er nok til at de første pilotene kan oppleve nasjonsdanning.
- **Fase 2 forutsetter:** Minst 80% kulturell dekning av Asia og Afrika før nasjonsdanning rulles ut bredt.
- **Fase 4:** 95%+ global dekning.

**Verktøystøtte:** Bygg en enkel intern admin-side (`scripts/tag-editor.html` eller en route i lærerpanelet med `?devTag=true`) der en kan klikke på en region på kartet og redigere kultur-tags direkte. Dette er raskere enn å redigere JSON.

**Eierskap:** Kuration er ikke en utvikleroppgave alene — gjerne involver en lærer eller historielærer. Dokumenter kildene (Wikipedia ISO-tabeller, CIA World Factbook, etc.) for revisjonsspor.

### 7c. Avveininger

- Vi kan ikke nå nøyaktig 2000 – sikt på 1800–2200 og dokumenter faktisk antall
- Tagging-arbeid er det som blokkerer fase 2, ikke kart-rendering. Start tidlig.

---

## 8. Naboskaps-beregning (adjacency)

Kjøres **én gang offline** under build, ikke ved spilloppstart.

```ts
// scripts/compute-adjacency.ts
import { featureCollection } from '@turf/helpers';
import booleanIntersects from '@turf/boolean-intersects';

// Naiv O(n²) er ok ved n=2000 hvis vi bruker bbox-filter først
for (const a of regions) {
  for (const b of regions) {
    if (a.id >= b.id) continue;
    if (!bboxOverlap(a, b)) continue;       // raskt filter
    if (booleanIntersects(a, b)) {           // ekte sjekk
      adjacency[a.id].push(b.id);
      adjacency[b.id].push(a.id);
    }
  }
}
```

**Sjø-naboskap:** håndteres separat. Vi merker kystregioner og lager en eksplisitt `seaAdjacency`-graf basert på «samme havområde innen 500 km». Dette gjør at en `havn` kan hoppe til navngitt sjø-nabo.

Output: `public/geo/adjacency.json` (~200 KB)

---

## 9. Backend-funksjoner (Cloud Functions)

| Funksjon | Trigger | Ansvar |
|---|---|---|
| **Spill-livssyklus** | | |
| `createGame` | Callable (lærer) | Genererer `gameId` + klassekode, oppretter `meta`, klargjør tomt roster |
| `addRosterSlot` / `removeRosterSlot` | Callable (lærer) | Vedlikeholder klasselista (én rad per elev) |
| `joinGame` | Callable (anonym) | Validerer klassekode + navnematch mot roster, kobler `currentUid`, oppretter player-record (se §3.1) |
| `removeRosterSlot` | Callable (lærer) | Krever `disposition: "convertToNpc" \| "transferTo:{slotId}" \| "freeze"`. Håndterer elev som slutter mid-spill — regioner enten blir NPC, overføres til en annen elev, eller fryses i påvente av lærerens beslutning. |
| `pickStartRegion` | Callable | Atomisk reservasjon (RTDB transaction). Validerer ledig region, returnerer 6 ledige farger fra paletten. Klient sender valgt `empireColorIdx` tilbake; server reserverer atomisk i `/games/{gameId}/usedColors` og setter `ownerId = slotId`. |
| `endGame` | Callable (lærer) | Setter `meta.status = ended`, fryser tikk, eksporterer læringsrapport |
| `deleteGame` | Callable (lærer) | Sletter hele `/games/{gameId}` (GDPR-forpliktelse — krever bekreftelse). Bør kjøres innen 30 dager etter `endGame`. |
| **Tikk og NPC** | | |
| `macroTick` | Scheduled (hvert 10. min) | Driver: akkumulerer `pendingHarvest` per bygning, vedlikehold, integrasjonsfremdrift, NPC-attraktivitet, og kaller subroutiner under. Skipper spill med `status != active`. |
| `tickSatisfaction` | Triggered fra `macroTick` | Endrer `regions/{id}/satisfaction` basert på naboeffekter (invasjoner senker tilfredshet i nabo, design.md §7.2), krig, vedlikehold, ressursmangel |
| `tickPopulation` | Triggered fra `macroTick` | Population vekst/decline basert på satisfaction, food-tilgang, krigsskader |
| `evaluateNpcDefection` | Triggered fra `macroTick` | Sjekker om NPC-region frivillig tilslutter seg basert på score §2 |
| `gainInfluence` | Triggered fra trade/diplomacy/aid-actions | Øker `players.influence` ved fredelige handlinger (handel fullført, allianse inngått, hjelpepakke sendt) |
| **Bygging og høsting** | | |
| `buildBuilding` | Callable | Validerer ressurser, plass, tomter; trekker kostnad; legger til `buildQueue` |
| `cancelBuild` | Callable | Avbryter bygg-i-kø, refunderer delvis |
| `harvestBuilding` | Callable | Sjekker timer, overfører fra produksjon til lager |
| **Ekspansjon og nasjon** | | |
| `expandRegion` | Callable | Server-validert **militær** overtakelse av nabo (se nedenfor) |
| `attemptDiplomaticTakeover` | Callable | **Diplomatisk overtakelse** av NPC-region: krever at nabo + NPC.satisfaction < 30. Halv kostnad ifht. militær. **Stub i fase 1** (returner "ikke implementert"), full impl. fase 2a. |
| `investInRegion` | Callable | **Økonomisk overtakelse** av NPC-region: spilleren betaler over tid → øker integrasjon uten militær. **Stub i fase 1**, full impl. fase 2a. |
| `formNation` | Callable | Krav-sjekk: ≥70% kulturmatch (historisk) ELLER ≥5 sammenhengende regioner (egendefinert), ≥1 by-region (`cityTag = "city"`), tilfredshet ≥50% (historisk) / ≥40% (egendefinert), sammenhengende territorium. Oppretter nasjon, øker `meta.nationCount` atomisk. |
| `dissolveNation` | Callable | Oppløsing (sjelden) – dekrementerer `meta.nationCount` |
| **Diplomati, krig, handel** | | |
| `proposeTrade` / `acceptTrade` / `cancelTrade` | Callable | Direkte handelsforslag mellom to parter |
| `matchOrders` | Triggered fra `markets/orders/.../onCreate` | Orderbook-clearing for globalt marked: leter etter motpart med matchende pris (best buy mot best sell), oppretter trade, oppdaterer `priceHistory`. |
| `proposeAlliance` / `acceptAlliance` / `breakAlliance` | Callable | Diplomati |
| `declareWar` | Callable | Oppretter `wars/{warId}`, setter `contestedAt` på regioner |
| `resolveCombat` | Triggered fra `macroTick` | Beregner kamputfall per aktiv `war` (kampalgoritme – egen spec, se §13.1) |
| `proposeCeasefire` / `acceptCeasefire` | Callable | Avslutt krig, frigi regioner |
| **Lærer-spesifikke** | | |
| `teacherInjectEvent` | Callable (lærer-claim) | Hendelseskort |
| `freezeGame` / `resumeGame` | Callable (lærer) | Frys-og-diskuter |
| `setStartZones` | Callable (lærer) | Konfigurer hvilke kontinenter klassen kan starte i |
| `exportReport` | Callable (lærer) | Generer læringsrapport (CSV/JSON). Inkluderer mapping mellom elevhandlinger og LK20-kompetansemål (samfunnsfag 8.–10. trinn: «drøfte korleis maktforhold blir påverka av geografiske og historiske forhold»). `data/lk20-mapping.json` definerer hvilke handlinger (handel, krig, nasjonsdanning, NPC-frivillig-tilslutning) som teller mot hvilke mål. |
| **System** | | |
| `autoFreezeOnIdle` | Scheduled (daglig) | Setter `status = frozen` for spill uten aktivitet > 7 dager (kostnadsstyring) |

**Hvorfor server-validert ekspansjon:** Hvis klient kunne overskrive `regions/{id}/ownerId` direkte, kunne en spiller ta hvilken som helst region. Server må:
1. Sjekke at ekspansjonsmål er nabo til en region spilleren eier (via `adjacency.json`)
2. Trekke kostnaden fra spillerens treasury/military
3. Sette `integration = 0`, `integrationStartedAt = now`, `ownerId = slotId`
4. Logge hendelsen til `events`

**Tekstkonvensjoner:**
- Alle callable-funksjoner returnerer `{ ok: true, data?: ... } | { ok: false, error: "kode", melding: "tekst på norsk" }` så klient kan vise lokalisert feilmelding direkte.
- Alle muterende funksjoner skriver til `events`-strømmen for revisjon og lærer-dashboard.

---

## 10. Sikkerhetsregler

**Hovedprinsipp:** Klient skriver tilnærmet ingenting direkte til `/games/{gameId}`. Alle muterende handlinger går via Cloud Functions. Sikkerhetsreglene er primært en *defense in depth* — selv om en funksjon har bug, skal ikke en elev kunne sette `treasury: 999999999` fra devtools.

```json
{
  "rules": {
    "games": {
      "$gameId": {
        // Lese-tilgang: lærer for hele spillet, elev hvis de har en aktiv slot i rosteren
        ".read": "auth != null && (data.child('meta/teacherId').val() === auth.uid || data.child('roster').orderByChild('currentUid').equalTo(auth.uid).limitToFirst(1).val() != null)",

        "meta": {
          ".write": "auth.uid === data.child('teacherId').val()",
          ".validate": "newData.hasChildren(['classCode', 'teacherId', 'status', 'schemaVersion'])"
        },

        "roster": {
          // Kun lærer kan endre roster (callable bruker Admin SDK; direkteskriving som lærer er tillatt for nødfall)
          "$slotId": {
            ".write": "auth.uid === root.child('games').child($gameId).child('meta/teacherId').val()"
          }
        },

        "regions": {
          // Aldri klient-skriving — kun Cloud Functions (Admin SDK) kan endre region-state
          ".write": false
        },

        "players": {
          "$slotId": {
            // Klient kan IKKE skrive treasury/military/regionIds — kun Cloud Functions
            ".write": false,
            "displayName": {
              // Unntak: spilleren kan oppdatere sitt eget visningsnavn (mens vedkommende eier sloten)
              ".write": "root.child('games').child($gameId).child('roster').child($slotId).child('currentUid').val() === auth.uid",
              ".validate": "newData.isString() && newData.val().length >= 1 && newData.val().length <= 30"
            },
            "lastSeenAt": {
              // Klient kan oppdatere sin egen presence-timestamp
              ".write": "root.child('games').child($gameId).child('roster').child($slotId).child('currentUid').val() === auth.uid",
              ".validate": "newData.val() <= now"
            }
          }
        },

        "nations": { ".write": false },     // kun via formNation/dissolveNation
        "wars":    { ".write": false },     // kun via declareWar/resolveCombat
        "units":   { ".write": false },     // kun server
        "diplomacy": { ".write": false },   // kun via diplomati-funksjoner
        "markets": { ".write": false },     // kun via trade-funksjoner
        "events":  { ".write": false },     // kun server (auditlogg)
        "teacher": {
          ".write": "auth.uid === root.child('games').child($gameId).child('meta/teacherId').val()"
        },

        "chat": {
          "$channelId": {
            "$messageId": {
              // Spilleren må eie en aktiv slot
              ".write": "auth != null && root.child('games').child($gameId).child('roster').orderByChild('currentUid').equalTo(auth.uid).limitToFirst(1).val() != null",
              ".validate": "newData.hasChildren(['authorSlotId', 'text', 'sentAt']) && newData.child('text').isString() && newData.child('text').val().length > 0 && newData.child('text').val().length <= 500 && newData.child('sentAt').val() <= now"
            },
            // Indeksering for kronologisk visning
            ".indexOn": ["sentAt"]
          }
        }
      }
    }
  }
}
```

**`.indexOn` kreves der vi queryer:**
- `roster` på `currentUid` (innloggings-oppslag)
- `chat/$channelId` på `sentAt`
- Legg til etter behov når nye queries innføres

**Rate-limiting:** RTDB-regler kan ikke uttrykke ekte rate-limits. Chat-spam håndteres via Cloud Function-trigger på `chat/.../$messageId.onCreate` som teller meldinger per slot per minutt og sletter overskridende.

**Lærer-auth:** Lærer logger inn med Google. Ingen custom claim trengs — `meta.teacherId` matches direkte mot `auth.uid` i reglene.

> **🚨 KRITISK — Admin SDK-krav:**
>
> Alle muterende Cloud Functions MÅ bruke `firebase-admin` SDK (`admin.database()`),
> IKKE klient-SDK med caller-auth. RTDB-reglene har `".write": false` på regions,
> players, nations, wars, units, diplomacy, markets, events — KUN Admin SDK omgår
> disse reglene fordi den autentiserer som server-prinsipal.
>
> Standard mønster for alle filer i `functions/src/`:
>
> ```ts
> // functions/src/_db.ts
> import * as admin from 'firebase-admin';
> admin.initializeApp();
> export const db = admin.database();
> ```
>
> Hvis en utvikler ved et uhell bruker klient-SDK i en Cloud Function, vil
> reglene avvise skrivingen og funksjonen feiler stille. Denne lærdommen er
> dokumentert her fordi det er en vanlig fallgruve som ikke fanges av Vitest
> mot mock-DB.

---

## 11. Frontend-arkitektur

### State-lag
- **Zustand-store (`game/store.ts`)** holder lokal speiling av RTDB-data
- **Firebase listeners** monteres i `Game.tsx`, oppdaterer Zustand
- **Selector-hooks** (`useMyRegions()`, `useNeighborsOf(regionId)`, …) for komponenter

### Render-strategi for 2000 regioner

**Valgt tilnærming (verifiseres med POC i fase 0 uke 1):**
1. **Leaflet med `L.canvas()` renderer** som hoveddrivverk — 5-10x raskere enn standard SVG-renderer for 2000+ polygoner
2. **Polygon-forenkling per zoom-nivå**: forhåndskompiler tre versjoner via mapshaper (zoom 2-4: aggressiv simplify, zoom 5-7: medium, zoom 8+: full detalj). `RegionLayer` bytter dataset basert på `map.getZoom()`.
3. **Batched `setStyle()` per feature, debounced via `requestAnimationFrame`**: Zustand-snapshot diffes per macro-tikk — kun endrede regioner får ny `pathOptions`. CSS-klasser brukes IKKE for region-state (canvas-renderer har ingen DOM-noder per polygon); klasser reserveres for SVG-overlays (konflikt-markører, ekspansjonsglød) som ligger som separat lag over canvas.

**Kun hvis POC viser < 30 FPS på laveste hardware (typisk Chromebook):**
- Fall tilbake til vector tiles via `leaflet-vectorgrid` med pre-tiled MVT-output fra `tippecanoe`
- Dette er en større arkitektur-endring og bør unngås om mulig

**POC-krav (fase 0 uke 1, før RegionLayer-arbeid starter):**
1. Last 2000 testpolygoner i Leaflet med `L.canvas()`
2. Mål FPS ved pan/zoom på Chromebook (eller laveste mål-hardware)
3. Mål initial-paint-tid
4. Skriv kort `MAP_RENDERING_DECISION.md` med tall + valgt strategi
5. Kun deretter: bygg `RegionLayer` for ekte data

### Subscription-strategi (RTDB listeners)

Med 150 spillere og 2000 regioner per spill kan en naiv full-tre-listener slå ihjel bandwidth (≈60 MB per macroTick * 150 spillere). Tolags-strategi:

```
LAG 1 — DETAIL (zoom 8+):
  /games/{gameId}/regions/{id}     for spillerens egne regioner + 1-hop naboer
                                    (typisk 5–25 regioner per spiller)
  Lytter monteres i useMyRegionsListener() når MapScreen mountes.

LAG 2 — SUMMARY (zoom 2–7):
  /games/{gameId}/regionsSummary/{tileId}   aggregert per ~10x10 region-tile
                                             { ownerId, empireColorIdx, count }
  Oppdateres av macroTick (server skriver kun når ownership endres).
  Lytter monteres i useWorldSummaryListener() ved MapScreen mount.

ZoomController.tsx bytter mellom lagene basert på map.getZoom():
  - Zoom < 8:  bruk SUMMARY (raskt verdensoversiktsbilde)
  - Zoom ≥ 8:  bruk DETAIL (full state for synlige regioner)

Estimert bandwidth: ~5 MB per spiller per time, totalt ~750 MB/time for 150 spillere.
```

Dette krever en ny node i datamodellen:

```ts
// /games/{gameId}/regionsSummary/{tileId}    (tileId = "lng_lat" rounded to 10°)
{
  ownerCount: { player: 12, npc: 3 },     // tellinger per kategori
  dominantOwnerId: "slot_xxx",
  empireColorIdx: 42,
  lastUpdatedAt: 1714000000000
}
```

### Kritiske komponenter
| Komponent | Ansvar | Plassering |
|---|---|---|
| `Game.tsx` | Shell: TopBar + BottomNav + aktiv skjerm | route |
| `MapScreen` | Skjerm 1 fra mockup | screens/ |
| `MarketScreen` | Skjerm 2 fra mockup | screens/ |
| `DiplomacyScreen` | Skjerm 3 fra mockup | screens/ |
| `WarScreen` | Skjerm 4 fra mockup | screens/ |
| `MapView` | Leaflet-init, layer-management | map/ |
| `RegionLayer` | GeoJSON med dynamisk styling fra Zustand | map/ |
| `RegionTooltip` | Hover-info | map/ |
| `NasjonsPanel` | Venstre sidepanel i MapScreen | features/nation/ |
| `KontekstPanel` | Høyre sidepanel når region valgt | features/expansion/ |
| `BuildingPanel` | Klikk-bygg-system | features/harvest/ |
| `NationModal` | Krav-sjekk og dannelse (70 % terskel) | features/nation/ |
| `ChatDock` | Globalt + privat | features/chat/ |
| `EventToast` | Hendelseskort-popup | features/events/ |

---

## 12. Karthåndtering (Leaflet)

### Base-kart (tile-layer)

```ts
// src/map/MapView.tsx
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: '© OpenStreetMap contributors',
  maxZoom: 14,
  minZoom: 2,
}).addTo(map);
```

NPC-regioner rendres med `fill-opacity: 0.6` over tiles slik at landskap er synlig under (matcher mockup). Spiller-regioner rendres med `fill-opacity: 0.85` for å overskygge bakgrunnen.

**Fall-back ved offline / blokket OSM:** Hvis tile-layer ikke laster innen 3 sekunder, vis ren fargefylt verden (havblå bakgrunn `#0e1a26`, regioner som solide flater) — spillet er fullt funksjonelt uten tiles, det er kun visuell flair.

**Attribusjon:** OSM krever synlig "© OpenStreetMap contributors" — håndteres av Leaflet automatisk i nedre høyre hjørne.

### Zoom-styling
Implementeres i `ZoomController.tsx` ved å lytte på `map.on('zoomend')` og oppdatere CSS-klasser på lag-rotelement (`.zoom-low`, `.zoom-mid`, `.zoom-high`).

```ts
// styles.ts
const zoomClassName = (z: number) =>
  z <= 4 ? 'zoom-world' :
  z <= 7 ? 'zoom-nation' :
  z <= 10 ? 'zoom-region' : 'zoom-building';
```

CSS i `styles.ts` matcher seksjon 9.2 i design.md (NPC stiplet, spiller solid, ekspansjonsmål med pulse-animasjon).

### Konflikt-markører
Egen Leaflet-layer (markers) for `🔥 omstridte regioner`, oppdateres når `regions/{id}/contestedAt` settes av server.

---

## 13. Spilløkken – tikk-system

| Tikk | Frekvens | Hvor | Ansvar |
|---|---|---|---|
| **UI-tikk** | 1 sek | Klient | Tell ned klar-til-høste-timere visuelt; ingen state-endring |
| **Makro-tikk** | 10 min | Server (`pubsub.schedule`) — **eneste sannhetskilde for progresjon** | Akkumuler `pendingHarvest` per bygning, kall `tickSatisfaction` + `tickPopulation` + `evaluateNpcDefection` + `resolveCombat`, oppdater integrasjon, oppdater `regionsSummary` |
| **Daglig tikk** | 24 t | Server | Vedlikeholdskostnad-eskalering, `autoFreezeOnIdle` for forlatte spill |

> **Mikro-tikk er bevisst utelatt.** En tidligere versjon hadde klient-trigget mikro-tikk hvert minutt, men dette skapte en fairness-feile: en spiller med fanen åpen ville få 60x mer progresjon enn én som kun åpner spillet morgen og kveld. All progresjon må være server-skedulert og uavhengig av klient-tilstedeværelse i et 4-ukers klasserom.

Server-tikket er **idempotent**: hver region har `lastTickAt`, og funksjonen beregner produksjon basert på `now - lastTickAt` (clamp til maks 1 time for å unngå overgenerering hvis spillet er pauset).

### 13.1 Kampalgoritme (krig-mekanikk)

Krig-mekanikken er ikke nedarvet fra v0.4 (fila finnes ikke i repoet) — her er en konkret minimumsspec som må raffineres før fase 2b:

**Trigger:** En aktiv `wars/{warId}` med `contestedRegionIds`.

**Per makro-tikk, for hver aktiv krig (`resolveCombat`):**

```ts
for (const regionId of war.contestedRegionIds) {
  const attackers = units.filter(u => u.ownerId === war.attacker && u.regionId === regionId);
  const defenders = units.filter(u => u.ownerId === war.defender && u.regionId === regionId);
  const attackPower = sumStrength(attackers) * (terrainBonus(regionId, 'attack'));
  const defendPower = sumStrength(defenders) * (terrainBonus(regionId, 'defense')) + region.defense;

  // Stokastisk men forutsigbar (seed = warId+tick) — gjør det testbart
  const rng = seededRng(`${warId}:${tickIdx}`);
  const attackerLoss = Math.round(defendPower * 0.1 * rng.next());
  const defenderLoss = Math.round(attackPower * 0.15 * rng.next());

  applyLosses(attackers, attackerLoss);
  applyLosses(defenders, defenderLoss);

  // Erobring: hvis defender < 1 og attacker > 0
  if (sumStrength(defenders) < 1 && sumStrength(attackers) > 0) {
    transferRegion(regionId, war.attacker, integration: 0);
    war.contestedRegionIds = war.contestedRegionIds.filter(r => r !== regionId);
  }
}

// Krig slutter når contestedRegionIds er tom ELLER en part aksepterer ceasefire
if (war.contestedRegionIds.length === 0) {
  war.status = 'ended';
}
```

**Pedagogiske avveininger:**
- Stokastikk = elever opplever at krig er usikker (realistisk)
- Forutsigbar seed = lærer kan reprodusere utfall hvis det er tvil
- Terreng-bonus (fjell, øy) = elever lærer hvorfor visse steder er forsvarbare
- Ingen «klikk-for-å-vinne» — krig krever tropper, tid, ressurser

**Spec-ferdig før fase 2b:** Sett opp møte for å gjennomgå denne med en lærer/spilldesigner — det viktigste her er pedagogisk balanse, ikke teknisk korrekthet.

### 13.2 Reconnect og transport-feil

«Offline-modus» er ikke-mål, men brutt forbindelse i en aktiv økt er normal nett-virkelighet og må håndteres elegant.

**Mønster:**
1. **Alle muterende handlinger går via `httpsCallable` Cloud Function** — aldri direkte RTDB-write fra klient (bortsett fra `displayName`/`lastSeenAt` per §10).
2. **UI-state for hver muterende handling:**
   - `idle` → `pending` (vis spinner, deaktiver knapp) → `success` / `error`
   - Ved `error`: vis melding med "Prøv igjen"-knapp
3. **RTDB listeners** kun for visning av server-bekreftet state. RTDBs innebygde offline-cache er trygg her fordi vi ikke skriver direkte.
4. **Presence (`lastSeenAt`):** Klient skriver hvert 30. sek mens fanen er aktiv. Lærer-dashboard viser hvem som er online.
5. **Reconnect-test:** Inkluder i fase 0-DoD: koble fra wifi, vent 1 min, koble til, verifiser at neste handling fungerer.

---

## 14. Implementeringsfaser med oppgaver

### Fase 0 – Fundament og kart *(3–4 uker)*

**Mål:** Tomt React-prosjekt med Firebase, kart med 2000 NPC-regioner, lærer kan opprette spill, elev kan logge inn via roster og velge startregion.

**Uke 1 — fundament + kart-POC (kritiske risiki først):**
- [ ] `npm create vite@latest geopolity -- --template react-ts`
- [ ] Sett opp Tailwind, ESLint, Prettier, **Vitest**
- [ ] `firebase init` (Auth, RTDB, Functions, Hosting valgfritt)
- [ ] **Kart-POC:** 2000 testpolygoner i Leaflet+canvas, mål FPS, skriv `MAP_RENDERING_DECISION.md` (se §11)
- [ ] **Auth-POC:** Lærer Google-login + opprett tomt spill via `createGame`
- [ ] GitHub Actions workflow (test + build + deploy til Pages, base `/geopolity/`)

**Uke 2 — UI-shell og statiske data (parallelt med 7b-kuration):**
- [ ] `tokens.ts`, `TopBar`, `BottomNav`, `Panel` — tom skjelett som matcher mockup
- [ ] Bygg `scripts/build-regions.ts` (se §7a)
- [ ] Start `data/cultural-tags.json` for Europa (se §7b)
- [ ] Bygg `scripts/compute-adjacency.ts`
- [ ] `empire-colors.ts`: generer 150 distinkte farger via golden-ratio HSL **+ Vitest-test for distinkthet**

**Uke 3 — Cloud Functions og innlogging:**
- [ ] Cloud Functions: `createGame`, `addRosterSlot`, `joinGame`, `pickStartRegion` (alle med Vitest-tester)
- [ ] Sikkerhetsregler (§10) + emulator-tester
- [ ] `Login.tsx`: klassekode + navnefelt → kall `joinGame`
- [ ] Lærerpanel-stub: opprett spill + paste-inn klasselista
- [ ] `scripts/seed-firebase.ts` (gameId-skjelett med 2000 NPC-regioner)

**Uke 4 — kart i drift:**
- [ ] Implementer `MapView` + `RegionLayer` (vis alle 2000 grå regioner)
- [ ] `PickRegion.tsx`: klikk for å velge startregion → kall `pickStartRegion`
- [ ] Render spillerens valgte region i imperiumfarge
- [ ] `Game.tsx`-shell med BottomNav som bytter mellom tomme `MapScreen`/`MarketScreen`/`DiplomacyScreen`/`WarScreen`
- [ ] Reconnect-test: koble fra wifi, koble til igjen, verifiser at presence (`lastSeenAt`) oppdateres

### Fase 1 – Høsting og ekspansjon *(3–5 uker)*

**Mål:** Spiller kan bygge, høste, og ta over NPC-naboregion.

- [ ] AI-genererte placeholder-ikoner for gård, gruve, militærbase
- [ ] `NasjonsPanel` (venstre, MapScreen) med ressurser + bygninger fra mockup
- [ ] `KontekstPanel` (høyre, MapScreen) når en region velges
- [ ] `BuildingPanel` med byggekøer
- [ ] `harvest/`-feature: timere, klikk-for-å-høste
- [ ] Cloud Function `macroTick` (produksjon basert på bygninger og biom)
- [ ] Lokalt + sentralt lager (UI-toggle)
- [ ] Naboer markert med grønn glød på kart
- [ ] Cloud Function `expandRegion` (militær overtakelse av NPC)
- [ ] `integration`-fremdrift som fyller seg over 24t
- [ ] Region skifter til imperiumfarge når `integration === 100`
- [ ] TopBar-tellerne live-oppdatert fra Zustand
- [ ] **Schema-versjons-sjekk:** Klient leser `meta.schemaVersion` ved init. Ved mismatch (klient < server) vises full-screen «Last inn på nytt»-banner som blokkerer videre interaksjon til eleven refresher. Ved server < klient-versjon: ignorert (forventet under deploy-vindu).

### Fase 2a – Nasjonsdanning, handel, diplomati *(3–4 uker)*

**Mål:** Spillere kan danne nasjon og samhandle fredelig.

**Forutsetning:** §7b-kuration har minst 80% dekning av Asia og Afrika.

- [ ] Hent kulturell tilhørighet inn i regions-data
- [ ] Cloud Function `formNation` (**70 % kulturmatch** / 5 sammenhengende) **+ Vitest-suite**
- [ ] `NationModal`: krav-sjekk, type-valg, flagg/farge
- [ ] Cloud Function `evaluateNpcDefection` (frivillig NPC-tilslutning per §2)
- [ ] **MarketScreen** (skjerm 2): tabell, marked-graf (Recharts), ØKONOMI-panel, HANDELSAVTALER
- [ ] Globalt marked (Cloud Function `proposeTrade`/`acceptTrade`/`cancelTrade`) **+ tester**
- [ ] **DiplomacyScreen** (skjerm 3): diplomatliste, valgt-nasjon-panel, force-graph (`react-force-graph-2d`)
- [ ] Diplomatiske noter (UI + RTDB)
- [ ] Chat: globalt + privat (kanal per par) + spam-trigger (§10)
- [ ] Cloud Function `proposeAlliance`/`acceptAlliance`/`breakAlliance`

### Fase 2b – Krig *(2–3 uker)*

**Mål:** Spillere kan erklære krig, slåss om regioner, og inngå fred.

**Forutsetning:** §13.1 kampalgoritme er gjennomgått og godkjent.

- [ ] `units/{unitId}` datamodell + UI for å bygge enheter
- [ ] Cloud Function `declareWar` (oppretter `wars/{warId}`, setter `contestedAt`)
- [ ] Cloud Function `resolveCombat` (per makro-tikk, kampalgoritme §13.1) **+ omfattende Vitest-suite**
- [ ] Cloud Function `proposeCeasefire` / `acceptCeasefire`
- [ ] **WarScreen** (skjerm 4): konflikt-kart, krigsverdier, enheter, hendelses-log
- [ ] Konflikt-markører på kart (rød puls)
- [ ] Lærer-varsling ved krigserklæring

### Fase 3 – Forbund og storpolitikk *(4–6 uker)*

- [ ] Nasjonsforbund (NATO-mekanikk, ny RTDB-struktur)
- [ ] FN-møte (utløses av lærer når `nationCount >= 3`)
- [ ] Allianse-kart (force-directed graph, `react-force-graph`)
- [ ] Vedlikeholdskostnad-skalering i `macroTick`
- [ ] Lærerverktøy: startsone-konfigurasjon
- [ ] Lærerpanel: dashboard, varsler, frys/resume

### Fase 4 – Dybde og polish *(3–4 uker)*

- [ ] Economic Hitman-lag (gjeldsfeller i diplomati)
- [ ] Erstatt placeholder-ikoner med ferdig-designede
- [ ] Læringsrapporter (eksport til PDF/CSV)
- [ ] Frys-og-diskuter UI
- [ ] Mobiloptimalisering (touch-vennlig kart, kompakt UI)
- [ ] Performance-pass (Leaflet canvas, lazy loading)

---

## 15. Risikoer og gjenstående spørsmål

| Risiko | Sannsynlighet | Mitigering | Status |
|---|---|---|---|
| **2000 regioner = treigt kart** | Høy | Canvas renderer, zoom-basert polygon-forenkling, evt. vector tiles fall-back. POC i fase 0 uke 1. | Adressert §11 |
| **Kulturmatch-data ufullstendig** | Høy | Splitt §7 i pipeline (1 uke) + kuration (3-4 uker parallelt). Dekningsmål per fase. | Adressert §7b |
| **Krig-mekanikk ikke spesifisert** | Høy | §13.1 minimumsspec; egen sub-fase 2b; tunge tester | Adressert §13.1 |
| **Elev mister uid → mister imperium** | Høy | Lærer-roster som sannhetskilde; player keys = slotId | Adressert §3.1 |
| **Devtools-angrep (`treasury: 999999`)** | Høy | Felt-granulære sikkerhetsregler; alle muterende handlinger via Cloud Functions | Adressert §10 |
| **GeoJSON-kilde mangler dekning** | Middels | Natural Earth + manuell QA, dokumentér gap | Pågående §7 |
| **RTDB blir dyrt ved 150 spillere** | Middels | To-lags subscription (§11 DETAIL/SUMMARY), `autoFreezeOnIdle`, `deleteGame` etter spill-slutt | Adressert §11 |
| **Bygningssystem var udokumentert** | Høy (lukket) | §6.5 Bygningstabell + `data/buildings.json` | Adressert §6.5 |
| **Aktiv vs. passiv høsting uavklart** | Høy (lukket) | Aktiv klikk-modell (Hay Day) bekreftet — `pendingHarvest` per bygning | Adressert §6.5/§13 |
| **Mikro-tikk fairness-felle** | Høy (lukket) | Mikro-tikk fjernet — kun server-skedulert makro-tikk | Adressert §13 |
| **Diplomatic/economic takeover manglet** | Kritisk (lukket) | `attemptDiplomaticTakeover` + `investInRegion` (stub fase 1, full 2a) | Adressert §9 |
| **Markets uten matching engine** | Høy (lukket) | `matchOrders` trigger + restrukturert orderbook | Adressert §9, §6 |
| **Elev-slutter-mid-spill manglet** | Høy (lukket) | `removeRosterSlot` med `disposition`-parameter | Adressert §9 |
| **Empire-color tildeling kollisjon** | Middels (lukket) | 6-fargers atomisk reservasjon i `pickStartRegion` | Adressert §9 |
| **Naboskap inkluderer feil par** | Middels | Manuell QA i kjernet område (Europa) før release | Pågående |
| **Cloud Function cold start** | Lav | Min instances = 1 ved aktive spill | Planlagt |
| **Klassekode-kollisjon** | Lav | Random 6-tegns kode + sjekk i `createGame` | Planlagt |
| **Reconnect tap-handling** | Lav | httpsCallable-mønster + UI-state per handling | Adressert §13.2 |

**Avklart (§2):**
- ✅ Nasjonsterskel = 70 %
- ✅ Hav er ikke spillbart
- ✅ NPC frivillig tilslutning er aktivert (attraktivitetsscore §2)
- ✅ Auth via lærer-roster (§3.1)
- ✅ Vitest fra fase 0 (§3.2)

**Lukket i v3 (etter andre plan-audit):**
- ✅ Bygningstabell — adressert §6.5
- ✅ Diplomatic + economic takeover — adressert §9 (`attemptDiplomaticTakeover`, `investInRegion`)
- ✅ Avvik fra design.md — eksplisitt dokumentert §0
- ✅ Aktiv vs. passiv høsting — avklart, aktiv klikk-modell §6.5 + §13
- ✅ Mikro-tikk fairness-felle — fjernet §13
- ✅ Markets matching engine — `matchOrders` + restrukturert datamodell §6
- ✅ Satisfaction/population endringsregler — `tickSatisfaction` + `tickPopulation` §9
- ✅ Lærer-roster: elev-slutter-mid-spill — `removeRosterSlot` med disposition §9
- ✅ Empire-color valgkollisjon — 6-fargers atomisk reservasjon §9 (`pickStartRegion`)
- ✅ RTDB bandwidth ved 150 spillere — to-lags subscription §11 (DETAIL/SUMMARY)
- ✅ Canvas-rendering vs. CSS-klasser — avklart §11 (batched setStyle)
- ✅ Admin SDK-krav for Cloud Functions — eksplisitt boks §10
- ✅ Tile-layer (base-kart) — OSM med fall-back §12
- ✅ Influence-kilde — `gainInfluence` §9
- ✅ players.military vs. units — kommentar i datamodell §6
- ✅ deleteGame for GDPR — §9
- ✅ Klient-versjonsmismatch — fase 1-oppgave (se §14)
- ✅ Kompetansemål-kobling — `exportReport` med LK20-mapping §9
- ✅ Aksessibilitet — eksplisitt mål §1, WCAG 2.1 AA

**Fortsatt åpent (må adresseres):**
- ❓ Tap-spilleren i «Norge»-kappløpet: får de danne «Norrønt Rike»? — middels prioritet, fase 2a
- ❓ Regionsammenslåing/union mellom to spillere → fase 3
- ❗ **GDPR-godkjenning før pilot:** Lærer-roster (§3.1) lagrer kun elevnavn, men trenger formell vurdering av Datatilsynet/skolens personvernombud før første klasseromsbruk
- ❓ Onboarding/tutorial for nye elever — fase 1
- ❓ Lærer-dashboard detalj-spec — fase 3
- ❓ Kostnadsestimat — RTDB + Cloud Functions ved N parallelle spill (kjøres i fase 0 uke 1 sammen med kart-POC)
- ❓ i18n-strategi — hardkodet norsk i MVP (avgjort), bibliotek vurderes hvis pilot lykkes
- ❓ Chat-moderasjon — profanity-filter, lærer-mute, foreldreklage-logg (fase 2a)
- ❓ Strategisk verdi-mekanikk: brukes pt. kun til `maxSlots` i §6.5 — bør den også påvirke kamp/integrasjon? (fase 2b avgjørelse)

---

## 16. Definition of Done per fase

**Fase 0 ferdig når:**
- `MAP_RENDERING_DECISION.md` er skrevet med faktiske FPS-tall fra POC
- En lærer kan opprette spill via Google Auth + klassekode + paste-inn klasseliste
- 150 elever kan logge inn ved å skrive klassekode + navn fra lista, og bli koblet til riktig slot uten kollisjoner
- En elev kan logge inn fra ny enhet (ny anonym uid) og fortsatt ha sin imperium-farge intakt (lærer-roster fungerer)
- Kartet viser 2000 regioner ved zoom 2 i < 2 sek på en moderne laptop, og holder > 30 FPS ved pan/zoom på Chromebook
- Spillerens region har riktig imperiumfarge etter valg
- UI-shell matcher mockup-layout (TopBar + BottomNav synlige, alle 4 skjermer-tabs klikkbare med tomme placeholders)
- Reconnect-test bestått: koble fra wifi, vent 1 min, gjør neste handling — fungerer
- Vitest-suite for `createGame`, `joinGame`, `pickStartRegion`, `empire-colors` er grønn i CI
- Mobil-fallback: ved viewport `< 768px` vises «Spillet krever desktop. Bruk PC eller Chromebook.»-skjerm i stedet for å forsøke render — ingen krasj på mobil i fase 0–3

**Fase 1 ferdig når:**
- En spiller kan bygge en gård, vente 5 min, høste, og se ressursøkning
- Spilleren kan ta over en NPC-naboregion via militær overtakelse
- Regionen integreres over tid og bytter farge

**Fase 2a ferdig når:**
- To spillere kan begge prøve å danne «Norge», og kun den første lykkes
- Spillere kan sende diplomatisk note og chatte
- En handel kan inngås og fullføres
- Allianser kan inngås og brytes

**Fase 2b ferdig når:**
- En spiller kan erklære krig på en annen, sende enheter, og enten erobre en region eller miste tropper
- Krigen vises korrekt på WarScreen for begge parter
- Lærer får varsel ved krigserklæring
- Ceasefire kan foreslås og aksepteres

**Fase 3 ferdig når:**
- Lærer kan starte FN-møte og se alle nasjoner stemme
- Vedlikeholdskostnad merkes når en spiller har > 20 regioner
- Lærer kan fryse spillet og se status-dashboard

**Fase 4 ferdig når:**
- Spillet kan kjøres en hel skoleuke uten manuelle inngrep
- Læringsrapport eksporteres og leses av lærer
- Mobil fungerer for chat og enkle handlinger

---

*GEOPOLITY · Implementeringsplan v3 · Skrevet 2026-04-26 · Revidert 2026-04-26 (post andre plan-audit)*
