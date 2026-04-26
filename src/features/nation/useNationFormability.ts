import { useMemo } from 'react';
import { useGameStore } from '../../game/store';
import type { Region } from '../../types/region';

export const MIN_REGIONS_FOR_NATION = 5;
export const MIN_CULTURE_MATCH = 0.7;

export interface FormabilityCheck {
  canForm: boolean;
  regionCount: number;
  isContiguous: boolean;
  dominantCulture: string;
  matchPct: number;
  missing: string[];   // Norske grunner til at den ikke kan dannes ennå
}

function bfsContiguous(
  regionIds: string[],
  adjacency: Record<string, string[]>,
): boolean {
  if (regionIds.length === 0) return false;
  if (regionIds.length === 1) return true;
  if (Object.keys(adjacency).length === 0) return true; // ikke lastet — anta ok

  const set = new Set(regionIds);
  const visited = new Set<string>([regionIds[0]]);
  const queue = [regionIds[0]];
  while (queue.length > 0) {
    const curr = queue.shift()!;
    for (const n of adjacency[curr] ?? []) {
      if (set.has(n) && !visited.has(n)) {
        visited.add(n);
        queue.push(n);
      }
    }
  }
  return visited.size === regionIds.length;
}

function computeMatch(regions: Region[]): { dominantCulture: string; matchPct: number } {
  if (regions.length === 0) return { dominantCulture: 'other', matchPct: 0 };
  const counts: Record<string, number> = {};
  for (const r of regions) {
    const g = r.culturalGroup ?? 'other';
    counts[g] = (counts[g] ?? 0) + 1;
  }
  let dominant = 'other';
  let max = 0;
  for (const [g, n] of Object.entries(counts)) {
    if (n > max) { max = n; dominant = g; }
  }
  return { dominantCulture: dominant, matchPct: max / regions.length };
}

/**
 * Beregner om innlogget spiller kan danne nasjon nå.
 * adjacency: bør være public/geo/adjacency.json (samme som MapScreen bruker).
 */
export function useNationFormability(
  adjacency: Record<string, string[]>,
): FormabilityCheck {
  const regions = useGameStore(s => s.regions);
  const players = useGameStore(s => s.players);
  const slotId = useGameStore(s => s.slotId);

  return useMemo<FormabilityCheck>(() => {
    const player = slotId ? players[slotId] : null;
    const regionIds = player?.regionIds ?? [];
    const myRegions = regionIds
      .map(id => regions[id])
      .filter((r): r is Region => Boolean(r));

    const contiguous = bfsContiguous(regionIds, adjacency);
    const { dominantCulture, matchPct } = computeMatch(myRegions);

    const missing: string[] = [];
    if (!player) missing.push('Du har ingen spillerprofil ennå.');
    if (player?.nationId) missing.push('Du har allerede en nasjon.');
    if (regionIds.length < MIN_REGIONS_FOR_NATION) {
      missing.push(`Trenger ${MIN_REGIONS_FOR_NATION} regioner (har ${regionIds.length}).`);
    }
    if (regionIds.length >= MIN_REGIONS_FOR_NATION && !contiguous) {
      missing.push('Regionene må være sammenhengende.');
    }
    if (regionIds.length >= MIN_REGIONS_FOR_NATION && matchPct < MIN_CULTURE_MATCH) {
      missing.push(
        `${Math.round(MIN_CULTURE_MATCH * 100)} % av regionene må dele kultur (har ${Math.round(matchPct * 100)} %).`,
      );
    }

    return {
      canForm: missing.length === 0,
      regionCount: regionIds.length,
      isContiguous: contiguous,
      dominantCulture,
      matchPct,
      missing,
    };
  }, [slotId, players, regions, adjacency]);
}
