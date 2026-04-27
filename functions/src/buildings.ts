import * as functions from 'firebase-functions/v2/https';
import { db } from './_db';
import { M } from './messages';
import { BUILDING_DEFS } from './buildings-logic';
export { BUILDING_DEFS };
import type {
  BuildBuildingArgs,
  CancelBuildArgs,
  HarvestBuildingArgs,
  Region,
  Building,
  BuildQueueItem,
  CallableResult,
  ResourceType,
} from './types';

const REGION = 'europe-west1';

const CANCEL_REFUND_RATE = 0.5;

// Ressurser som går til player (ikke region.resources)
const PLAYER_RESOURCES: ResourceType[] = ['military', 'influence'];

// ---------------------------------------------------------------------------
// Hjelpefunksjoner
// ---------------------------------------------------------------------------

async function resolveSlotId(gameId: string, uid: string): Promise<string | null> {
  const snap = await db.ref(`games/${gameId}/roster/${uid}`).once('value');
  return snap.exists() ? uid : null;
}

// ---------------------------------------------------------------------------
// buildBuilding
// ---------------------------------------------------------------------------

export const buildBuilding = functions.onCall<
  BuildBuildingArgs,
  Promise<CallableResult<{ buildingId: string; completesAt: number }>>
>(
  { region: REGION, invoker: 'public', cors: true },
  async (req) => {
    if (!req.auth?.uid) return { ok: false, error: 'unauthenticated', melding: M.IKKE_AUTENTISERT };

    const { gameId, regionId, buildingType } = req.data;
    const def = BUILDING_DEFS[buildingType];
    if (!def) return { ok: false, error: 'unknown-building', melding: M.UKJENT_BYGNINGSTYPE };

    const slotId = await resolveSlotId(gameId, req.auth.uid);
    if (!slotId) return { ok: false, error: 'unauthorized', melding: M.IKKE_AUTORISERT };

    const [regionSnap, playerSnap, metaSnap] = await Promise.all([
      db.ref(`games/${gameId}/regions/${regionId}`).once('value'),
      db.ref(`games/${gameId}/players/${slotId}`).once('value'),
      db.ref(`games/${gameId}/meta/status`).once('value'),
    ]);

    if (metaSnap.val() !== 'active') return { ok: false, error: 'game-not-active', melding: M.SPILL_IKKE_AKTIVT };

    const region = regionSnap.val() as Region | null;
    if (!region) return { ok: false, error: 'region-not-found', melding: M.REGION_IKKE_FUNNET };
    if (region.ownerId !== slotId) return { ok: false, error: 'not-owner', melding: M.REGION_IKKE_DIN };

    const player = playerSnap.val() as { treasury: number } | null;
    if (!player) return { ok: false, error: 'player-not-found', melding: M.IKKE_AUTENTISERT };

    // Sjekk ledige byggeplasser (kø + eksisterende)
    const buildingCount = Object.keys(region.buildings ?? {}).length;
    const queueCount = (region.buildQueue ?? []).length;
    if (buildingCount + queueCount >= (region.maxSlots ?? 1)) {
      return { ok: false, error: 'max-slots', melding: M.MAKS_BYGG_NAADD };
    }

    // Krav-sjekk
    if (def.requires === 'coast' && region.biome !== 'coast') {
      return { ok: false, error: 'requires-coast', melding: M.KREVER_KYST };
    }

    // Betalingssjekk
    if (player.treasury < def.cost) {
      return { ok: false, error: 'insufficient-funds', melding: M.IKKE_NOK_PENGER };
    }

    const now = Date.now();
    const buildingId = crypto.randomUUID();
    const completesAt = now + def.buildTimeMin * 60_000;

    const newItem: BuildQueueItem = { buildingId, type: buildingType, startedAt: now, completesAt };
    const existingQueue = region.buildQueue ?? [];

    await db.ref().update({
      [`games/${gameId}/players/${slotId}/treasury`]: player.treasury - def.cost,
      [`games/${gameId}/regions/${regionId}/buildQueue`]: [...existingQueue, newItem],
    });

    return { ok: true, data: { buildingId, completesAt } };
  },
);

// ---------------------------------------------------------------------------
// cancelBuild
// ---------------------------------------------------------------------------

