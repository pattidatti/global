/**
 * Playwright-script som spiller Geopolity automatisk.
 *
 * Forutsetninger:
 *   - Dev-server kjører: npm run dev
 *   (Kobler til produksjons-Firebase — ingen emulatorer nødvendig)
 *   (Sett VITE_USE_EMULATORS=true i .env for lokal emulering med Java)
 *
 * Kjøring: npm run play
 */

import { chromium, type Page } from 'playwright';
import { readFileSync } from 'fs';
import { join } from 'path';

const BASE_URL = process.env.GAME_URL ?? 'http://localhost:5173';

const GEO_DIR = join(import.meta.dirname, '..', 'public', 'geo');
const adjacency: Record<string, string[]> = JSON.parse(readFileSync(join(GEO_DIR, 'adjacency.json'), 'utf-8'));
// centroid er [lng, lat] (GeoJSON-konvensjon)
const regionsMeta: Record<string, { centroid: [number, number]; displayName: string }> =
  Object.fromEntries(
    Object.values(JSON.parse(readFileSync(join(GEO_DIR, 'regions-meta.json'), 'utf-8')) as Array<{
      regionId: string;
      displayName: string;
      centroid: [number, number];
    }>).map(r => [r.regionId, r]),
  );

// Hjelpefunksjoner for kartinteraksjon

// Klikker på lat/lng via window.__leafletMap (satt av DevMapExpose i MapView)
async function clickMapLatLng(page: Page, lat: number, lng: number): Promise<void> {
  const box = await page.locator('.leaflet-container').first().boundingBox();
  if (!box) return;

  const pt = await page.evaluate(([la, ln]) => {
    const map = (window as Window & { __leafletMap?: { latLngToContainerPoint(ll: [number, number]): { x: number; y: number } } }).__leafletMap;
    if (!map) return null;
    return map.latLngToContainerPoint([la, ln]);
  }, [lat, lng] as [number, number]);

  if (!pt) return;
  const x = box.x + Math.max(0, Math.min(pt.x, box.width - 1));
  const y = box.y + Math.max(0, Math.min(pt.y, box.height - 1));
  await page.mouse.click(x, y);
}

// Steg 1: Anonym innlogging

async function loginAnonymously(page: Page, label: string): Promise<void> {
  // Logg alle konsollfeil fra siden
  page.on('console', msg => {
    if (msg.type() === 'error') console.log(`  [browser error] ${msg.text()}`);
  });

  await page.goto(BASE_URL + '/');
  await page.waitForLoadState('networkidle', { timeout: 15_000 });

  // Screenshot for debugging
  await page.screenshot({ path: `scripts/debug-${label}-login.png` });
  console.log(`  (Screenshot: scripts/debug-${label}-login.png)`);

  const devBtn = page.locator('[data-testid="dev-login"]');
  if ((await devBtn.count()) === 0) {
    const html = await page.content();
    console.error(`  Fant ikke dev-login-knapp. Page title: "${await page.title()}"`);
    console.error(`  URL: ${page.url()}`);
    console.error(`  HTML snippet: ${html.slice(0, 500)}`);
    throw new Error('Dev-login-knapp mangler');
  }

  await devBtn.click();

  // Vent på enten /servers-navigasjon eller feilmelding
  try {
    await page.waitForURL('**/servers', { timeout: 20_000 });
    console.log(`✓ [${label}] Logget inn anonymt`);
  } catch {
    await page.screenshot({ path: `scripts/debug-${label}-after-click.png` });
    const url = page.url();
    const errText = await page.locator('[role="alert"]').textContent().catch(() => '(ingen feil vist)');
    console.error(`  Navigasjon til /servers feilet. URL: ${url}, Feil: ${errText}`);
    throw new Error('Innlogging mislyktes');
  }
}

// Steg 2: Lærer oppretter spill

