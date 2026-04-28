# Playtest-guide — Geopolity

## TL;DR

```bash
# Terminal 1
npm run dev

# Terminal 2
npm run play
```

Scriptet oppretter et testspill, logger inn to anonyme brukere (lærer + spiller),
velger en startregion, ekspanderer militært, investerer i naboer, og trigger en
dev-tick for å se diplomatiske overtakelser — alt headless og automatisk.

---

## Hurtigsjekkliste (erfarne testere)

<details>
<summary>Klikk for å utvide</summary>

- [ ] `npm run dev` kjører på port 5173
- [ ] `TICK_DEV_ENABLED=true` i `functions/.env`
- [ ] `triggerDevTick` deployet (`firebase deploy --only functions:triggerDevTick`)
- [ ] Anonym auth aktivert i Firebase Console
- [ ] Opprett spill via `/teacher`, logg inn som spiller, velg startregion
- [ ] Ekspander 2 regioner (2 × 25 ⚔️), invester i 6 naboer (6 × 50 💰)
- [ ] DevPanel (nedre venstre hjørne) → trigger 5+ tikk
- [ ] Sjekk Hendelser-fanen for `npc-defection`

**Hurtigtips:** sett `DEFECTION_STREAK_REQUIRED=1` i `functions/src/expansion-logic.ts` for å se diplomatisk overtakelse på første tikk.

</details>

---

## Forutsetninger

| Krav | Sjekk |
|------|-------|
| Dev-server kjører på port 5173 | `npm run dev` |
| Anonym auth aktivert i Firebase | Firebase Console → Authentication → Sign-in providers → Anonymous |
| `triggerDevTick` deployet | `firebase deploy --only functions:triggerDevTick` |
| `functions/.env` inneholder `TICK_DEV_ENABLED=true` | `cat functions/.env` |

