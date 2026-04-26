// Rene helpers for nasjonsdanning — ingen Firebase-import slik at de
// kan unit-testes uten emulator/admin-SDK.

import type { Region } from './types';

export const MIN_REGIONS_FOR_NATION = 5;
export const MIN_CULTURE_MATCH = 0.7; // §0 IMPLEMENTATION_PLAN.md

/**
 * BFS for å verifisere at en mengde regioner er sammenhengende via adjacency.
 * Returnerer true hvis alle regioner kan nås fra første region kun via egne regioner.
 */
export function isContiguous(
  regionIds: string[],
  adjacency: Record<string, string[]>,
): boolean {
  if (regionIds.length === 0) return false;
  if (regionIds.length === 1) return true;

  const set = new Set(regionIds);
  const visited = new Set<string>();
  const queue: string[] = [regionIds[0]];
  visited.add(regionIds[0]);

  while (queue.length > 0) {
    const curr = queue.shift()!;
    const neighbors = adjacency[curr] ?? [];
    for (const n of neighbors) {
      if (set.has(n) && !visited.has(n)) {
        visited.add(n);
        queue.push(n);
      }
    }
  }

  return visited.size === regionIds.length;
}

/**
 * Beregn dominerende kulturgruppe og match-andel i en samling regioner.
 * Returnerer { dominantCulture, matchPct } der matchPct er 0–1.
 */
export function computeCultureMatch(regions: Pick<Region, 'culturalGroup'>[]): {
  dominantCulture: string;
  matchPct: number;
} {
  if (regions.length === 0) return { dominantCulture: 'other', matchPct: 0 };

  const counts: Record<string, number> = {};
  for (const r of regions) {
    const g = r.culturalGroup ?? 'other';
    counts[g] = (counts[g] ?? 0) + 1;
  }

  let dominant = 'other';
  let max = 0;
  for (const [g, n] of Object.entries(counts)) {
    if (n > max) {
      max = n;
      dominant = g;
    }
  }

  return { dominantCulture: dominant, matchPct: max / regions.length };
}

/**
 * Slugifiser et nasjonsnavn til en stabil ID-kjerne. Kombineres med "nation_"-prefiks.
 */
export function slugifyNationName(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .slice(0, 40);
}
