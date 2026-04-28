/**
 * setup-emulator-game.ts
 *
 * Oppretter et testspill direkte i Firebase RTDB-emulatoren (port 9000)
 * via HTTP REST API — ingen Java/Firebase Admin SDK nødvendig.
 *
 * Bruk (når ingen spill finnes i real Firebase):
 *   firebase emulators:start --only auth,database,functions
 *   VITE_USE_EMULATORS=true VITE_EMULATE_DB=true npm run dev
 *   npx tsx e2e/setup-emulator-game.ts
 *   npx playwright test --headed
 */

const EMULATOR_HOST = process.env['FIREBASE_EMULATOR_HOST'] ?? 'localhost:9000';
const PROJECT_ID = process.env['VITE_FIREBASE_PROJECT_ID'] ?? 'demo-geopolity';
const GAME_ID = 'playtest-001';
const BASE_URL = `http://${EMULATOR_HOST}`;

async function put(path: string, data: unknown) {
  const url = `${BASE_URL}/${path}.json?ns=${PROJECT_ID}`;
  const res = await fetch(url, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(`PUT ${path} failed: ${res.status} ${await res.text()}`);
  return res.json();
}

async function main() {
  const now = Date.now();

  console.log(`Oppretter testspill "${GAME_ID}" i emulator ${EMULATOR_HOST}...`);

  // Game meta
  await put(`games/${GAME_ID}/meta`, {
    teacherId: 'test-teacher-uid',
    createdAt: now,
    status: 'active',
    unFormed: false,
    nationCount: 0,
    schemaVersion: 1,
    lastMacroTickAt: now,
  });

  // Server list entry (brukes av ServerList.tsx)
  await put(`serverList/${GAME_ID}`, {
    name: 'Testklasse — Playwright',
    teacherName: 'Testlærer',
    teacherId: 'test-teacher-uid',
    status: 'active',
    playerCount: 0,
    createdAt: now,
  });

  console.log(`✅ Spill "${GAME_ID}" opprettet.`);
  console.log('   Kjør seed-script for NPC-regioner:');
  console.log(`   FIREBASE_EMULATOR_HOST=${EMULATOR_HOST} npx tsx scripts/seed-firebase.ts --gameId ${GAME_ID}`);
}

main().catch(err => {
  console.error('Feil:', err);
  process.exit(1);
});