async function createGame(page: Page): Promise<void> {
  await page.goto(BASE_URL + '/teacher');
  await page.waitForSelector('input[placeholder*="Navn på serveren"]', { timeout: 15_000 });
  await page.screenshot({ path: 'scripts/debug-teacher.png' });

  await page.fill('input[placeholder*="Navn på serveren"]', 'Playwright-test');
  await page.click('button:has-text("Opprett")');

  // Vent på enten suksess eller feilmelding
  try {
    await page.waitForSelector('text=Playwright-test', { timeout: 20_000 });
    console.log('✓ Spill opprettet: Playwright-test');
  } catch {
    await page.screenshot({ path: 'scripts/debug-teacher-after-create.png' });
    const errText = await page.locator('[role="alert"]').first().textContent().catch(() => '');
    const url = page.url();
    console.error(`  Spill-opprettelse feilet. URL: ${url}`);
    if (errText) console.error(`  Feilmelding fra UI: ${errText}`);
    // Vis hva som faktisk vises på siden
    const bodyText = await page.evaluate(() => document.body.innerText.slice(0, 800));
    console.error(`  Sideinnhold:\n${bodyText}`);
    throw new Error('Klarte ikke opprette spill');
  }
}

// Steg 3: Spiller blir med i spillet

async function joinGame(page: Page): Promise<void> {
  await page.goto(BASE_URL + '/servers');
  await page.waitForSelector('button:has-text("Bli med")', { timeout: 20_000 });
  await page.click('button:has-text("Bli med")');
  await page.waitForURL('**/pick', { timeout: 20_000 });
  console.log('✓ Ble med i spillet, er på region-velger');
}

// Steg 4: Velg startregion + farge

const REGION_CANDIDATES: Array<[number, number, string]> = [
  [62, 10, 'Norge'],
  [59, 18, 'Sverige'],
  [60, 25, 'Finland'],
  [52, 10, 'Tyskland'],
  [48, 14, 'Østerrike'],
  [46, 2,  'Frankrike'],
  [51, 4,  'Belgia'],
  [40, -4, 'Spania'],
  [52, 20, 'Polen'],
  [55, 37, 'Moskva-området'],
  [35, 33, 'Tyrkia'],
  [25, 45, 'Saudi-Arabia'],
  [35, 105,'Kina-sentrum'],
  [-15, -48,'Brasil-sentrum'],
];

async function pickStartRegion(page: Page): Promise<[number, number] | null> {
  await page.waitForSelector('.leaflet-container', { timeout: 20_000 });

  // Vent til GeoJSON er lastet (teksten "Laster kart" forsvinner)
  await page.waitForFunction(
    () => !Array.from(document.querySelectorAll('p'))
            .some(p => p.textContent?.includes('Laster kart')),
    { timeout: 40_000, polling: 500 },
  );
  await page.waitForTimeout(1500); // ekstra tid for Leaflet-rendering

  await page.screenshot({ path: 'scripts/debug-pick-loaded.png' });
  console.log('  Kart lastet. Screenshot: scripts/debug-pick-loaded.png');

  // PickRegion bruker SVG-renderer — klikk direkte på SVG paths
  const pathCount = await page.evaluate(() => document.querySelectorAll('svg path').length);
  console.log(`  SVG paths funnet: ${pathCount}`);

  // Prøv å klikke på de første 30 paths som er store nok
  const paths = page.locator('svg path');
  const total = await paths.count();
  console.log(`  Prøver å klikke på SVG paths (${total} totalt)…`);

  for (let i = 0; i < Math.min(total, 60); i += 2) {
    const path = paths.nth(i);
    const box = await path.boundingBox().catch(() => null);
    if (!box || box.width < 10 || box.height < 10) continue; // hopp over mikroskopiske

    await path.click({ force: true }).catch(() => null);
    await page.waitForTimeout(600);

    const hasColorPicker = (await page.locator('button:has-text("Plant fanen")').count()) > 0;
    if (!hasColorPicker) continue;

    // Finn regionens omtrentlige koordinater fra kart
    const pathCenter = { lat: 0, lng: 0 };
    console.log(`✓ Region valgt via path #${i} (ca. ${JSON.stringify(pathCenter)})`);

    // Velg første tilgjengelige farge
    const colorBtns = page.locator('[aria-label*="Pigment"]');
    if ((await colorBtns.count()) > 0) {
      await colorBtns.first().click();
      await page.waitForTimeout(400);
    }

    await page.click('button:has-text("Plant fanen")');
    await page.waitForURL('**/game', { timeout: 25_000 });
    console.log('✓ Fane plantet. Navigerer til spillet.');

    // Kart-senteret hentes etter at Game-skjermen laster (se expansionLoop)
    return [20, 0]; // placeholder — oppdateres i expansionLoop
  }

  await page.screenshot({ path: 'scripts/debug-pick-failed.png' });
  console.error('✗ Ingen region kunne velges. (debug-pick-failed.png)');
  return null;
}

