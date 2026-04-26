import * as functions from 'firebase-functions/v2/https';
import { db } from './_db';
import { getRegionDefaults } from './_seed';
import { M } from './messages';
import type { GameMeta, RosterSlot, Player, CallableResult } from './types';

const SCHEMA_VERSION = 1;
const REGION = 'europe-west1';

// Genererer 150 distinkte imperiumfarger via golden-ratio HSL
const GOLDEN_RATIO = 0.6180339887;
function generateEmpireColors(): string[] {
  const colors: string[] = [];
  let h = 0;
  for (let i = 0; i < 150; i++) {
    h = (h + GOLDEN_RATIO) % 1;
    colors.push(`hsl(${Math.round(h * 360)}, 70%, 45%)`);
  }
  return colors;
}
const EMPIRE_COLORS = generateEmpireColors();

// ─── createGame ──────────────────────────────────────────────────────────────

interface CreateGameRequest {
  name?: string;
}

interface CreateGameData {
  gameId: string;
}

export const createGame = functions.onCall<
  CreateGameRequest,
  Promise<CallableResult<CreateGameData>>
>(
  { region: REGION, invoker: 'public', cors: true },
  async (req) => {
    if (!req.auth?.uid) {
      return { ok: false, error: 'unauthenticated', melding: 'Logg inn som lærer først.' };
    }

    const gameRef = db.ref('games').push();
    const gameId = gameRef.key!;
    const now = Date.now();
    const serverName = req.data.name?.trim() || 'Geopolity-server';
    const teacherName = (req.auth.token as Record<string, unknown>).name as string | undefined ?? req.auth.uid;

    const meta: GameMeta = {
      teacherId: req.auth.uid,
      createdAt: now,
      status: 'active',
      unFormed: false,
      nationCount: 0,
      schemaVersion: SCHEMA_VERSION,
      lastMacroTickAt: now,
    };

    await db.ref(`games/${gameId}`).set({ meta });
    await db.ref(`serverList/${gameId}`).set({
      name: serverName,
      teacherName,
      teacherId: req.auth.uid,
      status: 'active',
      playerCount: 0,
      createdAt: now,
    });

    return { ok: true, data: { gameId } };
  },
);

// ─── joinGame ─────────────────────────────────────────────────────────────────

interface JoinGameRequest {
  gameId: string;
}

interface JoinGameData {
  gameId: string;
  slotId: string;
}

export const joinGame = functions.onCall<
  JoinGameRequest,
  Promise<CallableResult<JoinGameData>>
>(
  { region: REGION, invoker: 'public', cors: true },
  async (req) => {
    if (!req.auth?.uid) {
      return { ok: false, error: 'unauthenticated', melding: 'Autentisering mangler.' };
    }

    const { gameId } = req.data;
    if (!gameId) {
      return { ok: false, error: 'missing_fields', melding: 'Spill-ID mangler.' };
    }

    const metaSnap = await db.ref(`games/${gameId}/meta`).once('value');
    const meta = metaSnap.val() as GameMeta | null;
    if (!meta || meta.status !== 'active') {
      return { ok: false, error: 'game_not_active', melding: 'Spillet er ikke aktivt.' };
    }

    const slotId = req.auth.uid;
    const displayName = (req.auth.token as Record<string, unknown>).name as string | undefined ?? 'Spiller';
    const now = Date.now();

    const existingSlotSnap = await db.ref(`games/${gameId}/roster/${slotId}`).once('value');
    const isRejoin = existingSlotSnap.exists();

    if (isRejoin) {
      await db.ref(`games/${gameId}/roster/${slotId}`).update({ joinedAt: now });
      await db.ref(`games/${gameId}/players/${slotId}`).update({ lastSeenAt: now });
    } else {
      const slot: RosterSlot = {
        displayName,
        createdAt: now,
        joinedAt: now,
      };
      await db.ref(`games/${gameId}/roster/${slotId}`).set(slot);

      const player: Player = {
        displayName,
        empireColor: '',
        empireColorIdx: -1,
        treasury: 500,
        influence: 0,
        military: 50,
        regionIds: [],
        nationId: null,
        joinedAt: now,
        lastSeenAt: now,
      };
      await db.ref(`games/${gameId}/players/${slotId}`).set(player);

      await db.ref(`serverList/${gameId}/playerCount`).transaction(
        (current: number | null) => (current ?? 0) + 1,
      );
    }

    return { ok: true, data: { gameId, slotId } };
  },
);

// ─── pickStartRegion ──────────────────────────────────────────────────────────

interface PickStartRegionRequest {
  gameId: string;
  regionId: string;
  prevRegionId?: string;
}

interface PickStartRegionData {
  availableColorIndices: number[];
}

export const pickStartRegion = functions.onCall<
  PickStartRegionRequest,
  Promise<CallableResult<PickStartRegionData>>
