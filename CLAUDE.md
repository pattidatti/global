# GEOPOLITY – Claude Code-instruksjoner

Geopolitisk strategi-spill for klasserommet. React + TypeScript + Vite + Firebase RTDB + Leaflet + Pixi.js.

## Kommandoer

```bash
npm run dev              # Vite dev-server (http://localhost:5173/geopolity/)
npm run build            # TypeScript-kompilering + Vite produksjonsbygg
npm run test:run         # Vitest én gang (CI-modus)
npm test                 # Vitest watch-modus
npm run lint             # ESLint
npm run preview          # Forhåndsvis dist/
npm run play             # Kjør spill-script mot emulator
npm run build:regions    # Bygg regions.geojson + regions-meta.json fra rådata
npm run build:adjacency  # Generer adjacency.json
npm run seed             # Populer emulator/RTDB med NPC-regioner
```

Deploy Cloud Functions etter endringer:
```bash
cd functions && npm run build   # kompiler + kopier regions-meta.json til functions/data/
firebase deploy --only functions
```

Firebase-emulatorene:
```bash
firebase emulators:start          # Kjør alle emulatorer (Auth, RTDB, Functions)
cd functions && npm run build     # Kompiler Cloud Functions (kreves før emulering)
```

## Arkitektur

**Identifikasjon:** Spillere refereres alltid med `slotId` (fra lærer-roster), aldri Firebase Auth-uid. Dette gjør at en spiller overlever uid-bytte ved enhetsbytte.

**State-flyt:**
- Cloud Functions (Admin SDK) er eneste sannhetskilde for game-state
- Klient skriver kun `displayName`, `lastSeenAt` direkte til RTDB
- Alt annet (ressurser, regioner, ekspansjon) skjer via `httpsCallable` → Cloud Function → Admin SDK

**Kart-rendering:** Leaflet håndterer GeoJSON-geometri og interaktivitet. Pixi.js (`RegionGraphicsLayer`, `usePixiApp`, `usePixiViewport`) brukes for GPU-akselerert regionfarging og visuelle effekter (skyer, hav, vignett) i `src/map/effects/`.

**Viktig:** Cloud Functions MÅ bruke `firebase-admin` SDK (`functions/src/_db.ts`), aldri klient-SDK. RTDB-reglene har `.write: false` på alle kritiske noder.

## Nøkkelfiler

| Fil | Ansvar |
|---|---|
| `src/game/store.ts` | Zustand-store for all spillstate |
| `src/game/empire-colors.ts` | 150 distinkte imperiumfarger via golden-ratio HSL |
| `src/game/selectors.ts` | `useMyRegions()`, `useMyPlayer()`, `useCanExpandTo()`, osv. |
| `src/firebase/db.ts` | Typed RTDB-subscriptions |
| `src/firebase/auth.ts` | Google-auth (lærer) + anonym auth (elev) |
| `src/firebase/config.ts` | Firebase-init (app, RTDB, auth, functions) |
| `src/firebase/dev-emulators.ts` | Emulator-tilkobling for lokal utvikling |
| `src/map/MapView.tsx` | Leaflet-init med `L.canvas()` renderer + OSM-fallback |
| `src/map/RegionLayer.tsx` | GeoJSON-lag med Zustand-drevet styling |
| `src/map/RegionGraphicsLayer.ts` | Pixi.js GPU-akselerert regionfarging |
| `src/map/PickMapView.tsx` | Regionvalgskart ved spillstart |
| `src/map/BuildingMarkersOverlay.tsx` | Bygningsmarkører på kartet |
| `src/map/effects/{CloudLayer,OceanLayer,VignetteOverlay}.ts` | Visuelle effektlag (Pixi.js) |
| `src/routes/{Login,ServerList,PickRegion,Teacher,Game}.tsx` | Toppnivå-ruter |
| `src/screens/{MapScreen,MarketScreen,DiplomacyScreen,WarScreen,EventsScreen}.tsx` | Aktive skjermer i `Game`-shell |
| `src/features/{building,chat,diplomacy,expansion,league,nation,region,teacher,trade,un,war}/` | Domenespesifikk UI + klient-hooks |
| `src/types/{game,player,region,nation,war,trade,diplomacy,chat,league,un,teacherLog}.ts` | TypeScript-typer per domene |
| `src/utils/production.ts` | Produksjonsberegninger (klient-speil av server) |
| `src/utils/markerPlacement.ts` | Plassering av kartmarkører |
| `src/ui/{tokens,Panel,FloatingPanel,TopBar,BottomNav,ResourceCounter,SchemaVersionBanner,OnboardingGuide,DevPanel}.tsx` | Designsystem + chrome |
| `functions/src/game.ts` | createGame, joinGame, pickStartRegion, confirmEmpireColor |
| `functions/src/teacher.ts` | Lærer-callable: freezeGame, resumeGame, endGame, deleteGame |
| `functions/src/buildings.ts` | buildBuilding, cancelBuild, harvestBuilding |
| `functions/src/expansion.ts` | expandRegion, attemptDiplomaticTakeover, investInRegion |
| `functions/src/nation.ts` | formNation, dissolveNation (≥70% kulturmatch) |
| `functions/src/market.ts` | proposeTrade, acceptTrade, cancelTrade |
| `functions/src/diplomacy.ts` | proposeAlliance, acceptAlliance, breakAlliance, sendDiplomaticNote |
| `functions/src/war.ts` | declareWar, deployUnits, proposeCeasefire, acceptCeasefire |
| `functions/src/league.ts` | createLeague, inviteNationToLeague, acceptLeagueInvite, leaveLeague, dissolveLeague |
| `functions/src/un.ts` | startUnMeeting, castUnVote, closeUnMeeting |
| `functions/src/tick.ts` | Skedulert `macroTick` (hver 10. min) |
| `functions/src/{nation,market,war,diplomacy,buildings,expansion,tick,league,un,maintenance}-logic.ts` | Ren domenelogikk (testbar uten RTDB) |
| `functions/src/_db.ts` | Admin SDK-init + typed refs |
| `functions/src/dev.ts` | `triggerDevTick` – manuell tick for lokal testing |
| `functions/src/index.ts` | Eksport-manifest for alle callables/scheduled |
| `database.rules.json` | RTDB sikkerhetsregler |
| `public/data/buildings.json` | Statisk bygningstabell (kostnad, produksjon, biom-multiplikatorer) |
| `public/geo/{regions.geojson,regions-meta.json,adjacency.json}` | Regiongeometri, metadata, naboliste (~1,7 MB) |
| `data/cultural-tags.json` | ISO-3166 → kulturgruppe-mapping |
| `scripts/{build-regions,compute-adjacency,seed-firebase,play}.ts` | Datapipelinjer + spillscript |
| `e2e/playtest.spec.ts` | Playwright end-to-end-test |

