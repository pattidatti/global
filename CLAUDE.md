# GEOPOLITY – Claude Code-instruksjoner

Geopolitisk strategi-spill for klasserommet. React + TypeScript + Vite + Firebase RTDB + Leaflet.

## Kommandoer

```bash
npm run dev              # Vite dev-server (http://localhost:5173/geopolity/)
npm run build            # TypeScript-kompilering + Vite produksjonsbygg
npm run test:run         # Vitest én gang (CI-modus)
npm test                 # Vitest watch-modus
npm run lint             # ESLint
npm run preview          # Forhåndsvis dist/
npm run build:regions    # Bygg regions.geojson + regions-meta.json fra rådata
npm run build:adjacency  # Generer adjacency.json
npm run seed             # Populer emulator/RTDB med NPC-regioner
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
| `src/map/MapView.tsx` | Leaflet-init med `L.canvas()` renderer + OSM-fallback |
| `src/map/RegionLayer.tsx` | GeoJSON-lag med Zustand-drevet styling |
| `src/routes/{Login,ServerList,PickRegion,Teacher,Game}.tsx` | Toppnivå-ruter |
| `src/screens/{MapScreen,MarketScreen,DiplomacyScreen,WarScreen}.tsx` | Aktive skjermer i `Game`-shell |
| `src/features/{building,chat,diplomacy,expansion,nation,region,trade,war}/` | Domenespesifikk UI + klient-hooks |
| `src/types/{game,player,region,nation,war,trade,diplomacy,chat}.ts` | TypeScript-typer per domene |
| `src/utils/production.ts` | Produksjonsberegninger (klient-speil av server) |
| `src/ui/{tokens,Panel,TopBar,BottomNav,SchemaVersionBanner}.tsx` | Designsystem + chrome |
| `functions/src/game.ts` | createGame, joinGame, pickStartRegion, confirmEmpireColor |
| `functions/src/teacher.ts` | Lærer-callable: freezeGame, resumeGame, endGame, deleteGame |
| `functions/src/buildings.ts` | buildBuilding, cancelBuild, harvestBuilding |
| `functions/src/expansion.ts` | expandRegion, attemptDiplomaticTakeover, investInRegion |
| `functions/src/nation.ts` | formNation, dissolveNation (≥70% kulturmatch) |
| `functions/src/market.ts` | proposeTrade, acceptTrade, cancelTrade |
| `functions/src/diplomacy.ts` | proposeAlliance, acceptAlliance, breakAlliance, sendDiplomaticNote |
| `functions/src/war.ts` | declareWar, deployUnits, proposeCeasefire, acceptCeasefire |
| `functions/src/tick.ts` | Skedulert `macroTick` (hver 10. min) |
| `functions/src/{nation-logic,market-logic,war-logic,diplomacy-logic}.ts` | Ren domenelogikk (testbar uten RTDB) |
| `functions/src/_db.ts` | Admin SDK-init + typed refs |
| `functions/src/index.ts` | Eksport-manifest for alle callables/scheduled |
| `database.rules.json` | RTDB sikkerhetsregler |
| `public/data/buildings.json` | Statisk bygningstabell (kostnad, produksjon, biom-multiplikatorer) |
| `public/geo/{regions.geojson,regions-meta.json,adjacency.json}` | Regiongeometri, metadata, naboliste (~1,7 MB) |
| `data/cultural-tags.json` | ISO-3166 → kulturgruppe-mapping |
| `scripts/{build-regions,compute-adjacency,seed-firebase}.ts` | Datapipelinjer |

## Datamodell (nøkkel-noder i RTDB)

```
/games/{gameId}/meta                – GameMeta (status, teacherId, classCode, schemaVersion)
/games/{gameId}/roster/{slotId}     – RosterSlot (displayName, currentUid)
/games/{gameId}/players/{slotId}    – Player (treasury, military, regionIds, empireColor)
/games/{gameId}/regions/{regionId}  – Region (ownerId=slotId, integration, buildings, biome)
/games/{gameId}/nations/{nationId}  – Nation (founderId, type, cultureMatch, members)
/games/{gameId}/wars/{warId}        – War (attacker, defender, contestedRegionIds, battleLog)
/games/{gameId}/units/{unitId}      – Unit (strength, type, locationRegionId)
/games/{gameId}/diplomacy/{a}_{b}   – Diplomacy (status, since, notes)
/games/{gameId}/markets/{resource}  – orders + priceHistory
/games/{gameId}/events/{eventId}    – Hendelseskort (Fase 3 placeholder)
/games/{gameId}/chat/{channelId}    – Chat-meldinger
/games/{gameId}/usedColors          – { colorIdx: slotId } atomisk reservasjon
/gamesByCode/{classCode}            – gameId (oppslagstabell)
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

