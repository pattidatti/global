import { useEffect, useRef } from 'react';
import { useGameStore } from '../game/store';
import type { Region } from '../types/region';
import type { MapMode } from './MapModeControl';
import type { RegionGraphicsLayer, RegionStyle } from './RegionGraphicsLayer';

// Victoria 3-inspirert politisk kart-palett per kulturgruppe
const NPC_GROUP_COLORS: Record<string, number> = {
  'nordic':        0x7fbcd2,
  'germanic':      0xa8b8c8,
  'anglo':         0x5a9eb8,
  'slavic':        0x8ab87a,
  'latin':         0xe8c87a,
  'mediterranean': 0xe0a870,
  'arabic':        0xd4b870,
  'north-african': 0xd8c060,
  'sub-saharan':   0x9ac870,
  'ethiopian':     0x78b890,
  'sinitic':       0xd87070,
  'indochinese':   0xe8a070,
  'malay':         0xd8a860,
  'japanic':       0xe890a0,
  'korean':        0xa890c8,
  'indic':         0xe8d060,
  'persian':       0xb89050,
  'central-asian': 0xa8b898,
  'turkic':        0x60b898,
  'andean':        0x9070b8,
  'polynesian':    0x60a8c0,
  'other':         0xa8a898,
};

const GOOD_HEX = 0x3f6b3f;
const DANGER_HEX = 0x9a2a2a;

function cssToHex(css: string): number {
  return parseInt(css.replace('#', ''), 16);
}

function getNpcColor(culturalGroup: string | undefined, regionId: string, culturalGroupCache: Map<string, string>): number {
  const group = culturalGroup ?? culturalGroupCache.get(regionId) ?? 'other';
  return NPC_GROUP_COLORS[group] ?? NPC_GROUP_COLORS.other;
}