Anonym auth trenger kun aktiveres én gang per Firebase-prosjekt. Gjøres i
[Firebase Console](https://console.firebase.google.com/project/geopolity-app/authentication/providers).

---

## Hva play.ts gjør (5 steg)

1. **Lærer oppretter spill** — ny anonym bruker, naviger til `/teacher`, skriv inn navn "Playwright-test", klikk Opprett
2. **Spiller logger inn** — ny anonym bruker i eget browser-kontekst
3. **Bli med + velg startregion** — `/servers` → Bli med → `/pick`: klikk SVG-paths systematisk til en region velges
4. **Militær ekspansjon** — bruker 25 militær per region, gjentar til militær = 0
5. **Invest i naboer** — bruker 50 kr per region for å bygge diplomatisk innflytelse
6. **Dev-tick** — kaller `triggerDevTick` callable for å kjøre `macroTick` umiddelbart

---

## Forventet resultat

Startressurser: **⚔️ 50 militær**, **💰 500 kr**

| Fase | Resultat |
|------|----------|
| Militær ekspansjon | 2 nye regioner (2 × 25 ⚔️) |
| Invest | 300 kr brukt på 6 naboregiioner (6 × 50 kr / +5 sat per invest) |
| Etter dev-tick | Normalt ingen overtakelser ved første tick — se under |

### Hvorfor skjer ikke diplomatisk overtakelse umiddelbart?

Diplomatisk overtakelse (`npc-defection`) er designet som en lang-sikt-mekanikk:

- `INVEST_SAT_GAIN = 5` — hver invest gir +5 tilfredshet til NPC-regionen
- `DEFECTION_THRESHOLD = 0.7` — spillerens attractiveness-score må overstige 70%
- `DEFECTION_STREAK_REQUIRED = 5` — regionen må passere terskelen i **5 påfølgende tikk**

Med 500 kr startkapital og 50 kr per invest kan du gjøre 10 investeringer (max 50 sat).
Attractiveness avhenger av din snitt-tilfredshet + kulturmatch. En nystartet spiller med
lave sat-verdier i egne regioner vil typisk ha attractiveness < 0.4 — langt under 0.7.

For å se diplomatisk overtakelse i en playtest-runde trenger du:
1. Mange invest-runder (10+) per region for å bygge sat mot 50+
2. Minst 5 dev-tikk etter at attractiveness > 0.7 er nådd
3. Eller test med `DEFECTION_STREAK_REQUIRED=1` midlertidig i `expansion-logic.ts`

---

## Dev-tick manuelt

For å trigge tick uten å kjøre hele play.ts:

```bash
# Fra nettleserkonsollen (mens du er logget inn i spillet):
window.__triggerDevTick(window.__gameStore.getState().gameId)
```

---

## Hypertesting med DevPanel

DevPanel er et flytende kontrollpanel i nedre venstre hjørne av spillgrensesnittet.
Det vises kun i dev-modus (`npm run dev`) — aldri i produksjon.

### Åpne panelet

Start `npm run dev` og logg inn i et spill. En liten **"⚡ Dev"**-knapp vises over navigasjonslinjen. Klikk for å utvide.

### Manuell tikk

Klikk **"⚡ Trigger tikk"** for å kjøre én tikk umiddelbart. Panelet viser tikk-teller og tid siden siste tikk.

*Krever `TICK_DEV_ENABLED=true` i `functions/.env` og at `triggerDevTick` er deployet.*

### Auto-tikk

Velg intervall (**3s / 10s / 30s**) for å trigge tikk automatisk. Klikk **AV** for å stoppe.

Anbefalt for å se diplomatiske overtakelser:
1. Sett `DEFECTION_STREAK_REQUIRED=1` (se under)
2. Invester i 3–4 naboer
3. Aktiver auto-tikk på **3s** og observer Hendelser-fanen

### Tikk-pipeline

Én `triggerDevTick` kjører `tickGame(gameId, now)` som gjennomfører disse fasene i rekkefølge:

1. **Bygge-kø** — ferdigstiller bygninger som er klare
2. **Produksjon** — akkumulerer ressurser i `pendingHarvest`
3. **Integrasjon** — fremdrift mot full integrasjon av nylig ekspanderte regioner
4. **Tilfredshet** — justerer `satisfaction` per region
5. **Befolkning** — oppdaterer `population`
6. **Markedsordrer** — matcher kjøps/salgsordrer i ordreboken
7. **Kamp** — løser aktive krigssteg
8. **Innflytelse** — passiv influence per region + allianse
9. **NPC-tilslutning** (`runNpcDefectionForGame`) — evaluerer attractiveness og kjører defection-streaks
10. **Vedlikehold** — trekker vedlikeholdskostnad fra treasury

Diplomatisk overtakelse skjer i steg 9. Krav: attractiveness ≥ 0.7 (`DEFECTION_THRESHOLD`) i `DEFECTION_STREAK_REQUIRED` påfølgende tikk.

### Rask test av diplomatisk overtakelse

```ts
// functions/src/expansion-logic.ts — endre midlertidig:
export const DEFECTION_STREAK_REQUIRED = 1;  // normalt: 5
```

Kjør én tikk → sjekk Hendelser-fanen for `npc-defection`. Husk å sette tilbake til `5` etter testing.

**Attractiveness-formel:**
```
score = 0.3·(sat/100) + 0.2·tradeBond + 0.2·peace + 0.2·kulturMatch + 0.1·(influence/1000)
```

Med 6 × invest gir `tradeBond = 0.30` og score ≈ 0.32 — under 0.7-terskelen.
For å overstige 0.7 trenger du kombinasjon av høy sat, kulturmatch og mange investeringer.

---

## Opprydding

Test-spill opprettes i produksjons-Firebase og bør slettes etter testing:

1. Naviger til `http://localhost:5173/teacher`
2. Finn "Playwright-test" i listen
3. Klikk Slett

Alternativt via Firebase Console → Realtime Database → `games/`.

---

## Lærdom fra feilsøkingsøktene

Disse fallgruvene ble oppdaget og løst under utvikling av play.ts:

### 1. WSL2 har ingen X-server
`headless: false` feiler med "Missing X server or $DISPLAY".
**Fix:** alltid `chromium.launch({ headless: true })`.

### 2. Anonym auth i produksjon
Firebase-prosjekter har anonym auth deaktivert som standard.
**Fix:** aktiver én gang i Firebase Console eller via Identity Toolkit REST API.

### 3. SVG-renderer på /pick, canvas på /game
`/pick`-skjermen bruker Leaflet SVG-renderer. Klikk på `svg path`-elementer direkte.
`/game`-skjermen bruker canvas-renderer. Bruk `window.__leafletMap.latLngToContainerPoint()`
for å konvertere geografiske koordinater til piksler, og klikk der.

### 4. Kartanimasjon ødelegger klikk-presisjon
`map.setView([lat, lng], zoom)` bruker pan-animasjon som standard.
Klikket lander på feil sted hvis animasjonen ikke er ferdig.
**Fix:** `map.setView([lat, lng], zoom, { animate: false })`.

### 5. Useeda regioner mangler i RTDB
Nye spill har ingen `regions/{id}`-noder i RTDB. `expandRegion` og `investInRegion`
returnerte `region-not-found` for alle NPC-regioner.
**Fix:** behandle `null`-target som ueid NPC-region og initier med `getRegionDefaults()`.

### 6. Delvis RTDB-node setter `ownerId` til `undefined`
Etter `investInRegion` på en useeda region opprettes noden med bare `satisfaction`/`tradeBond`.
`ownerId` mangler (undefined ≠ null), noe som brøt `isNPC = region.ownerId === null`.
**Fix:** `isNPC = region.ownerId == null` (løs likhet fanger både null og undefined).

### 7. `ExpandButton` klikkes selv uten militær
`tryExpandAt` returnerte `true` når knappen ble klikket (selv om serveren avviste med
`insufficient-military`). Siden treasury var uendret, skapte dette en uendelig løkke.
**Fix:**
- Sjekk `currentMilitary >= EXPAND_MILITARY_COST` før klikk på ekspander-knapp
- Sammenlign faktisk region-antall før/etter for å avgjøre om noe faktisk skjedde

### 8. KontekstPanel viser ikke knapper for useeda regioner
Den useeda grenen (`!region`) i `KontekstPanel.tsx` viste bare forklaringstekst, ikke
`ExpandButton` eller `NpcInfluencePanel`.
**Fix:** legg til begge knappene i `!region`-grenen når `ownsNeighbor && gameId`.