// Hjelp: les spillerens nåværende ressurser via eksponert store

interface PlayerResources {
  regionCount: number;
  military: number;
  treasury: number;
}

async function readResources(page: Page): Promise<PlayerResources> {
  return page.evaluate(() => {
    const store = (window as Window & { __gameStore?: { getState: () => Record<string, unknown> } }).__gameStore;
    if (!store) return { regionCount: 0, military: 0, treasury: 0 };
    const state = store.getState() as {
      slotId: string;
      players: Record<string, { military: number; treasury: number; regionIds: string[] }>;
    };
    const p = state?.players?.[state?.slotId];
    return {
      regionCount: p?.regionIds?.length ?? 0,
      military:    Math.floor(p?.military  ?? 0),
      treasury:    Math.floor(p?.treasury  ?? 0),
    };
  });
}

// Steg 5: Ekspanderingssløyfe

const EXPAND_MILITARY_COST = 25;
const INVEST_COST = 50;

async function tryExpandAt(
  page: Page, lat: number, lng: number,
  currentMilitary: number, currentTreasury: number,
): Promise<'expanded' | 'invested' | 'none'> {
  // Pan instantly (no animation) to the region centroid so click lands correctly
  await page.evaluate(([la, ln]) => {
    const map = (window as Window & { __leafletMap?: {
      setView(ll: [number, number], z: number, opts?: Record<string, unknown>): void
    } }).__leafletMap;
    if (map) map.setView([la, ln], 5, { animate: false });
  }, [lat, lng] as [number, number]);
  await page.waitForTimeout(400);

  // Use latLngToContainerPoint for precise pixel position
  await clickMapLatLng(page, lat, lng);
  await page.waitForTimeout(800);

  // Only attempt military expansion when we actually have enough troops
  if (currentMilitary >= EXPAND_MILITARY_COST) {
    const expandBtn = page.locator('button:has-text("Ekspander hit")').first();
    if ((await expandBtn.count()) > 0 && !(await expandBtn.isDisabled())) {
      await expandBtn.click();
      await page.waitForTimeout(2500);
      return 'expanded';
    }
  }

  // Invest only when we have enough treasury
  if (currentTreasury >= INVEST_COST) {
    const investBtn = page.locator('button:has-text("Invester")').first();
    if ((await investBtn.count()) > 0 && !(await investBtn.isDisabled())) {
      await investBtn.click();
      await page.waitForTimeout(2500);
      return 'invested';
    }
  }

  return 'none';
}

async function debugGameState(page: Page, label: string): Promise<void> {
  await page.screenshot({ path: `scripts/debug-game-${label}.png` });
  const selectedRegion = await page.evaluate(() => {
    const store = (window as Window & { __gameStore?: { getState: () => { selectedRegionId: string | null } } }).__gameStore;
    return store?.getState().selectedRegionId ?? null;
  });
  const hasExpand = (await page.locator('button:has-text("Ekspander hit")').count()) > 0;
  const hasInvest = (await page.locator('button:has-text("Invester")').count()) > 0;
  const mapBox = await page.locator('.leaflet-container').first().boundingBox();
  console.log(`  [${label}] selected=${selectedRegion} expandBtn=${hasExpand} investBtn=${hasInvest} mapBox=${JSON.stringify(mapBox)}`);
}

