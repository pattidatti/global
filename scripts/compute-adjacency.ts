/**
 * compute-adjacency.ts
 *
 * Beregner naboskap mellom alle regioner i regions.geojson.
 * Bruker booleanIntersects med 0.01° buffer for å fange opp
 * regioner som nesten møtes men har en liten gap.
 *
 * Output: public/geo/adjacency.json  { [regionId]: string[] }
 *
 * Bruk:
 *   npx tsx scripts/compute-adjacency.ts
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as turf from '@turf/turf';
import type { Feature, FeatureCollection, Polygon, MultiPolygon } from 'geojson';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const GEO_DIR = path.join(ROOT, 'public', 'geo');
const INPUT = path.join(GEO_DIR, 'regions.geojson');
const OUTPUT = path.join(GEO_DIR, 'adjacency.json');

const BUFFER_DEG = 0.01; // ~1 km buffer for å fange gap mellom polygoner

interface RegionFeature {
  regionId: string;
  feature: Feature<Polygon | MultiPolygon>;
  bbox: [number, number, number, number]; // [minLng, minLat, maxLng, maxLat]
}

function bboxOverlap(
  a: [number, number, number, number],
  b: [number, number, number, number],
): boolean {
  return !(a[2] < b[0] || b[2] < a[0] || a[3] < b[1] || b[3] < a[1]);
}

async function main() {
  if (!fs.existsSync(INPUT)) {
    console.error(`Finner ikke ${INPUT}. Kjør build-regions.ts først.`);
    process.exit(1);
  }

  console.log('Laster regions.geojson...');
  const fc = JSON.parse(fs.readFileSync(INPUT, 'utf-8')) as FeatureCollection;
  console.log(`  ${fc.features.length} features.`);

  // Bygg index
  const regions: RegionFeature[] = [];
  for (const f of fc.features) {
    if (f.geometry.type !== 'Polygon' && f.geometry.type !== 'MultiPolygon') continue;
    const feat = f as Feature<Polygon | MultiPolygon>;
    const props = feat.properties ?? {};
    const regionId = props['regionId'] as string;
    if (!regionId) continue;

    let bbox: [number, number, number, number];
    try {
      const b = turf.bbox(feat);
      bbox = [b[0], b[1], b[2], b[3]];
    } catch {
      continue;
    }
    regions.push({ regionId, feature: feat, bbox });
  }

  console.log(`  Bruker ${regions.length} polygoner for beregning.`);

  const adjacency: Record<string, string[]> = {};
  for (const r of regions) adjacency[r.regionId] = [];

  // O(n²) med bbox-filter
  let pairsTested = 0;
  let adjacentCount = 0;
  const n = regions.length;

  for (let i = 0; i < n; i++) {
    const a = regions[i];

    // Buffer a én gang for effektivitet
    let bufferedA: Feature;
    try {
      bufferedA = turf.buffer(a.feature, BUFFER_DEG, { units: 'degrees' }) as Feature;
    } catch {
      bufferedA = a.feature;
    }

    for (let j = i + 1; j < n; j++) {
      const b = regions[j];

      // Rask bbox-sjekk (med buffer-margin)
      const expandedA: [number, number, number, number] = [
        a.bbox[0] - BUFFER_DEG, a.bbox[1] - BUFFER_DEG,
        a.bbox[2] + BUFFER_DEG, a.bbox[3] + BUFFER_DEG,
      ];
      if (!bboxOverlap(expandedA, b.bbox)) continue;

      pairsTested++;
      try {
        if (turf.booleanIntersects(bufferedA, b.feature)) {
          adjacency[a.regionId].push(b.regionId);
          adjacency[b.regionId].push(a.regionId);
          adjacentCount++;
        }
      } catch {
        // Ignorer geometri-feil for enkeltpar
      }
    }

    if (i % 100 === 0) {
      process.stdout.write(`\r  Ferdig: ${i}/${n} (${adjacentCount} nabopar funnet)`);
    }
  }

  console.log(`\n  Testet ${pairsTested} par, funnet ${adjacentCount} nabopar.`);

  const avgNeighbors = (
    Object.values(adjacency).reduce((s, arr) => s + arr.length, 0) / n
  ).toFixed(1);
  console.log(`  Gjennomsnittlig naboer per region: ${avgNeighbors}`);

  fs.writeFileSync(OUTPUT, JSON.stringify(adjacency));
  console.log(`\nSkriv til: ${OUTPUT}  (${(fs.statSync(OUTPUT).size / 1024).toFixed(0)} KB)`);
  console.log('\nFerdig! Kjør nå:');
  console.log('  npx tsx scripts/seed-firebase.ts --gameId <ditt-game-id>');
}

main().catch(err => {
  console.error('Feil:', err);
  process.exit(1);
});