export const cancelBuild = functions.onCall<CancelBuildArgs, Promise<CallableResult>>(
  { region: REGION, invoker: 'public', cors: true },
  async (req) => {
    if (!req.auth?.uid) return { ok: false, error: 'unauthenticated', melding: M.IKKE_AUTENTISERT };

    const { gameId, regionId, buildingId } = req.data;
    const slotId = await resolveSlotId(gameId, req.auth.uid);
    if (!slotId) return { ok: false, error: 'unauthorized', melding: M.IKKE_AUTORISERT };

    const [regionSnap, playerSnap] = await Promise.all([
      db.ref(`games/${gameId}/regions/${regionId}`).once('value'),
      db.ref(`games/${gameId}/players/${slotId}`).once('value'),
    ]);

    const region = regionSnap.val() as Region | null;
    if (!region) return { ok: false, error: 'region-not-found', melding: M.REGION_IKKE_FUNNET };
    if (region.ownerId !== slotId) return { ok: false, error: 'not-owner', melding: M.REGION_IKKE_DIN };

    const queue = region.buildQueue ?? [];
    const item = queue.find(q => q.buildingId === buildingId);
    if (!item) return { ok: false, error: 'not-in-queue', melding: M.BYGG_KOE_TOMT };

    const def = BUILDING_DEFS[item.type];
    const refund = Math.floor(def.cost * CANCEL_REFUND_RATE);
    const player = playerSnap.val() as { treasury: number } | null;
    const currentTreasury = player?.treasury ?? 0;

    await db.ref().update({
      [`games/${gameId}/regions/${regionId}/buildQueue`]: queue.filter(q => q.buildingId !== buildingId),
      [`games/${gameId}/players/${slotId}/treasury`]: currentTreasury + refund,
    });

    return { ok: true };
  },
);

// ---------------------------------------------------------------------------
// harvestBuilding
// ---------------------------------------------------------------------------

export const harvestBuilding = functions.onCall<HarvestBuildingArgs, Promise<CallableResult>>(
  { region: REGION, invoker: 'public', cors: true },
  async (req) => {
    if (!req.auth?.uid) return { ok: false, error: 'unauthenticated', melding: M.IKKE_AUTENTISERT };

    const { gameId, regionId, buildingId } = req.data;
    const slotId = await resolveSlotId(gameId, req.auth.uid);
    if (!slotId) return { ok: false, error: 'unauthorized', melding: M.IKKE_AUTORISERT };

    const [regionSnap, playerSnap] = await Promise.all([
      db.ref(`games/${gameId}/regions/${regionId}`).once('value'),
      db.ref(`games/${gameId}/players/${slotId}`).once('value'),
    ]);

    const region = regionSnap.val() as Region | null;
    if (!region) return { ok: false, error: 'region-not-found', melding: M.REGION_IKKE_FUNNET };
    if (region.ownerId !== slotId) return { ok: false, error: 'not-owner', melding: M.REGION_IKKE_DIN };

    const building = (region.buildings ?? {})[buildingId] as Building | undefined;
    if (!building) return { ok: false, error: 'building-not-found', melding: M.BYGNING_IKKE_FUNNET };

    const pending = building.pendingHarvest ?? {};
    const hasAnything = Object.values(pending).some(v => (v ?? 0) > 0);
    if (!hasAnything) return { ok: false, error: 'nothing-to-harvest', melding: M.INGENTING_AA_HOSTE };

    const player = playerSnap.val() as { military: number; influence: number } | null;
    const now = Date.now();
    const updates: Record<string, unknown> = {
      [`games/${gameId}/regions/${regionId}/buildings/${buildingId}/pendingHarvest`]: {},
      [`games/${gameId}/regions/${regionId}/buildings/${buildingId}/lastHarvestedAt`]: now,
    };

    for (const [res, amount] of Object.entries(pending) as [ResourceType, number][]) {
      if (!amount) continue;

      if (PLAYER_RESOURCES.includes(res)) {
        const playerField = `games/${gameId}/players/${slotId}/${res}`;
        const current = (player as Record<string, number> | null)?.[res] ?? 0;
        updates[playerField] = current + amount;
      } else {
        const current = (region.resources ?? {})[res] ?? 0;
        updates[`games/${gameId}/regions/${regionId}/resources/${res}`] = current + amount;
      }
    }

    await db.ref().update(updates);
    return { ok: true };
  },
);