async function triggerTick(page: Page): Promise<boolean> {
  const triggered = await page.evaluate(async () => {
    const store = (window as Window & {
      __gameStore?: { getState: () => { gameId: string | null } };
      __triggerDevTick?: (gameId: string) => Promise<void>;
    });
    const gameId = store.__gameStore?.getState().gameId;
    const trigger = store.__triggerDevTick;
    if (!gameId || !trigger) return false;
    await trigger(gameId);
    return true;
  });
  return triggered;
}

async function getMyRegionIds(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const store = (window as Window & { __gameStore?: { getState: () => {
      slotId: string; players: Record<string, { regionIds: string[] }> } } }).__gameStore;
    const state = store?.getState();
    return state?.players?.[state.slotId]?.regionIds ?? [];
  });
}

async function getMapCenter(page: Page): Promise<[number, number]> {
  // Vent til DevMapExpose setter window.__leafletMap (via MapView)
  await page.waitForFunction(
    () => !!(window as Window & { __leafletMap?: unknown }).__leafletMap,
    { timeout: 15_000, polling: 300 },
  ).catch(() => null);

  const center = await page.evaluate(() => {
    const map = (window as Window & { __leafletMap?: { getCenter(): { lat: number; lng: number } } }).__leafletMap;
    return map ? map.getCenter() : null;
  });

  if (center) {
    console.log(`  Kart-senter: [${center.lat.toFixed(1)}, ${center.lng.toFixed(1)}]`);
    return [center.lat, center.lng];
  }
  return [20, 0];
}

async function expansionLoop(page: Page, _startLat: number, _startLng: number): Promise<void> {
  await page.waitForTimeout(4000);
  await getMapCenter(page); // logging

  let totalExpansions = 0;
  let noNewRegions = 0;

  await debugGameState(page, 'init');
  const initial = await readResources(page);
  console.log(`\n   Startressurser → ${initial.regionCount} region(er) | ⚔️ ${initial.military} | 💰 ${initial.treasury}`);

  while (noNewRegions < 2) {
    const myRegionIds = await getMyRegionIds(page);
    if (myRegionIds.length === 0) {
      console.log('   Ingen regioner i store ennå, venter…');
      await page.waitForTimeout(2000);
      continue;
    }

    // Finn alle naboregiioner som vi ikke eier
    const neighborSet = new Set<string>();
    for (const rid of myRegionIds) {
      for (const n of (adjacency[rid] ?? [])) {
        if (!myRegionIds.includes(n)) neighborSet.add(n);
      }
    }

    const neighbors = [...neighborSet];
    if (neighbors.length === 0) { console.log('   Ingen naboer igjen å ekspandere til!'); break; }
    console.log(`\n   Mine regioner: ${myRegionIds.length} | Prøver ${neighbors.length} naboer…`);

    let roundExpansions = 0;

    for (const neighborId of neighbors) {
      const res = await readResources(page);
      if (res.military < EXPAND_MILITARY_COST && res.treasury < INVEST_COST) {
        console.log('\n⚠️  Ressurser oppbrukt. Stopper.'); break;
      }

      const meta = regionsMeta[neighborId];
      if (!meta) continue;
      const [lng, lat] = meta.centroid; // GeoJSON: [lng, lat]

      console.log(`   → Klikker på ${meta.displayName} [lat=${lat.toFixed(1)}, lng=${lng.toFixed(1)}]`);
      const beforeCount = res.regionCount;
      const result = await tryExpandAt(page, lat, lng, res.military, res.treasury);
      if (result === 'none') {
        await debugGameState(page, neighborId.slice(0, 20));
      } else {
        const res2 = await readResources(page);
        const gained = res2.regionCount > beforeCount;
        if (gained) {
          roundExpansions++;
          totalExpansions++;
          console.log(`   ✓ ${meta.displayName} → ${res2.regionCount} reg | ⚔️ ${res2.military} | 💰 ${res2.treasury}`);
        } else {
          // invest or failed expand — log but don't count as region gain
          const verb = result === 'invested' ? 'Investerte i' : 'Prøvde';
          console.log(`   · ${verb} ${meta.displayName} | ⚔️ ${res2.military} | 💰 ${res2.treasury}`);
        }
      }
    }

    if (roundExpansions === 0) {
      noNewRegions++;
      console.log(`   (Ingen nye regioner denne runden, ${noNewRegions}/2)`);
    } else {
      noNewRegions = 0;
    }
  }

  // Trigger dev tick to apply diplomatic takeovers immediately
  console.log('\n⏩ Trigge macroTick for å se diplomatiske overtakelser…');
  const ticked = await triggerTick(page);
  if (ticked) {
    await page.waitForTimeout(5000); // vent på RTDB-propagasjon
    const afterTick = await readResources(page);
    if (afterTick.regionCount > totalExpansions + 1) {
      const gained = afterTick.regionCount - (totalExpansions + 1);
      totalExpansions += gained;
      console.log(`   ✓ Tick ferdig → ${afterTick.regionCount} regioner (${gained} diplomatiske overtakelser)`);
    } else {
      console.log(`   · Tick ferdig — ingen nye overtakelser ennå (satisfaction kan trenge flere investeringer)`);
    }
  } else {
    console.log('   · __triggerDevTick ikke tilgjengelig — deploy functions med TICK_DEV_ENABLED=true');
  }

  const final = await readResources(page);
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`🏆 Resultat: ${final.regionCount} region(er) totalt`);
  console.log(`   Ekspanderinger utført: ${totalExpansions}`);
  console.log(`   Gjenværende ressurser: ⚔️ ${final.military} militær | 💰 ${final.treasury} kr`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
}

