import { useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useGameStore } from './store';
import type { Region } from '../types/region';
import type { Player } from '../types/player';

export function useMyPlayer(): Player | null {
  return useGameStore(s => (!s.slotId ? null : (s.players[s.slotId] ?? null)));
}

export function useMyRegions(): Record<string, Region> {
  return useGameStore(
    useShallow((s) => {
      if (!s.slotId) return {};
      return Object.fromEntries(
        Object.entries(s.regions).filter(([, r]) => r.ownerId === s.slotId),
      );
    }),
  );
}

export function useRegion(regionId: string): Region | null {
  return useGameStore(s => s.regions[regionId] ?? null);
}

export function useNeighborsOf(
  regionId: string,
  adjacency: Record<string, string[]>,
): Region[] {
  const { regions } = useGameStore();
  const neighborIds = adjacency[regionId] ?? [];
  return neighborIds.map(id => regions[id]).filter(Boolean) as Region[];
}

export function usePlayerById(slotId: string): Player | null {
  const { players } = useGameStore();
  return players[slotId] ?? null;
}

export function useNationRegions(nationId: string): Record<string, Region> {
  return useGameStore(
    useShallow((s) =>
      Object.fromEntries(
        Object.entries(s.regions).filter(([, r]) => r.nationId === nationId),
      ),
    ),
  );
}

/** Aggregerer ressurser på tvers av alle egne regioner */
export function useTotalResources(): Record<string, number> {
  const myRegions = useMyRegions();
  return useMemo(() => {
    const totals: Record<string, number> = {};
    for (const region of Object.values(myRegions)) {
      for (const [res, amount] of Object.entries(region.resources ?? {})) {
        totals[res] = (totals[res] ?? 0) + (amount ?? 0);
      }
    }
    return totals;
  }, [myRegions]);
}

/**
 * Returnerer true hvis spilleren kan ekspandere til targetRegionId:
 * - regionen er NPC
 * - spiller eier minst én naboregion (fra adjacency)
 * - spiller har ≥ 25 military
 */
export function useCanExpandTo(
  targetRegionId: string,
  adjacency: Record<string, string[]>,
): boolean {
  const { regions, slotId, players } = useGameStore();
  if (!slotId) return false;

  const target = regions[targetRegionId];
  if (!target || target.ownerId !== null) return false;

  const player = players[slotId];
  if (!player || player.military < 25) return false;

  const neighbors = adjacency[targetRegionId] ?? [];
  // Tillat uten adjacency-data (for utvikling uten generert fil)
  if (neighbors.length === 0) return true;

  return player.regionIds.some(id => neighbors.includes(id));
}
