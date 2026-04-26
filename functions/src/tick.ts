import * as scheduler from 'firebase-functions/v2/scheduler';
import { logger } from 'firebase-functions/v2';
import { db } from './_db';
import { getAdjacency } from './_geo';
import { BUILDING_DEFS } from './buildings';
import { runMatchOrdersForGame } from './market';
import { runCombatForGame } from './war';
import { computeInfluenceGain, countAlliancesForSlot } from './diplomacy-logic';
import { computeMaintenanceCost } from './maintenance-logic';
import { evaluateNpcDefection } from './expansion-logic';
import { getRegionDefaults } from './_seed';
import type {
  Region,
  Building,
  BuildQueueItem,
  Biome,
  ResourceType,
  Player,
  Diplomacy,
  War,
} from './types';

const MAX_TICK_DELTA_MIN = 60;
const INTEGRATION_DURATION_MIN = 24 * 60;
const BASE_MAX_STORAGE = 1000;
const MACRO_TICK_MIN = 10;

// ---------------------------------------------------------------------------
// Pure subroutines (exported for testing)
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// tickGame — kjøres per spill
// ---------------------------------------------------------------------------

async function tickGame(gameId: string, now: number): Promise<void> {
  const [regionsSnap] = await Promise.all([
    db.ref(`games/${gameId}/regions`).once('value'),
  ]);

  const regions = regionsSnap.val() as Record<string, Region> | null;
  if (!regions) return;

  const delta: Record<string, unknown> = {};

  for (const [regionId, region] of Object.entries(regions)) {
    const deltaMin = Math.min((now - (region.lastTickAt ?? now)) / 60_000, MAX_TICK_DELTA_MIN);

    // 1. Bygge-kø
    const { newBuildings, remainingQueue } = tickBuildQueue(region, now);
    delta[`games/${gameId}/regions/${regionId}/buildQueue`] = remainingQueue;
    for (const [bid, building] of Object.entries(newBuildings)) {
      delta[`games/${gameId}/regions/${regionId}/buildings/${bid}`] = building;
    }

    const updatedRegion: Region = {
      ...region,
      buildings: { ...(region.buildings ?? {}), ...newBuildings },
      buildQueue: remainingQueue,
    };

    // 2. Produksjon — kun for eide regioner
    if (region.ownerId) {
      const prodDeltas = tickRegionProduction(updatedRegion, deltaMin);
      for (const [bid, resources] of Object.entries(prodDeltas)) {
        for (const [res, val] of Object.entries(resources) as [ResourceType, number][]) {
          delta[`games/${gameId}/regions/${regionId}/buildings/${bid}/pendingHarvest/${res}`] = val;
        }
      }
    }

    // 3. Integrasjon
    const integResult = tickIntegration(region, deltaMin);
    if (integResult) {
      delta[`games/${gameId}/regions/${regionId}/integration`] = integResult.integration;
      delta[`games/${gameId}/regions/${regionId}/integrationStartedAt`] = integResult.integrationStartedAt;
    }

    // 4. Tilfredshet (forenklet: ingen nabooppslag i fase 1)
    const newSatisfaction = tickSatisfaction(region, []);
    if (newSatisfaction !== region.satisfaction) {
      delta[`games/${gameId}/regions/${regionId}/satisfaction`] = newSatisfaction;
    }

    // 5. Befolkning
    const newPop = tickPopulation({ ...region, satisfaction: newSatisfaction });
    if (newPop !== region.population) {
      delta[`games/${gameId}/regions/${regionId}/population`] = newPop;
    }

    delta[`games/${gameId}/regions/${regionId}/lastTickAt`] = now;
  }

  delta[`games/${gameId}/meta/lastMacroTickAt`] = now;

  await db.ref().update(delta);

  // Match orderbook etter at regions/players er oppdatert (slik at evt.
  // ny treasury fra harvest-tikker er på plass først).
  await runMatchOrdersForGame(gameId);

  // Resolve combat for aktive kriger
  await runCombatForGame(gameId);

  // Passive influence-gain per spiller (etter combat så regionsantall stemmer)
  await runInfluenceGainForGame(gameId);

  // NPC frivillig tilslutning — basert på attractiveness-score
  await runNpcDefectionForGame(gameId);

  // Vedlikeholdskostnad trekkes etter combat slik at regionantall reflekterer
  // territorier som er beholdt i denne tikken.
  await runMaintenanceForGame(gameId);
}