>(
  { region: REGION, invoker: 'public', cors: true },
  async (req) => {
    if (!req.auth?.uid) {
      return { ok: false, error: 'unauthenticated', melding: 'Ikke autentisert.' };
    }

    const { gameId, regionId } = req.data;
    const slotId = req.auth.uid;

    const rosterSnap = await db.ref(`games/${gameId}/roster/${slotId}`).once('value');
    if (!rosterSnap.exists()) {
      return { ok: false, error: 'not_in_game', melding: 'Du er ikke med i dette spillet.' };
    }

    const existingRegionsSnap = await db.ref(`games/${gameId}/players/${slotId}/regionIds`).once('value');
    const existingRegions: string[] = existingRegionsSnap.val() ?? [];
    if (existingRegions.length > 0) {
      return { ok: false, error: 'already_has_region', melding: 'Du har allerede valgt en startregion.' };
    }

    const { prevRegionId } = req.data;
    if (prevRegionId && prevRegionId !== regionId) {
      const prevOwnerSnap = await db.ref(`games/${gameId}/regions/${prevRegionId}/ownerId`).once('value');
      if (prevOwnerSnap.val() === slotId) {
        await db.ref(`games/${gameId}/regions/${prevRegionId}/ownerId`).set(null);
      }
    }

    // Sjekk at regionen ikke er tatt av en annen spiller
    const regionSnap = await db.ref(`games/${gameId}/regions/${regionId}`).once('value');
    const region = regionSnap.val() as { ownerId: string | null } | null;
    if (region?.ownerId && region.ownerId !== slotId) {
      return { ok: false, error: 'region_taken', melding: 'Denne regionen er allerede tatt.' };
    }

    // Atomisk reservasjon via transaction (tillat re-pick av egen region)
    let reserved = false;
    await db.ref(`games/${gameId}/regions/${regionId}/ownerId`).transaction(current => {
      if (current !== null && current !== slotId) return; // aborterer hvis tatt av annen
      reserved = true;
      return slotId;
    });

    if (!reserved) {
      return { ok: false, error: 'region_taken', melding: 'Regionen ble tatt av en annen spiller akkurat nå. Velg en annen.' };
    }

    // Hent brukte fargeindekser
    const usedColorsSnap = await db.ref(`games/${gameId}/usedColors`).once('value');
    const usedColors = usedColorsSnap.val() as Record<string, string> | null;
    const usedIndices = usedColors ? Object.keys(usedColors).map(Number) : [];

    // Returner 6 ledige farger for klienten å velge blant
    const available = Array.from({ length: 150 }, (_, i) => i)
      .filter(i => !usedIndices.includes(i))
      .slice(0, 6);

    if (available.length === 0) {
      return { ok: false, error: 'no_colors', melding: 'Ingen ledige imperiumfarger.' };
    }

    return { ok: true, data: { availableColorIndices: available } };
  },
);

// ─── confirmEmpireColor ────────────────────────────────────────────────────────

interface ConfirmEmpireColorRequest {
  gameId: string;
  regionId: string;
  empireColorIdx: number;
}

export const confirmEmpireColor = functions.onCall<
  ConfirmEmpireColorRequest,
  Promise<CallableResult>
>(
  { region: REGION, invoker: 'public', cors: true },
  async (req) => {
    if (!req.auth?.uid) {
      return { ok: false, error: 'unauthenticated', melding: 'Ikke autentisert.' };
    }

    const { gameId, regionId, empireColorIdx } = req.data;
    const slotId = req.auth.uid;

    const rosterSnap = await db.ref(`games/${gameId}/roster/${slotId}`).once('value');
    if (!rosterSnap.exists()) {
      return { ok: false, error: 'not_in_game', melding: 'Ikke med i spillet.' };
    }

    const existingRegionsSnap = await db.ref(`games/${gameId}/players/${slotId}/regionIds`).once('value');
    const existingRegions: string[] = existingRegionsSnap.val() ?? [];
    if (existingRegions.length > 0) {
      return { ok: false, error: 'already_has_region', melding: 'Du har allerede valgt en startregion.' };
    }

    if (empireColorIdx < 0 || empireColorIdx >= 150) {
      return { ok: false, error: 'invalid_color', melding: 'Ugyldig fargeindeks.' };
    }

    // Atomisk reservasjon av farge
    let colorReserved = false;
    await db.ref(`games/${gameId}/usedColors/${empireColorIdx}`).transaction(current => {
      if (current !== null) return; // allerede tatt
      colorReserved = true;
      return slotId;
    });

    if (!colorReserved) {
      return { ok: false, error: 'color_taken', melding: 'Denne fargen ble tatt av en annen spiller. Velg en annen.' };
    }

    const empireColor = EMPIRE_COLORS[empireColorIdx];

    await db.ref(`games/${gameId}/players/${slotId}`).update({
      empireColor,
      empireColorIdx,
    });

    const now = Date.now();
    const defaults = getRegionDefaults(regionId, now);
    if (!defaults) {
      return { ok: false, error: 'region-not-found', melding: M.REGION_IKKE_FUNNET };
    }

    await db.ref(`games/${gameId}/regions/${regionId}`).update({
      ...defaults,
      ownerId: slotId,
      integration: 100,
      integrationStartedAt: null,
    });

    await db.ref(`games/${gameId}/players/${slotId}/regionIds`).transaction(
      (current: string[] | null) => [...(current ?? []), regionId],
    );

    return { ok: true };
  },
);
