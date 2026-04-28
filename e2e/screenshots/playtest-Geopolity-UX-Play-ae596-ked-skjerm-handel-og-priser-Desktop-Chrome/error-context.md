# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: playtest.spec.ts >> Geopolity UX Playtest >> 09 — Marked-skjerm: handel og priser
- Location: e2e/playtest.spec.ts:335:3

# Error details

```
TimeoutError: locator.click: Timeout 30000ms exceeded.
Call log:
  - waiting for getByRole('button', { name: 'Marked', exact: true })

```

# Test source

```ts
  238 | 
  239 |       await page.screenshot({ path: ss('06-confirming'), fullPage: false });
  240 | 
  241 |       // Vent kort på Cloud Function (15s) — men blokker ikke testen
  242 |       try {
  243 |         await page.waitForURL(/\/game/, { timeout: 15_000 });
  244 |         confirmedViaFunction = true;
  245 |       } catch {
  246 |         const errMsg = await page.locator('[role="alert"], .text-danger').textContent().catch(() => null);
  247 |         log('06', `confirmEmpireColor ikke ferdig/feilet: "${errMsg ?? 'ukjent'}" — navigerer manuelt til /game`);
  248 |       }
  249 |     } else {
  250 |       log('06', '⚠️ Fargevelger ikke synlig — hopper over farge-steg');
  251 |     }
  252 | 
  253 |     // Naviger til /game uansett — Game.tsx krever bare gameId+slotId i store
  254 |     if (!page.url().includes('/game')) {
  255 |       await page.goto('/game');
  256 |     }
  257 | 
  258 |     // Vent på at spillet laster
  259 |     await page.waitForSelector('[aria-label="Hovednavigasjon"]', { timeout: 20_000 });
  260 |     await page.waitForTimeout(3000);
  261 |     await page.screenshot({ path: ss('06-game-entered'), fullPage: false });
  262 | 
  263 |     const finalUrl = page.url();
  264 |     log('06', [
  265 |       `${pigmentCount > 0 ? '✅' : '⚠️'} Fargevelger: ${pigmentCount} farger`,
  266 |       `${confirmedViaFunction ? '✅' : '⚠️'} confirmEmpireColor: ${confirmedViaFunction ? 'suksess' : 'bypass/feilet'}`,
  267 |       `${finalUrl.includes('/game') ? '✅' : '⚠️'} Navigert til: ${finalUrl}`,
  268 |     ].join('\n      '));
  269 |   });
  270 | 
  271 |   // ─── 07: Kart-skjerm ──────────────────────────────────────────────────────
  272 | 
  273 |   test('07 — Kart-skjerm: oversikt og ressurser', async () => {
  274 |     if (!page.url().includes('/game')) {
  275 |       log('07', '⚠️ Ikke i spill — hopper over');
  276 |       return;
  277 |     }
  278 | 
  279 |     await page.waitForTimeout(3000); // La game-state laste fra Firebase
  280 |     await page.screenshot({ path: ss('07-kart-full'), fullPage: false });
  281 | 
  282 |     const nav = page.getByLabel('Hovednavigasjon');
  283 |     const resources = page.getByLabel('Ressursoversikt');
  284 |     const leaflet = page.locator('.leaflet-container');
  285 | 
  286 |     const navOk = await nav.isVisible().catch(() => false);
  287 |     const resOk = await resources.isVisible().catch(() => false);
  288 |     const mapOk = await leaflet.isVisible().catch(() => false);
  289 | 
  290 |     // Sjekk TopBar for ressursverdier
  291 |     const topbarText = await page.locator('[aria-label="Ressursoversikt"]').textContent().catch(() => '');
  292 | 
  293 |     // Sjekk om NPC-knapper er synlige
  294 |     const expandBtns = await page.locator('[aria-label^="Ekspander til region"]').count();
  295 |     const investBtns = await page.locator('[aria-label^="Invester"]').count().catch(() => 0);
  296 | 
  297 |     log('07', [
  298 |       `${navOk ? '✅' : '⚠️'} BottomNav synlig`,
  299 |       `${resOk ? '✅' : '⚠️'} Ressursoversikt synlig`,
  300 |       `${mapOk ? '✅' : '⚠️'} Leaflet-kart synlig`,
  301 |       `TopBar tekst: "${topbarText?.substring(0, 80) ?? 'ikke funnet'}"`,
  302 |       `Ekspander-knapper synlig: ${expandBtns}`,
  303 |       `Invester-knapper synlig: ${investBtns}`,
  304 |     ].join('\n      '));
  305 |   });
  306 | 
  307 |   // ─── 08: Velg region på kart ──────────────────────────────────────────────
  308 | 
  309 |   test('08 — Kart: klikk region for å se KontekstPanel', async () => {
  310 |     if (!page.url().includes('/game')) return;
  311 | 
  312 |     // Klikk på et sted på kartet for å velge en region
  313 |     for (const pos of MAP_CLICKS.gameMap) {
  314 |       await page.mouse.click(pos.x, pos.y);
  315 |       await page.waitForTimeout(1200);
  316 | 
  317 |       const panel = page.locator('[class*="KontekstPanel"], [class*="kontekst"], h3, h4').first();
  318 |       const panelVisible = await panel.isVisible().catch(() => false);
  319 |       if (panelVisible) {
  320 |         await page.screenshot({ path: ss('08-region-info-panel'), fullPage: false });
  321 |         const panelText = await panel.textContent().catch(() => '');
  322 |         log('08', `✅ Panel åpnet ved (${pos.x}, ${pos.y}): "${panelText?.substring(0, 60) ?? ''}"`);
  323 |         break;
  324 |       }
  325 |     }
  326 | 
  327 |     // Sjekk etter ekspansjonsknapper
  328 |     await page.screenshot({ path: ss('08-kart-med-region'), fullPage: false });
  329 |     const expandBtns = await page.locator('[aria-label^="Ekspander til region"]').count();
  330 |     log('08', `Ekspansjonsknapper etter region-klikk: ${expandBtns}`);
  331 |   });
  332 | 
  333 |   // ─── 09: Marked-skjerm ────────────────────────────────────────────────────
  334 | 
  335 |   test('09 — Marked-skjerm: handel og priser', async () => {
  336 |     if (!page.url().includes('/game')) return;
  337 | 
> 338 |     await page.getByRole('button', { name: 'Marked', exact: true }).click();
      |                                                                     ^ TimeoutError: locator.click: Timeout 30000ms exceeded.
  339 |     await page.waitForTimeout(1500);
  340 |     await page.screenshot({ path: ss('09-marked-full'), fullPage: false });
  341 | 
  342 |     // Sjekk for ressurstabell og ordre-liste
  343 |     const hasTable = await page.locator('table, [role="table"]').first().isVisible().catch(() => false);
  344 |     const hasPrices = await page.locator('text=/[0-9]+ 🪙|pris|Kjøp|Selg/i').first().isVisible().catch(() => false);
  345 |     const hasBuyBtn = await page.locator('button:has-text("Kjøp"), button:has-text("Selg"), button:has-text("Legg inn ordre")').first().isVisible().catch(() => false);
  346 | 
  347 |     log('09', [
  348 |       `${hasTable ? '✅' : '⚠️'} Ressurstabell/data synlig`,
  349 |       `${hasPrices ? '✅' : '⚠️'} Prisinformasjon synlig`,
  350 |       `${hasBuyBtn ? '✅' : '⚠️'} Kjøp/salg-knapper synlig`,
  351 |     ].join('\n      '));
  352 |   });
  353 | 
  354 |   // ─── 10: Militær-skjerm ───────────────────────────────────────────────────
  355 | 
  356 |   test('10 — Militær-skjerm: krig og enheter', async () => {
  357 |     if (!page.url().includes('/game')) return;
  358 | 
  359 |     await page.getByRole('button', { name: 'Militær', exact: true }).click();
  360 |     await page.waitForTimeout(1500);
  361 |     await page.screenshot({ path: ss('10-milita-r-full'), fullPage: false });
  362 | 
  363 |     const hasDeclareBtn = await page.locator('button:has-text("Erklær"), button:has-text("krig")').first().isVisible().catch(() => false);
  364 |     const hasWarList = await page.locator('text=/Aktive kriger|Ingen aktive kriger|krig/i').first().isVisible().catch(() => false);
  365 |     const hasUnits = await page.locator('text=/Infanteri|Pansret|Marinestyrke|enheter/i').first().isVisible().catch(() => false);
  366 | 
  367 |     log('10', [
  368 |       `${hasDeclareBtn ? '✅' : '⚠️'} "Erklær krig"-knapp synlig`,
  369 |       `${hasWarList ? '✅' : '⚠️'} Krig-liste eller tom-tilstand synlig`,
  370 |       `${hasUnits ? '✅' : '⚠️'} Enhets-info synlig`,
  371 |     ].join('\n      '));
  372 |   });
  373 | 
  374 |   // ─── 11: Diplomati-skjerm ─────────────────────────────────────────────────
  375 | 
  376 |   test('11 — Diplomati-skjerm: allianser og chat', async () => {
  377 |     if (!page.url().includes('/game')) return;
  378 | 
  379 |     await page.getByRole('button', { name: 'Diplomati', exact: true }).click();
  380 |     await page.waitForTimeout(2000); // Force-graph kan ta litt tid
  381 |     await page.screenshot({ path: ss('11-diplomati-full'), fullPage: false });
  382 | 
  383 |     const hasGraph = await page.locator('canvas').first().isVisible().catch(() => false);
  384 |     const hasChat = await page.locator('input[type="text"], textarea').first().isVisible().catch(() => false);
  385 |     const hasAllianceSection = await page.locator('text=/Allianse|Nøytral|Diplomat/i').first().isVisible().catch(() => false);
  386 | 
  387 |     log('11', [
  388 |       `${hasGraph ? '✅' : '⚠️'} Force-graph (canvas) synlig`,
  389 |       `${hasChat ? '✅' : '⚠️'} Chat-input synlig`,
  390 |       `${hasAllianceSection ? '✅' : '⚠️'} Allianse-seksjon synlig`,
  391 |     ].join('\n      '));
  392 |   });
  393 | 
  394 |   // ─── 12: Hendelser-skjerm ─────────────────────────────────────────────────
  395 | 
  396 |   test('12 — Hendelser-skjerm: tidslinje og rangering', async () => {
  397 |     if (!page.url().includes('/game')) return;
  398 | 
  399 |     await page.getByRole('button', { name: 'Hendelser', exact: true }).click();
  400 |     await page.waitForTimeout(1500);
  401 |     await page.screenshot({ path: ss('12-hendelser-full'), fullPage: false });
  402 | 
  403 |     const hasEvents = await page.locator('text=/hendelse|krig|allianse|nasjon|tilbake/i').first().isVisible().catch(() => false);
  404 |     const hasRanking = await page.locator('text=/rangering|regioner|spillere|poeng/i').first().isVisible().catch(() => false);
  405 | 
  406 |     log('12', [
  407 |       `${hasEvents ? '✅' : '⚠️'} Hendelsesinnhold synlig`,
  408 |       `${hasRanking ? '✅' : '⚠️'} Rangeringsseksjon synlig`,
  409 |     ].join('\n      '));
  410 |   });
  411 | 
  412 |   // ─── 13: NPC-region interaksjon ───────────────────────────────────────────
  413 | 
  414 |   test('13 — NPC-region: ekspansjon, investering, diplomati', async () => {
  415 |     if (!page.url().includes('/game')) return;
  416 | 
  417 |     // Gå tilbake til kart
  418 |     await page.getByRole('button', { name: 'Kart', exact: true }).click();
  419 |     await page.waitForTimeout(1500);
  420 | 
  421 |     // Sjekk om det finnes NPC-knapper på kartet eller i region-panel
  422 |     const expandBtns = page.locator('[aria-label^="Ekspander til region"]');
  423 |     const investBtns = page.locator('[aria-label^="Invester i region"]');
  424 |     const dipBtns = page.locator('[aria-label^="Diplomatisk overtakelse"]');
  425 | 
  426 |     const expandCount = await expandBtns.count();
  427 |     const investCount = await investBtns.count();
  428 |     const dipCount = await dipBtns.count();
  429 | 
  430 |     if (expandCount > 0) {
  431 |       // Les aria-label for å se kostnadsinfo
  432 |       const firstLabel = await expandBtns.first().getAttribute('aria-label');
  433 |       await expandBtns.first().hover();
  434 |       await page.waitForTimeout(500);
  435 |       await page.screenshot({ path: ss('13-expand-btn-hover'), fullPage: false });
  436 |       log('13', `✅ Ekspander-knapp funnet: "${firstLabel}"`);
  437 |     } else {
  438 |       log('13', '⚠️ Ingen ekspansjonsknapper synlig — velg en NPC-naboregion på kartet');
```