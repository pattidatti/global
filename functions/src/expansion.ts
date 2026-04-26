import * as functions from 'firebase-functions/v2/https';
import { db } from './_db';
import { getAdjacency } from './_geo';
import { getRegionDefaults } from './_seed';
import { M } from './messages';
import type { ExpandRegionArgs, Region, Player, CallableResult } from './types';
import {
  DEFECTION_STREAK_REQUIRED,
  DIPLO_TAKEOVER_INFLUENCE_COST,
  INVEST_COST,
  INVEST_MAX_SAT,
  INVEST_SAT_GAIN,
  INVEST_TRADE_BOND_GAIN,
} from './expansion-logic';

const REGION = 'europe-west1';
const EXPAND_MILITARY_COST = 25;

interface InvestArgs { gameId: string; targetRegionId: string }
interface DiploTakeoverArgs { gameId: string; targetRegionId: string }

// ---------------------------------------------------------------------------
// resolveSlotId
// ---------------------------------------------------------------------------

async function resolveSlotId(gameId: string, uid: string): Promise<string | null> {
  const snap = await db.ref(`games/${gameId}/roster/${uid}`).once('value');
  return snap.exists() ? uid : null;
}

// Fjerner undefined-felter slik at en spread bevarer defaults når et felt mangler
// på targetet, men overstyrer defaults når feltet faktisk er satt.
function stripUndefined(obj: Record<string, unknown> | null | undefined): Record<string, unknown> {
  if (!obj) return {};
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined && v !== null) out[k] = v;
  }
  return out;
}

// ---------------------------------------------------------------------------
// expandRegion
// ---------------------------------------------------------------------------

export const expandRegion = functions.onCall<ExpandRegionArgs, Promise<CallableResult>>(
  { region: REGION, invoker: 'public', cors: true },
  async (req) => {
    if (!req.auth?.uid) return { ok: false, error: 'unauthenticated', melding: M.IKKE_AUTENTISERT };

    const { gameId, targetRegionId } = req.data;
    const adjacency = getAdjacency();

    const slotId = await resolveSlotId(gameId, req.auth.uid);
    if (!slotId) return { ok: false, error: 'unauthorized', melding: M.IKKE_AUTORISERT };

    const [targetSnap, playerSnap, metaSnap] = await Promise.all([
      db.ref(`games/${gameId}/regions/${targetRegionId}`).once('value'),
      db.ref(`games/${gameId}/players/${slotId}`).once('value'),
      db.ref(`games/${gameId}/meta/status`).once('value'),
    ]);

    if (metaSnap.val() !== 'active') return { ok: false, error: 'game-not-active', melding: M.SPILL_IKKE_AKTIVT };

    const target = targetSnap.val() as Region | null;
    if (!target) return { ok: false, error: 'region-not-found', melding: M.REGION_IKKE_FUNNET };
    if (target.ownerId !== null) return { ok: false, error: 'already-owned', melding: M.REGION_ALLEREDE_EIDD };

    const player = playerSnap.val() as { military: number; regionIds: string[] } | null;
    if (!player) return { ok: false, error: 'player-not-found', melding: M.IKKE_AUTENTISERT };

    // Adjacency-sjekk (hopp over ved tom adjacency-data)
    const neighbors = adjacency[targetRegionId] ?? [];
    if (neighbors.length > 0) {
      const ownsNeighbor = player.regionIds.some(id => neighbors.includes(id));
      if (!ownsNeighbor) return { ok: false, error: 'no-neighbor', melding: M.INGEN_NABOREGION };
    }

    if (player.military < EXPAND_MILITARY_COST) {
      return { ok: false, error: 'insufficient-military', melding: M.IKKE_NOK_MILITAER };
    }

    const now = Date.now();
    const eventId = crypto.randomUUID();

    const defaults = getRegionDefaults(targetRegionId, now);
    if (!defaults) return { ok: false, error: 'region-not-found', melding: M.REGION_IKKE_FUNNET };

    // Flett defaults under eksisterende target-data, overstyr eierskaps-/integrasjons-felt.
    // Slik bevares satisfaction, tradeBond, population osv. fra evt. tidligere investeringer,
    // mens manglende felt (maxSlots, biome m.m.) får riktige defaults.
    const mergedRegion: Record<string, unknown> = {
      ...defaults,
      ...stripUndefined(target as unknown as Record<string, unknown>),
      ownerId: slotId,
      integration: 0,
      integrationStartedAt: now,
      defectionStreak: null,
    };

    await db.ref().update({
      [`games/${gameId}/players/${slotId}/military`]: player.military - EXPAND_MILITARY_COST,
      [`games/${gameId}/players/${slotId}/regionIds`]: [...player.regionIds, targetRegionId],
      [`games/${gameId}/regions/${targetRegionId}`]: mergedRegion,
      [`games/${gameId}/events/${eventId}`]: { type: 'expand', slotId, targetRegionId, at: now },
    });

    return { ok: true };
  },
);

// ---------------------------------------------------------------------------
// attemptDiplomaticTakeover — bruker influence for å hoppe direkte til defection
// ---------------------------------------------------------------------------