export function useRegionLayer(
  layerRef: React.RefObject<RegionGraphicsLayer | null>,
  adjacency: Record<string, string[]>,
  mapMode: MapMode | undefined,
  regionColors: Record<string, string> | undefined,
): void {
  const store = useGameStore;
  const prevRegionsRef = useRef<Record<string, Region>>({});
  const prevSelectedRef = useRef<string | null>(null);
  const prevModeRef = useRef<MapMode>(mapMode ?? 'region');
  const culturalGroupCacheRef = useRef<Map<string, string>>(new Map());

  useEffect(() => {
    const applyAll = () => {
      const { regions, slotId, selectedRegionId, nations, players } = store.getState();
      const layer = layerRef.current;
      if (!layer) return;

      const currentMode = mapMode ?? 'region';
      const neighborIds = selectedRegionId ? new Set(adjacency[selectedRegionId] ?? []) : new Set<string>();

      const computeStyle = (regionId: string): RegionStyle => {
        const region = regions[regionId];

        if (neighborIds.has(regionId) && regionId !== selectedRegionId) {
          return {
            fillColor: GOOD_HEX,
            fillAlpha: 0.25,
            borderColor: GOOD_HEX,
            borderWidth: 1.5,
            isSelected: false,
            isNeighbor: true,
            isContested: false,
          };
        }

        const state = !region
          ? 'npc'
          : region.contestedAt ? 'contested'
          : region.ownerId === slotId ? 'mine'
          : region.ownerId ? 'owned'
          : 'npc';

        const isContested = state === 'contested';
        const empireColor = region?.ownerId ? players[region.ownerId]?.empireColor : undefined;
        const nation = region?.nationId ? nations[region.nationId] : undefined;

        let fillColor: number;
        const isOwned = state === 'mine' || state === 'owned';

        if (currentMode === 'culture') {
          fillColor = getNpcColor(region?.culturalGroup, regionId, culturalGroupCacheRef.current);
        } else if (currentMode === 'empire') {
          fillColor = isOwned && empireColor ? cssToHex(empireColor) : getNpcColor(region?.culturalGroup, regionId, culturalGroupCacheRef.current);
        } else {
          // 'region' mode
          if (isOwned && empireColor) {
            fillColor = cssToHex(empireColor);
          } else {
            const graphColor = regionColors?.[regionId];
            fillColor = graphColor ? cssToHex(graphColor) : getNpcColor(region?.culturalGroup, regionId, culturalGroupCacheRef.current);
          }
        }

        if (isContested) fillColor = DANGER_HEX;

        let fillAlpha = isOwned ? (state === 'mine' ? 0.95 : 0.88) : 0.88;
        if (state === 'mine' && region?.integrationStartedAt != null) {
          fillAlpha = 0.55 + (region.integration / 100) * 0.37;
        }

        const isSelected = regionId === selectedRegionId;
        const borderColor = isSelected
          ? 0xffffff
          : state === 'mine' ? 0xffffff
          : nation ? cssToHex(nation.color)
          : state === 'owned' ? 0x222222
          : 0x7a8a6a;

        const borderWidth = isSelected
          ? 3
          : state === 'mine' ? 3
          : nation ? 2.5
          : state === 'owned' ? 1.5
          : 1.2;

        return { fillColor, fillAlpha, borderColor, borderWidth, isSelected, isNeighbor: false, isContested };
      };

      const allIds = new Set([...Object.keys(regions), ...Object.keys(prevRegionsRef.current)]);
      for (const id of allIds) {
        layer.updateRegion(id, computeStyle(id));
      }
    };

    // Subscribe to store changes and re-apply relevant regions
    const unsubscribe = store.subscribe((state, prev) => {
      const layer = layerRef.current;
      if (!layer) return;

      const currentMode = mapMode ?? 'region';
      const modeChanged = prevModeRef.current !== currentMode;
      prevModeRef.current = currentMode;

      if (modeChanged) {
        applyAll();
        return;
      }

      const neighborIds = state.selectedRegionId ? new Set(adjacency[state.selectedRegionId] ?? []) : new Set<string>();
      const prevNeighborIds = prev.selectedRegionId ? new Set(adjacency[prev.selectedRegionId] ?? []) : new Set<string>();

      const toUpdate = new Set<string>();

      for (const id of Object.keys(state.regions)) {
        const r = state.regions[id];
        const p = prev.regions[id];
        if (!p || p.ownerId !== r.ownerId || p.integration !== r.integration ||
            p.nationId !== r.nationId || p.contestedAt !== r.contestedAt ||
            p.integrationStartedAt !== r.integrationStartedAt) {
          toUpdate.add(id);
        }
      }
      for (const id of Object.keys(prev.regions)) {
        if (!state.regions[id]) toUpdate.add(id);
      }

      if (prev.selectedRegionId !== state.selectedRegionId) {
        if (prev.selectedRegionId) {
          toUpdate.add(prev.selectedRegionId);
          (adjacency[prev.selectedRegionId] ?? []).forEach(id => toUpdate.add(id));
        }
        if (state.selectedRegionId) {
          toUpdate.add(state.selectedRegionId);
          (adjacency[state.selectedRegionId] ?? []).forEach(id => toUpdate.add(id));
        }
      }

      // Sync selected + neighbors that changed
      for (const id of [...neighborIds, ...prevNeighborIds]) toUpdate.add(id);

      prevRegionsRef.current = state.regions;
      prevSelectedRef.current = state.selectedRegionId ?? null;

      const computeStyle = (regionId: string): RegionStyle => {
        const { regions, slotId, selectedRegionId, nations, players } = state;
        const region = regions[regionId];

        if (neighborIds.has(regionId) && regionId !== selectedRegionId) {
          return { fillColor: GOOD_HEX, fillAlpha: 0.25, borderColor: GOOD_HEX, borderWidth: 1.5, isSelected: false, isNeighbor: true, isContested: false };
        }

        const st = !region ? 'npc'
          : region.contestedAt ? 'contested'
          : region.ownerId === slotId ? 'mine'
          : region.ownerId ? 'owned'
          : 'npc';

        const isContested = st === 'contested';
        const empireColor = region?.ownerId ? players[region.ownerId]?.empireColor : undefined;
        const nation = region?.nationId ? nations[region.nationId] : undefined;
        const isOwned = st === 'mine' || st === 'owned';

        let fillColor: number;
        if (currentMode === 'culture') {
          fillColor = getNpcColor(region?.culturalGroup, regionId, culturalGroupCacheRef.current);
        } else if (currentMode === 'empire') {
          fillColor = isOwned && empireColor ? cssToHex(empireColor) : getNpcColor(region?.culturalGroup, regionId, culturalGroupCacheRef.current);
        } else {
          if (isOwned && empireColor) fillColor = cssToHex(empireColor);
          else {
            const gc = regionColors?.[regionId];
            fillColor = gc ? cssToHex(gc) : getNpcColor(region?.culturalGroup, regionId, culturalGroupCacheRef.current);
          }
        }
        if (isContested) fillColor = DANGER_HEX;

        let fillAlpha = isOwned ? (st === 'mine' ? 0.95 : 0.88) : 0.88;
        if (st === 'mine' && region?.integrationStartedAt != null) {
          fillAlpha = 0.55 + (region.integration / 100) * 0.37;
        }

        const isSelected = regionId === selectedRegionId;
        const borderColor = isSelected ? 0xffffff
          : st === 'mine' ? 0xffffff
          : nation ? cssToHex(nation.color)
          : st === 'owned' ? 0x222222
          : 0x7a8a6a;
        const borderWidth = isSelected ? 3 : st === 'mine' ? 3 : nation ? 2.5 : st === 'owned' ? 1.5 : 1.2;

        return { fillColor, fillAlpha, borderColor, borderWidth, isSelected, isNeighbor: false, isContested };
      };

      for (const id of toUpdate) {
        layer.updateRegion(id, computeStyle(id));
      }
    });

    applyAll();
    return unsubscribe;
  }, [layerRef, adjacency, mapMode, regionColors, store]); // eslint-disable-line react-hooks/exhaustive-deps

  // Contested pulse animation
  useEffect(() => {
    const id = setInterval(() => {
      const { regions } = store.getState();
      const layer = layerRef.current;
      if (!layer) return;
      const t = Date.now() / 600;
      const alpha = 0.35 + 0.4 * Math.abs(Math.sin(t));
      for (const [rid, r] of Object.entries(regions)) {
        if (r.contestedAt != null) {
          const style = getContestedPulseStyle(alpha);
          layer.updateRegion(rid, { ...style, isContested: true });
        }
      }
    }, 100);
    return () => clearInterval(id);
  }, [layerRef, store]);
}

function getContestedPulseStyle(alpha: number): RegionStyle {
  return {
    fillColor: DANGER_HEX,
    fillAlpha: alpha,
    borderColor: DANGER_HEX,
    borderWidth: 2,
    isSelected: false,
    isNeighbor: false,
    isContested: true,
  };
}