Nåværende testdekning:
- `src/game/__tests__/empire-colors.test.ts` — distinkthet + golden-ratio-distribusjon
- `functions/src/__tests__/`:
  - `game.test.ts` — createGame, joinGame, klassekode-format
  - `expansion.test.ts` — militær ekspansjon + integrering
  - `buildings.test.ts` — kostnad, biom-multiplikatorer
  - `market.test.ts` — order-matching, prisberegning
  - `nation.test.ts` — 70%-kulturmatch, kontiguitet, nasjonsdanning
  - `war.test.ts` — kampalgoritme, terreng-bonus, tap
  - `diplomacy.test.ts` — alliansestatus, diplomatiske notater
  - `tick.test.ts` — makro-tikkskedulering, tilstandsovergang
  - `cultural-tags.test.ts` — datakurasjon, tag-validering

## Implementeringsfaser

Se `IMPLEMENTATION_PLAN.md` for full spesifikasjon. Status oppdatert 2026-04-26:

- **Fase 0 (~95% ferdig):** Scaffolding, typer, Firebase-config, UI-shell, kart, empire-colors, Cloud Functions (createGame/joinGame/pickStartRegion/confirmEmpireColor), sikkerhetsregler, GitHub Actions, GeoJSON-pipeline (`public/geo/regions.geojson` ~1,7 MB), seed-script, kart-POC med faktiske regioner. Gjenstår: full seeding av kulturelle tagger til RTDB.
- **Fase 1 (~100% ferdig):** Bygge/høste-system (`pendingHarvest` per bygning), `macroTick` hver 10. min (produksjon, byggekø, integrering, satisfaction, populasjon), militær ekspansjon med UI (`ExpandButton`), NPC frivillig tilslutning (`attractivenessThreshold` + `runNpcDefectionForGame`), diplomatisk overtakelse (`attemptDiplomaticTakeover`) og økonomisk investering (`investInRegion`) med UI (`NpcInfluencePanel`).
- **Fase 2a (~70% ferdig):** `formNation` (≥70% kulturmatch) + `NationModal`, marked-callables + order-matching, diplomati-callables (allianser, notater) + `ChatPanel`, `DiplomacyForceGraph`. Gjenstår: UI-polish på `MarketScreen` og `DiplomacyForceGraph`.
- **Fase 2b (~80% ferdig):** Krig-callables + kamp-logikk (`war-logic.ts`) + `Unit`-type + `WarScreen` + `UnitDeployPanel`, daily combat loop integrert i `macroTick` (`runCombatForGame`). Gjenstår: UI-polish.
- **Fase 3 (delvis):** Forbund (`league.ts` callables + `LeaguePanel`) og FN (`un.ts` callables + `unClient`) er implementert. Gjenstår: hendelseskort.
- **Fase 4 (ikke begynt):** Læringsrapporter, mobiloptimalisering, Economic Hitman.

## Viktige avvik fra design.md (se §0 i IMPLEMENTATION_PLAN.md)

- Kulturmatch-terskel for nasjonsdanning: **70%** (ikke 60%)
- Empire-farge: bruker velger blant **6 ledige farger** ved `pickStartRegion` (atomisk reservasjon)
- Mikro-tikk er **fjernet** — kun server-skedulert makro-tikk hvert 10. min
- `pendingHarvest` per bygning (ikke aggregert produksjon per region)
- **Schema-versjonsbanner:** klient viser `SchemaVersionBanner` ved mismatch mellom `meta.schemaVersion` og klient-konstant — ikke nevnt i design.md

## Norsk bokmål

All UI-tekst, feilmeldinger fra Cloud Functions, og variabelnavn i domene-kode er på norsk bokmål. Cloud Function-svar returnerer alltid `{ ok, error?, melding? }` der `melding` er norsk.
