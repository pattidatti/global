/**
 * Geopolity UX Playtest
 *
 * Systematisk gjennomgang av spillets brukeropplevelse:
 * - Flow fra login → server-liste → pick-region → spill
 * - Alle 5 spillskjermer (Kart, Marked, Militær, Diplomati, Hendelser)
 * - NPC-interaksjon og ressursvisning
 *
 * Krav: npm run dev kjøres parallelt (http://localhost:5173)
 * Screenshots lagres i e2e/screenshots/ og Playwright HTML-rapport i e2e/report/
 */

import { test, expect, type Page } from 'playwright/test';
import * as path from 'path';
import * as fs from 'fs';

const SS_DIR = path.join(process.cwd(), 'e2e', 'screenshots');

function ss(name: string) {
  return path.join(SS_DIR, `${name}.png`);
}

function log(step: string, msg: string) {
  console.log(`\n[UX ${step}] ${msg}`);
}

// ─── Koordinater for Leaflet-kart (zoom 3, center [20, 0]) ─────────────────
// Viewport: 1280×800, kart-header: ~56px
// Beregnet fra Mercator-projeksjon:
const MAP_CLICKS = {
  pickRegion: [
    { x: 698, y: 207, label: 'Tyskland' },
    { x: 651, y: 250, label: 'Frankrike' },
    { x: 623, y: 296, label: 'Spania' },
    { x: 754, y: 545, label: 'Sentralafrika' },
    { x: 820, y: 230, label: 'Polen/Ukraina' },
    { x: 900, y: 200, label: 'Russland/vest' },
  ],
  gameMap: [
    { x: 698, y: 350, label: 'Europa (spill-kart)' },
    { x: 780, y: 380, label: 'Øst-Europa' },
    { x: 640, y: 420, label: 'Vestlige regioner' },
  ],
};

// ─── Delt page-instans på tvers av serielle tester ─────────────────────────
let page: Page;