// Hovedprogram

async function main() {
  console.log('🎮 Geopolity Playwright-spiller starter…\n');
  console.log('   Kobler til produksjons-Firebase med anonym auth.');
  console.log('   Spillet som opprettes slettes etterpå fra lærerpanelet.\n');

  const browser = await chromium.launch({ headless: true });

  try {
    // Lærer-kontekst: oppretter spill
    console.log('─── STEG 1/5: Oppretter spill som lærer ─────────');
    const teacherCtx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const teacherPage = await teacherCtx.newPage();
    await loginAnonymously(teacherPage, 'Lærer');
    await createGame(teacherPage);

    // Spiller-kontekst: eget nettleservindu, separat anonym bruker
    console.log('\n─── STEG 2/5: Logger inn som spiller ────────────');
    const playerCtx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const playerPage = await playerCtx.newPage();
    await loginAnonymously(playerPage, 'Spiller');

    console.log('\n─── STEG 3/5: Blir med i spillet ────────────────');
    await joinGame(playerPage);

    console.log('\n─── STEG 4/5: Velger startregion + farge ────────');
    const startCoords = await pickStartRegion(playerPage);
    if (!startCoords) {
      console.error('Avslutter: kunne ikke velge startregion.');
      return;
    }

    // La spillet-skjermen laste ferdig
    await playerPage.waitForTimeout(3000);

    console.log('\n─── STEG 5/5: Ekspanderer territorium ──────────');
    await expansionLoop(playerPage, startCoords[0], startCoords[1]);

    // Lagre skjermbilde av sluttresultatet
    await playerPage.screenshot({ path: 'scripts/play-result.png' });
    console.log('\n📸 Sluttbilde lagret → scripts/play-result.png');

    // Hold nettleseren åpen et øyeblikk så vi kan se resultatet
    console.log('   Lukker nettleser om 20 sekunder…');
    await playerPage.waitForTimeout(20_000);

  } finally {
    await browser.close();
  }
}

main().catch(e => {
  console.error('\n💥 Feil:', e);
  process.exit(1);
});
