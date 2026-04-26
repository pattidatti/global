import * as path from 'path';
import * as fs from 'fs';

let cache: Record<string, string[]> | null = null;

/**
 * Adjacency-tabell lastet fra public/geo/adjacency.json. Cachet per
 * cold-start. Returnerer tom record hvis filen ikke finnes (test-/dev-modus).
 */
export function getAdjacency(): Record<string, string[]> {
  if (cache) return cache;
  const candidates = [
    path.resolve(__dirname, '../../public/geo/adjacency.json'),
    path.resolve(__dirname, '../../../public/geo/adjacency.json'),
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) {
      cache = JSON.parse(fs.readFileSync(p, 'utf-8')) as Record<string, string[]>;
      return cache;
    }
  }
  cache = {};
  return cache;
}
