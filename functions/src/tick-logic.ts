// Ingen Firebase-import — testbar uten emulator
import { BUILDING_DEFS } from './buildings-logic';
import type { Region, Building, BuildQueueItem, Biome, ResourceType } from './types';

export const INTEGRATION_DURATION_MIN = 24 * 60;
export const BASE_MAX_STORAGE = 1000;

/**
 * Beregner pendingHarvest-endringer for alle bygninger i en region.
 */
export function tickRegionProduction(
  region: Region,
  deltaMin: number,
): Record<string, Partial<Record<ResourceType, number>>> {
  const result: Record<string, Partial<Record<ResourceType, number>>> = {};
  if (!region.buildings) return result;

  for (const [buildingId, building] of Object.entries(region.buildings)) {
    const def = BUILDING_DEFS[building.type];
    if (!def) continue;

    const biomeFactor =
      def.biomeMul[region.biome as Biome] ??
      def.biomeMul['others'] ??
      0.5;

    const updated: Partial<Record<ResourceType, number>> = {};
    for (const [res, baseOutput] of Object.entries(def.output) as [ResourceType, number][]) {
      const gain = baseOutput * biomeFactor * (deltaMin / 10);
      const current = building.pendingHarvest[res] ?? 0;
      updated[res] = Math.min(current + gain, building.maxStorage ?? BASE_MAX_STORAGE);
    }
    result[buildingId] = updated;
  }

  return result;
}

/**
 * Sjekker bygge-køen. Returnerer nye bygninger og gjenværende kø.
 */
export function tickBuildQueue(
  region: Region,
  now: number,
): { newBuildings: Record<string, Building>; remainingQueue: BuildQueueItem[] } {
  const queue = region.buildQueue ?? [];
  const newBuildings: Record<string, Building> = {};
  const remainingQueue: BuildQueueItem[] = [];

  for (const item of queue) {
    if (item.completesAt <= now) {
      newBuildings[item.buildingId] = {
        type: item.type,
        builtAt: now,
        pendingHarvest: {},
        lastHarvestedAt: null,
        maxStorage: BASE_MAX_STORAGE,
      };
    } else {
      remainingQueue.push(item);
    }
  }

  return { newBuildings, remainingQueue };
}

/**
 * Beregner ny integrasjonsverdi.
 */
export function tickIntegration(
  region: Region,
  deltaMin: number,
): { integration: number; integrationStartedAt: number | null } | null {
  if (region.integrationStartedAt === null) return null;

  const progress = (deltaMin / INTEGRATION_DURATION_MIN) * 100;
  const newIntegration = Math.min(region.integration + progress, 100);

  if (newIntegration >= 100) {
    return { integration: 100, integrationStartedAt: null };
  }
  return { integration: newIntegration, integrationStartedAt: region.integrationStartedAt };
}

/**
 * Beregner ny tilfredshet (forenklet fase-1-versjon).
 */
export function tickSatisfaction(
  region: Region,
  neighborRegions: Region[],
): number {
  let delta = 0;

  if ((region.resources?.food ?? 0) < 100) delta -= 1;

  const owner = region.ownerId;
  if (owner && neighborRegions.length > 0) {
    const allSameOwner = neighborRegions.every(n => n.ownerId === owner);
    if (allSameOwner) delta += 0.5;
  }

  if (region.integrationStartedAt !== null && region.integration < 100) {
    delta -= 0.5;
  }

  return Math.max(0, Math.min(100, region.satisfaction + delta));
}

/**
 * Beregner ny befolkning.
 */
export function tickPopulation(region: Region): number {
  if (region.satisfaction > 60) return Math.floor(region.population * 1.001);
  if (region.satisfaction < 30) return Math.floor(region.population * 0.999);
  return region.population;
}
