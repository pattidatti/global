import * as path from 'path';
import * as fs from 'fs';
import type { Biome } from './types';

interface RegionMeta {
  regionId: string;
  displayName: string;
  countryCode: string;
  biome: string;
  centroid: [number, number];
  strategicValue: number;
  culturalGroup: string;
}

let metaCache: Record<string, RegionMeta> | null = null;

/**
 * Loader regions-meta.json fra public/geo/. Cachet per cold-start.
 * Returnerer tom record hvis filen ikke finnes (test-/dev-modus).
 */
function getRegionMeta(): Record<string, RegionMeta> {
  if (metaCache) return metaCache;
  const candidates = [
    path.resolve(__dirname, '../../public/geo/regions-meta.json'),
    path.resolve(__dirname, '../../../public/geo/regions-meta.json'),
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) {
      const arr = JSON.parse(fs.readFileSync(p, 'utf-8')) as RegionMeta[];
      const map: Record<string, RegionMeta> = {};
      for (const r of arr) map[r.regionId] = r;
      metaCache = map;
      return metaCache;
    }
  }
  metaCache = {};
  return metaCache;
}

/**
 * Defaults for en region som speiler scripts/seed-firebase.ts. Brukes når en
 * spiller hevder en region som ikke er seedet inn i RTDB enda — sikrer at
 * alle felt (maxSlots, satisfaction, defense osv.) er satt før eierskap.
 *
 * Returnerer null hvis regionId ikke finnes i regions-meta.json.
 */
export function getRegionDefaults(
  regionId: string,
  now: number,
): Record<string, unknown> | null {
  const meta = getRegionMeta()[regionId];
  if (!meta) return null;

  const biome = (meta.biome as Biome) ?? 'other';

  return {
    ownerId: null,
    integration: 0,
    integrationStartedAt: null,
    biome,
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
    countryCode: meta.countryCode,
    culturalGroup: meta.culturalGroup,
    strategicValue: meta.strategicValue,
  };
}

/** Eksponert kun for testing — clearer cachen mellom tester. */
export function _resetSeedCacheForTest(): void {
  metaCache = null;
}
