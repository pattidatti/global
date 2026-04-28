import * as scheduler from 'firebase-functions/v2/scheduler';
import { logger } from 'firebase-functions/v2';
import { db } from './_db';
import { getAdjacency } from './_geo';
import { runMatchOrdersForGame } from './market';
import { runCombatForGame } from './war';
import { computeInfluenceGain, countAlliancesForSlot } from './diplomacy-logic';
import { computeMaintenanceCost } from './maintenance-logic';
import { evaluateNpcDefection } from './expansion-logic';
import { getRegionDefaults } from './_seed';
import {
  tickRegionProduction,
  tickBuildQueue,
  tickIntegration,
  tickSatisfaction,
  tickPopulation,
} from './tick-logic';
export { tickRegionProduction, tickBuildQueue, tickIntegration, tickSatisfaction, tickPopulation };
import type { Region, ResourceType, Player, Diplomacy, War } from './types';

const MAX_TICK_DELTA_MIN = 60;
const MACRO_TICK_MIN = 10;

// ---------------------------------------------------------------------------
// tickGame — kjøres per spill
// ---------------------------------------------------------------------------

export async function tickGame(gameId: string, now: number): Promise<void> {
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

  // Fjern undefined og NaN — RTDB avviser begge
  const cleanDelta = Object.fromEntries(
    Object.entries(delta).filter(([, v]) => v !== undefined && !(typeof v === 'number' && Number.isNaN(v))),
  );
  await db.ref().update(cleanDelta);

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