test.describe.serial('Geopolity UX Playtest', () => {
  test.beforeAll(async ({ browser }) => {
    fs.mkdirSync(SS_DIR, { recursive: true });
    const ctx = await browser.newContext({
      viewport: { width: 1280, height: 800 },
      locale: 'nb-NO',
    });
    page = await ctx.newPage();
    page.on('console', msg => {
      if (msg.type() === 'error') console.log('[browser-error]', msg.text());
    });
  });

  test.afterAll(async () => {
    await page.context().close();
  });

  // ─── 01: Login-skjerm ─────────────────────────────────────────────────────

  test('01 — Login-skjerm: visuell design og elementer', async () => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(800); // La animasjoner starte
    await page.screenshot({ path: ss('01-login-landing'), fullPage: false });

    await expect(page.getByRole('heading', { name: /Geopolity/i })).toBeVisible();

    const devBtn = page.getByTestId('dev-login');
    await expect(devBtn).toBeVisible();

    const googleBtn = page.getByRole('button', { name: /Logg inn med Google/i });
    const googleVisible = await googleBtn.isVisible().catch(() => false);

    const teacherLink = page.getByRole('link', { name: /lærer/i });
    const teacherVisible = await teacherLink.isVisible().catch(() => false);

    log('01', [
      '✅ Heading "Geopolity" synlig',
      `✅ Dev-login knapp synlig`,
      `${googleVisible ? '✅' : '⚠️'} Google-login knapp ${googleVisible ? 'synlig' : 'ikke funnet'}`,
      `${teacherVisible ? '✅' : '⚠️'} Lærer-lenke ${teacherVisible ? 'synlig' : 'ikke funnet'}`,
    ].join('\n      '));
  });

  // ─── 02: Dev-login → server-liste ─────────────────────────────────────────

  test('02 — Dev-login → server-liste', async () => {
    await page.getByTestId('dev-login').click();
    await page.waitForURL(/\/servers/, { timeout: 15_000 });
    await page.waitForTimeout(2500); // La Firebase-subscriptions laste

    await page.screenshot({ path: ss('02-server-liste'), fullPage: false });

    const main = page.getByRole('main', { name: 'Spillservere' });
    await expect(main).toBeVisible();

    const joinBtns = page.locator('button:has-text("Bli med"), button:has-text("Fortsett")');
    const gameCount = await joinBtns.count();

    const hasTitle = await page.locator('h1, h2').first().isVisible();

    log('02', [
      `${gameCount > 0 ? '✅' : '⚠️'} Antall spill i listen: ${gameCount}`,
      `${hasTitle ? '✅' : '⚠️'} Sidehode synlig`,
      gameCount === 0 ? '⚠️ Tom server-liste — sjekk tomt-tilstand UX' : '',
    ].filter(Boolean).join('\n      '));
  });

  // ─── 03: Bli med i spill ──────────────────────────────────────────────────

  test('03 — Bli med i spill: feedback og navigasjon', async () => {
    const joinBtn = page.locator('button:has-text("Bli med"), button:has-text("Fortsett")').first();
    const hasGame = await joinBtn.isVisible().catch(() => false);

    if (!hasGame) {
      log('03', '⚠️ Ingen spill tilgjengelig — test avbrutt');
      test.skip();
    }

    await joinBtn.click();

    // Sjekk om loader / "Kobler til" vises
    const joiningText = page.locator('text=Kobler til');
    const joiningVisible = await joiningText.isVisible().catch(() => false);

    await page.screenshot({ path: ss('03-joining-feedback'), fullPage: false });

    await page.waitForURL(/\/(pick|game)/, { timeout: 20_000 });
    const dest = page.url().includes('/pick') ? '/pick (region ikke valgt)' : '/game (allerede i spill)';

    await page.screenshot({ path: ss('03-after-join'), fullPage: false });

    log('03', [
      `${joiningVisible ? '✅' : '⚠️'} Loader-feedback under join: ${joiningVisible ? 'synlig' : 'IKKE synlig'}`,
      `✅ Navigerte til: ${dest}`,
    ].join('\n      '));
  });

  // ─── 04: PickRegion — kart ────────────────────────────────────────────────

  test('04 — PickRegion: kart og instruksjoner', async () => {
    if (!page.url().includes('/pick')) {
      log('04', 'Hopper over — allerede i spill');
      return;
    }

    // Vent på at GeoJSON laster (~1.7MB)
    await page.waitForSelector('p:has-text("Klikk på en tilgjengelig region")', { timeout: 30_000 });
    await page.screenshot({ path: ss('04-pick-region-loaded'), fullPage: false });

    const heading = page.getByRole('heading', { name: /Velg din startregion/i });
    const mapContainer = page.locator('.leaflet-container');

    const headingVisible = await heading.isVisible().catch(() => false);
    const mapVisible = await mapContainer.isVisible().catch(() => false);

    log('04', [
      `${headingVisible ? '✅' : '⚠️'} Overskrift "Velg din startregion" synlig`,
      `${mapVisible ? '✅' : '⚠️'} Leaflet-kart synlig`,
      '✅ Instruksjonstekst lastet',
    ].join('\n      '));
  });

  // ─── 05: PickRegion — klikk region ───────────────────────────────────────

  test('05 — PickRegion: klikk på region → fargevelger', async () => {
    if (!page.url().includes('/pick')) {
      log('05', 'Hopper over — allerede i spill');
      return;
    }

    // Kartet er allerede lastet fra test 04 — vent litt for canvas-rendering
    await page.waitForSelector('.leaflet-container', { state: 'visible', timeout: 10_000 });
    await page.waitForTimeout(2000); // La canvas rendere regioner

    let regionPicked = false;
    for (const pos of MAP_CLICKS.pickRegion) {
      await page.mouse.click(pos.x, pos.y);
      try {
        await page.waitForSelector('[role="dialog"][aria-label="Velg imperiumfarge"]', {
          timeout: 8_000,
        });
        regionPicked = true;
        await page.screenshot({ path: ss('05-color-picker-open'), fullPage: false });
        log('05', `✅ Region klikket ved (${pos.x}, ${pos.y}) — "${pos.label}" — fargevelger åpnet`);
        break;
      } catch {
        // Prøv neste posisjon
      }
    }

    if (!regionPicked) {
      await page.screenshot({ path: ss('05-no-region-click'), fullPage: false });
      log('05', [
        '⚠️ Ingen region ble klikket — prøvde 6 posisjoner',
        '   Mulig årsak: canvas-renderer eller alle regioner tatt',
        '   Sjekker etter feilmelding...',
      ].join('\n      '));

      const errMsg = await page.locator('[role="alert"]').textContent().catch(() => null);
      if (errMsg) log('05', `   Feilmelding: "${errMsg}"`);
    }
  });

  // ─── 06: PickRegion — velg farge + naviger til spill ───────────────────────

  test('06 — PickRegion: velg farge og gå inn i spill', async () => {
    if (!page.url().includes('/pick')) {
      log('06', 'Hopper over — allerede i spill');
      return;
    }

    const dialog = page.getByRole('dialog', { name: 'Velg imperiumfarge' });
    const dialogVisible = await dialog.isVisible().catch(() => false);

    let pigmentCount = 0;
    let confirmedViaFunction = false;

    if (dialogVisible) {
      const pigmentBtns = page.locator('[aria-label^="Pigment"]');
      pigmentCount = await pigmentBtns.count();

      // Velg første farge
      await pigmentBtns.first().click();
      await page.screenshot({ path: ss('06-color-selected'), fullPage: false });

      const confirmBtn = page.getByText('Plant fanen');
      await expect(confirmBtn).toBeEnabled({ timeout: 5_000 });
      await confirmBtn.click();

      await page.screenshot({ path: ss('06-confirming'), fullPage: false });

      // Vent kort på Cloud Function (15s) — men blokker ikke testen
      try {
        await page.waitForURL(/\/game/, { timeout: 15_000 });
        confirmedViaFunction = true;
      } catch {
        const errMsg = await page.locator('[role="alert"], .text-danger').textContent().catch(() => null);
        log('06', `confirmEmpireColor ikke ferdig/feilet: "${errMsg ?? 'ukjent'}" — navigerer manuelt til /game`);
      }
    } else {
      log('06', '⚠️ Fargevelger ikke synlig — hopper over farge-steg');
    }

    // Naviger til /game uansett — Game.tsx krever bare gameId+slotId i store
    if (!page.url().includes('/game')) {
      await page.goto('/game');
    }

    // Vent på at spillet laster
    await page.waitForSelector('[aria-label="Hovednavigasjon"]', { timeout: 20_000 });
    await page.waitForTimeout(3000);
    await page.screenshot({ path: ss('06-game-entered'), fullPage: false });

    const finalUrl = page.url();
    log('06', [
      `${pigmentCount > 0 ? '✅' : '⚠️'} Fargevelger: ${pigmentCount} farger`,
      `${confirmedViaFunction ? '✅' : '⚠️'} confirmEmpireColor: ${confirmedViaFunction ? 'suksess' : 'bypass/feilet'}`,
      `${finalUrl.includes('/game') ? '✅' : '⚠️'} Navigert til: ${finalUrl}`,
    ].join('\n      '));
  });

  // ─── 07: Kart-skjerm ──────────────────────────────────────────────────────

  test('07 — Kart-skjerm: oversikt og ressurser', async () => {
    if (!page.url().includes('/game')) {
      log('07', '⚠️ Ikke i spill — hopper over');
      return;
    }

    await page.waitForTimeout(3000); // La game-state laste fra Firebase
    await page.screenshot({ path: ss('07-kart-full'), fullPage: false });

    const nav = page.getByLabel('Hovednavigasjon');
    const resources = page.getByLabel('Ressursoversikt');
    const leaflet = page.locator('.leaflet-container');

    const navOk = await nav.isVisible().catch(() => false);
    const resOk = await resources.isVisible().catch(() => false);
    const mapOk = await leaflet.isVisible().catch(() => false);

    // Sjekk TopBar for ressursverdier
    const topbarText = await page.locator('[aria-label="Ressursoversikt"]').textContent().catch(() => '');

    // Sjekk om NPC-knapper er synlige
    const expandBtns = await page.locator('[aria-label^="Ekspander til region"]').count();
    const investBtns = await page.locator('[aria-label^="Invester"]').count().catch(() => 0);

    log('07', [
      `${navOk ? '✅' : '⚠️'} BottomNav synlig`,
      `${resOk ? '✅' : '⚠️'} Ressursoversikt synlig`,
      `${mapOk ? '✅' : '⚠️'} Leaflet-kart synlig`,
      `TopBar tekst: "${topbarText?.substring(0, 80) ?? 'ikke funnet'}"`,
      `Ekspander-knapper synlig: ${expandBtns}`,
      `Invester-knapper synlig: ${investBtns}`,
    ].join('\n      '));
  });

  // ─── 08: Velg region på kart ──────────────────────────────────────────────

  test('08 — Kart: klikk region for å se KontekstPanel', async () => {
    if (!page.url().includes('/game')) return;

    // Klikk på et sted på kartet for å velge en region
    for (const pos of MAP_CLICKS.gameMap) {
      await page.mouse.click(pos.x, pos.y);
      await page.waitForTimeout(1200);

      const panel = page.locator('[class*="KontekstPanel"], [class*="kontekst"], h3, h4').first();
      const panelVisible = await panel.isVisible().catch(() => false);
      if (panelVisible) {
        await page.screenshot({ path: ss('08-region-info-panel'), fullPage: false });
        const panelText = await panel.textContent().catch(() => '');
        log('08', `✅ Panel åpnet ved (${pos.x}, ${pos.y}): "${panelText?.substring(0, 60) ?? ''}"`);
        break;
      }
    }

    // Sjekk etter ekspansjonsknapper
    await page.screenshot({ path: ss('08-kart-med-region'), fullPage: false });
    const expandBtns = await page.locator('[aria-label^="Ekspander til region"]').count();
    log('08', `Ekspansjonsknapper etter region-klikk: ${expandBtns}`);
  });

  // ─── 09: Marked-skjerm ────────────────────────────────────────────────────

  test('09 — Marked-skjerm: handel og priser', async () => {
    if (!page.url().includes('/game')) return;

    await page.getByRole('button', { name: 'Marked', exact: true }).click();
    await page.waitForTimeout(1500);
    await page.screenshot({ path: ss('09-marked-full'), fullPage: false });

    // Sjekk for ressurstabell og ordre-liste
    const hasTable = await page.locator('table, [role="table"]').first().isVisible().catch(() => false);
    const hasPrices = await page.locator('text=/[0-9]+ 🪙|pris|Kjøp|Selg/i').first().isVisible().catch(() => false);
    const hasBuyBtn = await page.locator('button:has-text("Kjøp"), button:has-text("Selg"), button:has-text("Legg inn ordre")').first().isVisible().catch(() => false);

    log('09', [
      `${hasTable ? '✅' : '⚠️'} Ressurstabell/data synlig`,
      `${hasPrices ? '✅' : '⚠️'} Prisinformasjon synlig`,
      `${hasBuyBtn ? '✅' : '⚠️'} Kjøp/salg-knapper synlig`,
    ].join('\n      '));
  });

  // ─── 10: Militær-skjerm ───────────────────────────────────────────────────

  test('10 — Militær-skjerm: krig og enheter', async () => {
    if (!page.url().includes('/game')) return;

    await page.getByRole('button', { name: 'Militær', exact: true }).click();
    await page.waitForTimeout(1500);
    await page.screenshot({ path: ss('10-milita-r-full'), fullPage: false });

    const hasDeclareBtn = await page.locator('button:has-text("Erklær"), button:has-text("krig")').first().isVisible().catch(() => false);
    const hasWarList = await page.locator('text=/Aktive kriger|Ingen aktive kriger|krig/i').first().isVisible().catch(() => false);
    const hasUnits = await page.locator('text=/Infanteri|Pansret|Marinestyrke|enheter/i').first().isVisible().catch(() => false);

    log('10', [
      `${hasDeclareBtn ? '✅' : '⚠️'} "Erklær krig"-knapp synlig`,
      `${hasWarList ? '✅' : '⚠️'} Krig-liste eller tom-tilstand synlig`,
      `${hasUnits ? '✅' : '⚠️'} Enhets-info synlig`,
    ].join('\n      '));
  });

  // ─── 11: Diplomati-skjerm ─────────────────────────────────────────────────

  test('11 — Diplomati-skjerm: allianser og chat', async () => {
    if (!page.url().includes('/game')) return;

    await page.getByRole('button', { name: 'Diplomati', exact: true }).click();
    await page.waitForTimeout(2000); // Force-graph kan ta litt tid
    await page.screenshot({ path: ss('11-diplomati-full'), fullPage: false });

    const hasGraph = await page.locator('canvas').first().isVisible().catch(() => false);
    const hasChat = await page.locator('input[type="text"], textarea').first().isVisible().catch(() => false);
    const hasAllianceSection = await page.locator('text=/Allianse|Nøytral|Diplomat/i').first().isVisible().catch(() => false);

    log('11', [
      `${hasGraph ? '✅' : '⚠️'} Force-graph (canvas) synlig`,
      `${hasChat ? '✅' : '⚠️'} Chat-input synlig`,
      `${hasAllianceSection ? '✅' : '⚠️'} Allianse-seksjon synlig`,
    ].join('\n      '));
  });

  // ─── 12: Hendelser-skjerm ─────────────────────────────────────────────────

  test('12 — Hendelser-skjerm: tidslinje og rangering', async () => {
    if (!page.url().includes('/game')) return;

    await page.getByRole('button', { name: 'Hendelser', exact: true }).click();
    await page.waitForTimeout(1500);
    await page.screenshot({ path: ss('12-hendelser-full'), fullPage: false });

    const hasEvents = await page.locator('text=/hendelse|krig|allianse|nasjon|tilbake/i').first().isVisible().catch(() => false);
    const hasRanking = await page.locator('text=/rangering|regioner|spillere|poeng/i').first().isVisible().catch(() => false);

    log('12', [
      `${hasEvents ? '✅' : '⚠️'} Hendelsesinnhold synlig`,
      `${hasRanking ? '✅' : '⚠️'} Rangeringsseksjon synlig`,
    ].join('\n      '));
  });

  // ─── 13: NPC-region interaksjon ───────────────────────────────────────────

  test('13 — NPC-region: ekspansjon, investering, diplomati', async () => {
    if (!page.url().includes('/game')) return;

    // Gå tilbake til kart
    await page.getByRole('button', { name: 'Kart', exact: true }).click();
    await page.waitForTimeout(1500);

    // Sjekk om det finnes NPC-knapper på kartet eller i region-panel
    const expandBtns = page.locator('[aria-label^="Ekspander til region"]');
    const investBtns = page.locator('[aria-label^="Invester i region"]');
    const dipBtns = page.locator('[aria-label^="Diplomatisk overtakelse"]');

    const expandCount = await expandBtns.count();
    const investCount = await investBtns.count();
    const dipCount = await dipBtns.count();

    if (expandCount > 0) {
      // Les aria-label for å se kostnadsinfo
      const firstLabel = await expandBtns.first().getAttribute('aria-label');
      await expandBtns.first().hover();
      await page.waitForTimeout(500);
      await page.screenshot({ path: ss('13-expand-btn-hover'), fullPage: false });
      log('13', `✅ Ekspander-knapp funnet: "${firstLabel}"`);
    } else {
      log('13', '⚠️ Ingen ekspansjonsknapper synlig — velg en NPC-naboregion på kartet');
    }

    log('13', [
      `Ekspander-knapper: ${expandCount}`,
      `Invester-knapper: ${investCount}`,
      `Diplomatisk-knapper: ${dipCount}`,
    ].join('\n      '));

    await page.screenshot({ path: ss('13-npc-interaksjon'), fullPage: false });
  });

  // ─── 14: Ressursfeedback og TopBar ────────────────────────────────────────

  test('14 — TopBar: ressurser og tilbakemelding', async () => {
    if (!page.url().includes('/game')) return;

    // Sørg for at vi er på kartet
    const currentTab = await page.locator('[aria-current="page"]').textContent().catch(() => '');
    if (!currentTab?.includes('Kart')) {
      await page.getByRole('button', { name: 'Kart', exact: true }).click();
      await page.waitForTimeout(1000);
    }

    await page.screenshot({ path: ss('14-topbar-ressurser'), fullPage: false });

    const topbar = page.getByLabel('Ressursoversikt');
    const maintenanceInfo = page.locator('[aria-label^="Vedlikehold trukket"]');

    const topbarVisible = await topbar.isVisible().catch(() => false);
    const maintenanceVisible = await maintenanceInfo.isVisible().catch(() => false);
    const topbarText = await topbar.textContent().catch(() => '');

    // Sjekk Zustand-state for ressursverdier
    const storeState = await page.evaluate(() => {
      const store = (window as unknown as { __gameStore?: { getState: () => Record<string, unknown> } }).__gameStore;
      if (!store) return null;
      const s = store.getState() as {
        players?: Record<string, { treasury?: number; military?: number }>;
        slotId?: string;
      };
      const { players, slotId } = s;
      const me = slotId && players ? players[slotId] : null;
      return me ? { treasury: me.treasury, military: me.military } : null;
    });

    log('14', [
      `${topbarVisible ? '✅' : '⚠️'} Ressursoversikt synlig`,
      `${maintenanceVisible ? '✅' : '⚠️'} Vedlikeholdskostnad info synlig`,
      `TopBar tekst: "${topbarText?.substring(0, 100) ?? ''}"`,
      storeState ? `Store: treasury=${storeState.treasury}, military=${storeState.military}` : '⚠️ Store ikke tilgjengelig',
    ].join('\n      '));
  });

  // ─── 15: Responsivitet og layout-sjekk ────────────────────────────────────

  test('15 — Mobilvisning: layout ved 390×844', async () => {
    if (!page.url().includes('/game')) return;

    // Endre viewport til mobil
    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForTimeout(800);
    await page.screenshot({ path: ss('15-mobil-kart'), fullPage: false });

    await page.getByRole('button', { name: 'Marked', exact: true }).click();
    await page.waitForTimeout(800);
    await page.screenshot({ path: ss('15-mobil-marked'), fullPage: false });

    await page.getByRole('button', { name: 'Hendelser', exact: true }).click();
    await page.waitForTimeout(800);
    await page.screenshot({ path: ss('15-mobil-hendelser'), fullPage: false });

    log('15', '📱 Mobilvisning screenshottet (390×844)');

    // Tilbake til desktop
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.getByRole('button', { name: 'Kart', exact: true }).click();
  });

  // ─── 16: Final summary screenshot ─────────────────────────────────────────

  test('16 — Avsluttende oversiktsskjermbilde', async () => {
    if (!page.url().includes('/game')) {
      await page.screenshot({ path: ss('16-final'), fullPage: false });
      return;
    }

    await page.getByRole('button', { name: 'Kart', exact: true }).click();
    await page.waitForTimeout(2000);
    await page.screenshot({ path: ss('16-final-kart'), fullPage: false });

    const allScreens: Array<{ label: string; tab: string; file: string }> = [
      { label: 'Marked',     tab: 'Marked',     file: '16-final-marked'     },
      { label: 'Militær',    tab: 'Militær',    file: '16-final-militaer'   },
      { label: 'Diplomati',  tab: 'Diplomati',  file: '16-final-diplomati'  },
      { label: 'Hendelser',  tab: 'Hendelser',  file: '16-final-hendelser'  },
    ];

    for (const s of allScreens) {
      await page.getByLabel(s.label).click();
      await page.waitForTimeout(800);
      await page.screenshot({ path: ss(s.file), fullPage: false });
    }

    log('16', '✅ Alle skjermer screenshottet for sammenligning');
    log('DONE', `\nScreenshots lagret i: ${SS_DIR}\nKjør: npx playwright show-report e2e/report`);
  });
});