## Datamodell (nøkkel-noder i RTDB)

```
/games/{gameId}/meta                – GameMeta (status, teacherId, classCode, schemaVersion, lastMacroTickAt)
/games/{gameId}/roster/{slotId}     – RosterSlot (displayName, currentUid)
/games/{gameId}/players/{slotId}    – Player (treasury, military, regionIds, empireColor, lastMaintenanceCost)
/games/{gameId}/regions/{regionId}  – Region (ownerId=slotId, integration, buildings, biome)
/games/{gameId}/nations/{nationId}  – Nation (founderId, type, cultureMatch, members, leagueId)
/games/{gameId}/wars/{warId}        – War (attacker, defender, contestedRegionIds, battleLog)
/games/{gameId}/units/{unitId}      – Unit (strength, type, locationRegionId)
/games/{gameId}/diplomacy/{a}_{b}   – Diplomacy (status, since, notes)
/games/{gameId}/markets/{resource}  – orders + priceHistory
/games/{gameId}/leagues/{leagueId}  – League (name, founderNationId, memberNationIds, pendingInvites)
/games/{gameId}/unMeetings/{id}     – UnMeeting (agenda, options, votes, status)
/games/{gameId}/events/{eventId}    – Hendelseskort
/games/{gameId}/chat/{channelId}    – Chat-meldinger (global + 1:1 kanaler)
/games/{gameId}/usedColors          – { colorIdx: slotId } atomisk reservasjon
/games/{gameId}/teacher/log         – Lærers hendelseslogg
/gamesByCode/{classCode}            – gameId (oppslagstabell)
/serverList/{gameId}                – ServerListEntry (global spilliste)
```

Alle disse nodene har `.write: false` i `database.rules.json` — kun Admin SDK (`functions/src/_db.ts`) skriver. Klienten skriver kun til `roster/{slotId}/displayName` og `players/{slotId}/lastSeenAt`.

## Designsystem-tokens

```ts
bg: '#0e1a26'    panel: '#15273a'   accent: '#3da9fc'
good: '#4caf7d'  warn: '#f4a261'    danger: '#e63946'
npc: '#3a3f2e'   textHi: '#e8f1ff'  textLo: '#8aa3bf'
```

## Miljøvariabler

Kopier `.env.example` til `.env` og fyll inn Firebase-konfig:
```
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_DATABASE_URL=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=
```

## Testing

Vitest kjøres mot `src/**/*.test.ts` og `functions/src/**/*.test.ts`.
Alle muterende Cloud Functions skal ha enhetstest FØR deploy.

**Unit-tester (`functions/src/__tests__/`):**
- `game.test.ts` — createGame, joinGame, klassekode-format
- `buildings.test.ts` — kostnad, biom-multiplikatorer
- `expansion.test.ts` + `expansion-logic.test.ts` — militær ekspansjon + NPC-defeksjon
- `nation.test.ts` — 70%-kulturmatch, kontiguitet, nasjonsdanning
- `market.test.ts` — order-matching, prisberegning
- `diplomacy.test.ts` — alliansestatus, diplomatiske notater
- `war.test.ts` — kampalgoritme, terreng-bonus, tap
- `tick.test.ts` — makro-tikkskedulering, tilstandsovergang
- `league-logic.test.ts` — forbundsdanning, oppløsning
- `un-logic.test.ts` — møteagenda-validering, stemmegivning
- `maintenance-logic.test.ts` — vedlikeholdskostnader per tier
- `cultural-tags.test.ts` — datakurasjon, tag-validering
- `seed.test.ts` — region-seeding

**Klient-tester (`src/game/__tests__/`):**
- `empire-colors.test.ts` — distinkthet + golden-ratio-distribusjon

**E2E (`e2e/`):**
- `playtest.spec.ts` — Playwright mot Firebase-emulatorer

## Norsk bokmål

All UI-tekst, feilmeldinger fra Cloud Functions, og variabelnavn i domene-kode er på norsk bokmål. Cloud Function-svar returnerer alltid `{ ok, error?, melding? }` der `melding` er norsk.
