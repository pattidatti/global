/**
 * seed-firebase.ts
 *
 * Seeder RTDB med NPC-regioner for et gitt gameId.
 * Leser public/geo/regions-meta.json og public/geo/adjacency.json.
 *
 * Forutsetter at FIREBASE_SERVICE_ACCOUNT-miljøvariabel peker til
 * en service account JSON, ELLER at FIREBASE_EMULATOR_HOST er satt
 * for å bruke lokal emulator.
 *
 * Bruk:
 *   # Emulator:
 *   FIREBASE_EMULATOR_HOST=localhost:9000 npx tsx scripts/seed-firebase.ts --gameId test-001
 *
 *   # Produksjon (krever service account):
 *   FIREBASE_SERVICE_ACCOUNT=path/to/sa.json npx tsx scripts/seed-firebase.ts --gameId abc
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const GEO_DIR = path.join(ROOT, 'public', 'geo');
const META_PATH = path.join(GEO_DIR, 'regions-meta.json');

interface RegionMeta {
  regionId: string;
  displayName: string;
  countryCode: string;
  biome: string;
  centroid: [number, number];
  strategicValue: number;
  culturalGroup: string;
}

function getGameId(): string {
  const args = process.argv.slice(2);
  const idx = args.indexOf('--gameId');
  if (idx < 0 || !args[idx + 1]) {
    console.error('Bruk: npx tsx scripts/seed-firebase.ts --gameId <gameId>');
    process.exit(1);
  }
  return args[idx + 1];
}

async function main() {
  const gameId = getGameId();

  if (!fs.existsSync(META_PATH)) {
    console.error(`Finner ikke ${META_PATH}. Kjør build-regions.ts og compute-adjacency.ts først.`);
    process.exit(1);
  }

  // Dynamisk import av firebase-admin (installert i functions/ eller som devDep)
  let admin: typeof import('firebase-admin');
  try {
    const mod = await import('firebase-admin');
    admin = mod.default ?? mod;
  } catch {
    console.error('firebase-admin ikke funnet. Kjør: npm install --save-dev firebase-admin');
    process.exit(1);
  }

  const isEmulator = !!process.env['FIREBASE_EMULATOR_HOST'];
  if (isEmulator) {
    process.env['FIREBASE_DATABASE_EMULATOR_HOST'] = process.env['FIREBASE_EMULATOR_HOST']!;
    admin.initializeApp({ databaseURL: `http://${process.env['FIREBASE_EMULATOR_HOST']}/?ns=demo-geopolity` });
    console.log(`Bruker emulator: ${process.env['FIREBASE_EMULATOR_HOST']}`);
  } else {
    const saPath = process.env['FIREBASE_SERVICE_ACCOUNT'];
    if (!saPath) {
      console.error('Sett FIREBASE_SERVICE_ACCOUNT=path/to/serviceAccount.json for produksjon');
      process.exit(1);
    }
    const serviceAccount = JSON.parse(fs.readFileSync(saPath, 'utf-8'));
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      databaseURL: process.env['FIREBASE_DATABASE_URL'],
    });
  }

  const db = admin.database();

  console.log(`Laster regions-meta.json...`);
  const regions: RegionMeta[] = JSON.parse(fs.readFileSync(META_PATH, 'utf-8'));
  console.log(`  ${regions.length} regioner.`);

  const now = Date.now();
  const BATCH_SIZE = 500;

  let seeded = 0;
  for (let i = 0; i < regions.length; i += BATCH_SIZE) {
    const batch = regions.slice(i, i + BATCH_SIZE);
    const update: Record<string, unknown> = {};

    for (const r of batch) {
      update[`games/${gameId}/regions/${r.regionId}`] = {
        ownerId: null,
        integration: 0,
        integrationStartedAt: null,
        biome: r.biome,
        resources: {},
        buildQueue: [],
        buildings: {},
        maxSlots: 1,
        lastTickAt: now,
        satisfaction: 50,
        population: 1000,
        defense: 10,
        nationId: null,
        contestedAt: null,
        countryCode: r.countryCode,
        culturalGroup: r.culturalGroup,
        strategicValue: r.strategicValue,
      };
    }

    await db.ref().update(update);
    seeded += batch.length;
    process.stdout.write(`\r  Seeded ${seeded}/${regions.length} regioner...`);
  }

  console.log(`\n\nSeedingen er fullført for gameId="${gameId}".`);
  console.log('Neste steg: start spill og velg startregion.');
  process.exit(0);
}

main().catch(err => {
  console.error('Feil:', err);
  process.exit(1);
});