export const attemptDiplomaticTakeover = functions.onCall<DiploTakeoverArgs, Promise<CallableResult>>(
  { region: REGION, invoker: 'public', cors: true },
  async (req) => {
    if (!req.auth?.uid) return { ok: false, error: 'unauthenticated', melding: M.IKKE_AUTENTISERT };

    const { gameId, targetRegionId } = req.data;
    const adjacency = getAdjacency();

    const slotId = await resolveSlotId(gameId, req.auth.uid);
    if (!slotId) return { ok: false, error: 'unauthorized', melding: M.IKKE_AUTORISERT };

    const [targetSnap, playerSnap, metaSnap] = await Promise.all([
      db.ref(`games/${gameId}/regions/${targetRegionId}`).once('value'),
      db.ref(`games/${gameId}/players/${slotId}`).once('value'),
      db.ref(`games/${gameId}/meta/status`).once('value'),
    ]);

    if (metaSnap.val() !== 'active') return { ok: false, error: 'game-not-active', melding: M.SPILL_IKKE_AKTIVT };

    const target = targetSnap.val() as Region | null;
    if (!target) return { ok: false, error: 'region-not-found', melding: M.REGION_IKKE_FUNNET };
    if (target.ownerId !== null) return { ok: false, error: 'not-npc', melding: M.REGION_IKKE_NPC };

    const player = playerSnap.val() as Player | null;
    if (!player) return { ok: false, error: 'player-not-found', melding: M.IKKE_AUTENTISERT };

    const neighbors = adjacency[targetRegionId] ?? [];
    if (neighbors.length > 0) {
      const ownsNeighbor = (player.regionIds ?? []).some(id => neighbors.includes(id));
      if (!ownsNeighbor) return { ok: false, error: 'no-neighbor', melding: M.INGEN_NABOREGION };
    }

    if ((player.influence ?? 0) < DIPLO_TAKEOVER_INFLUENCE_COST) {
      return { ok: false, error: 'insufficient-influence', melding: M.IKKE_NOK_INFLUENCE };
    }

    // Trekk influence og sett streak rett over terskel — defection skjer i neste tikk
    // (eller umiddelbart hvis vi vil — vi velger umiddelbart for synlig respons)
    const now = Date.now();
    const eventId = crypto.randomUUID();

    const defaults = getRegionDefaults(targetRegionId, now);
    if (!defaults) return { ok: false, error: 'region-not-found', melding: M.REGION_IKKE_FUNNET };

    const mergedRegion: Record<string, unknown> = {
      ...defaults,
      ...stripUndefined(target as unknown as Record<string, unknown>),
      ownerId: slotId,
      integration: 0,
      integrationStartedAt: now,
      defectionStreak: null,
    };

    await db.ref().update({
      [`games/${gameId}/players/${slotId}/influence`]: (player.influence ?? 0) - DIPLO_TAKEOVER_INFLUENCE_COST,
      [`games/${gameId}/players/${slotId}/regionIds`]: [...(player.regionIds ?? []), targetRegionId],
      [`games/${gameId}/regions/${targetRegionId}`]: mergedRegion,
      [`games/${gameId}/events/${eventId}`]: { type: 'diplomatic-takeover', slotId, targetRegionId, at: now },
    });

    return { ok: true };
  },
);

// ---------------------------------------------------------------------------
// investInRegion — bruker treasury for å øke NPC satisfaction + tradeBond
// ---------------------------------------------------------------------------

export const investInRegion = functions.onCall<InvestArgs, Promise<CallableResult>>(
  { region: REGION, invoker: 'public', cors: true },
  async (req) => {
    if (!req.auth?.uid) return { ok: false, error: 'unauthenticated', melding: M.IKKE_AUTENTISERT };

    const { gameId, targetRegionId } = req.data;
    const adjacency = getAdjacency();

    const slotId = await resolveSlotId(gameId, req.auth.uid);
    if (!slotId) return { ok: false, error: 'unauthorized', melding: M.IKKE_AUTORISERT };

    const [targetSnap, playerSnap, metaSnap] = await Promise.all([
      db.ref(`games/${gameId}/regions/${targetRegionId}`).once('value'),
      db.ref(`games/${gameId}/players/${slotId}`).once('value'),
      db.ref(`games/${gameId}/meta/status`).once('value'),
    ]);

    if (metaSnap.val() !== 'active') return { ok: false, error: 'game-not-active', melding: M.SPILL_IKKE_AKTIVT };

    const target = targetSnap.val() as Region | null;
    if (!target) return { ok: false, error: 'region-not-found', melding: M.REGION_IKKE_FUNNET };
    if (target.ownerId !== null) return { ok: false, error: 'not-npc', melding: M.REGION_IKKE_NPC };

    const player = playerSnap.val() as Player | null;
    if (!player) return { ok: false, error: 'player-not-found', melding: M.IKKE_AUTENTISERT };

    const neighbors = adjacency[targetRegionId] ?? [];
    if (neighbors.length > 0) {
      const ownsNeighbor = (player.regionIds ?? []).some(id => neighbors.includes(id));
      if (!ownsNeighbor) return { ok: false, error: 'no-neighbor', melding: M.INGEN_NABOREGION };
    }

    if ((player.treasury ?? 0) < INVEST_COST) {
      return { ok: false, error: 'insufficient-treasury', melding: M.IKKE_NOK_PENGER };
    }

    const newSat = Math.min(INVEST_MAX_SAT, (target.satisfaction ?? 0) + INVEST_SAT_GAIN);
    const prevBond = target.tradeBond?.[slotId] ?? 0;
    const newBond = Math.min(1, prevBond + INVEST_TRADE_BOND_GAIN);

    const now = Date.now();
    const eventId = crypto.randomUUID();
    await db.ref().update({
      [`games/${gameId}/players/${slotId}/treasury`]: (player.treasury ?? 0) - INVEST_COST,
      [`games/${gameId}/regions/${targetRegionId}/satisfaction`]: newSat,
      [`games/${gameId}/regions/${targetRegionId}/tradeBond/${slotId}`]: newBond,
      [`games/${gameId}/events/${eventId}`]: { type: 'invest', slotId, targetRegionId, at: now },
    });

    return { ok: true };
  },
);

// Re-eksporter konstanter slik at klient-koden kan importere via callable-modul
export { DEFECTION_STREAK_REQUIRED };