async function runNpcDefectionForGame(gameId: string): Promise<void> {
  const [regionsSnap, playersSnap, warsSnap] = await Promise.all([
    db.ref(`games/${gameId}/regions`).once('value'),
    db.ref(`games/${gameId}/players`).once('value'),
    db.ref(`games/${gameId}/wars`).once('value'),
  ]);

  const regions = (regionsSnap.val() as Record<string, Region>) ?? {};
  const players = (playersSnap.val() as Record<string, Player>) ?? {};
  const wars = (warsSnap.val() as Record<string, War>) ?? {};

  if (Object.keys(regions).length === 0) return;

  const warAttackers: Record<string, string> = {};
  const warDefenders: Record<string, string> = {};
  const warStatuses: Record<string, string> = {};
  for (const [wid, w] of Object.entries(wars)) {
    warAttackers[wid] = w.attacker;
    warDefenders[wid] = w.defender;
    warStatuses[wid] = w.status;
  }

  const tradeBonds: Record<string, Record<string, number>> = {};
  const streaks: Record<string, Record<string, number>> = {};
  for (const [rid, r] of Object.entries(regions)) {
    if (r.tradeBond) tradeBonds[rid] = r.tradeBond;
    if (r.defectionStreak) streaks[rid] = r.defectionStreak;
  }

  const result = evaluateNpcDefection({
    regions, players, warAttackers, warDefenders, warStatuses,
    adjacency: getAdjacency(),
    tradeBonds, streaks,
  });

  const updates: Record<string, unknown> = {};
  const now = Date.now();

  for (const [regionId, newStreak] of Object.entries(result.newStreaks)) {
    if (Object.keys(newStreak).length === 0) {
      updates[`games/${gameId}/regions/${regionId}/defectionStreak`] = null;
    } else {
      updates[`games/${gameId}/regions/${regionId}/defectionStreak`] = newStreak;
    }
  }

  for (const d of result.defections) {
    // Defaults for felt som ennå ikke er satt på regionen (lazy-init: NPC-regioner
    // som ikke ble seedet får maxSlots/satisfaction/biome osv. ved første eierskap).
    const region = regions[d.regionId];
    if (region.maxSlots == null) {
      const defaults = getRegionDefaults(d.regionId, now);
      if (defaults) {
        for (const [k, v] of Object.entries(defaults)) {
          if ((region as unknown as Record<string, unknown>)[k] == null && k !== 'ownerId') {
            updates[`games/${gameId}/regions/${d.regionId}/${k}`] = v;
          }
        }
      }
    }
    updates[`games/${gameId}/regions/${d.regionId}/ownerId`] = d.newOwnerSlotId;
    updates[`games/${gameId}/regions/${d.regionId}/integration`] = 0;
    updates[`games/${gameId}/regions/${d.regionId}/integrationStartedAt`] = now;
    updates[`games/${gameId}/regions/${d.regionId}/defectionStreak`] = null;
    updates[`games/${gameId}/players/${d.newOwnerSlotId}/regionIds`] = d.newRegionIds;
    const eventId = crypto.randomUUID();
    updates[`games/${gameId}/events/${eventId}`] = {
      type: 'npc-defection',
      slotId: d.newOwnerSlotId,
      targetRegionId: d.regionId,
      at: now,
    };
  }

  if (Object.keys(updates).length > 0) {
    await db.ref().update(updates);
  }
}

async function runMaintenanceForGame(gameId: string): Promise<void> {
  const playersSnap = await db.ref(`games/${gameId}/players`).once('value');
  const players = playersSnap.val() as Record<string, Player> | null;
  if (!players) return;

  const updates: Record<string, unknown> = {};

  for (const [slotId, p] of Object.entries(players)) {
    const regionCount = (p.regionIds ?? []).length;
    const cost = computeMaintenanceCost(regionCount, MACRO_TICK_MIN);
    const rounded = Math.round(cost);

    updates[`games/${gameId}/players/${slotId}/lastMaintenanceCost`] = rounded;
    if (rounded > 0) {
      const next = Math.max(0, (p.treasury ?? 0) - rounded);
      updates[`games/${gameId}/players/${slotId}/treasury`] = next;
    }
  }

  if (Object.keys(updates).length > 0) {
    await db.ref().update(updates);
  }
}

async function runInfluenceGainForGame(gameId: string): Promise<void> {
  const [playersSnap, diplSnap] = await Promise.all([
    db.ref(`games/${gameId}/players`).once('value'),
    db.ref(`games/${gameId}/diplomacy`).once('value'),
  ]);
  const players = playersSnap.val() as Record<string, Player> | null;
  if (!players) return;
  const diplomacy = (diplSnap.val() as Record<string, Diplomacy>) ?? {};

  const updates: Record<string, unknown> = {};
  for (const [slotId, p] of Object.entries(players)) {
    const gain = computeInfluenceGain({
      regionCount: (p.regionIds ?? []).length,
      allianceCount: countAlliancesForSlot(slotId, diplomacy),
      hasNation: !!p.nationId,
    });
    if (gain > 0) {
      updates[`games/${gameId}/players/${slotId}/influence`] = (p.influence ?? 0) + gain;
    }
  }
  if (Object.keys(updates).length > 0) {
    await db.ref().update(updates);
  }
}

// ---------------------------------------------------------------------------
// macroTick — scheduled Cloud Function
// ---------------------------------------------------------------------------

export const macroTick = scheduler.onSchedule(
  { schedule: 'every 10 minutes', region: 'europe-west1' },
  async () => {
    const now = Date.now();

    const gamesSnap = await db.ref('games').once('value');
    const games = gamesSnap.val() as Record<string, { meta: { status: string } }> | null;
    if (!games) return;

    const activeGames = Object.entries(games)
      .filter(([, g]) => g?.meta?.status === 'active')
      .map(([id]) => id);

    logger.info(`macroTick: ${activeGames.length} aktive spill.`);

    await Promise.all(activeGames.map(gameId => tickGame(gameId, now)));
  },
);
