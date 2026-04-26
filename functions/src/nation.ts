import * as functions from 'firebase-functions/v2/https';
import * as path from 'path';
import * as fs from 'fs';
import { db } from './_db';
import { M } from './messages';
import {
  isContiguous,
  computeCultureMatch,
  slugifyNationName,
  MIN_REGIONS_FOR_NATION,
  MIN_CULTURE_MATCH,
} from './nation-logic';
import type {
  Nation,
  NationBonus,
  Region,
  Player,
  FormNationArgs,
  DissolveNationArgs,
  CallableResult,
} from './types';

const REGION = 'europe-west1';

// ---------------------------------------------------------------------------
// Adjacency-cache (felles med expansion.ts; egen lokal kopi for å unngå
// sirkulær import — moduldelt cache er funksjonelt likeverdig)
// ---------------------------------------------------------------------------

let adjacencyCache: Record<string, string[]> | null = null;

function getAdjacency(): Record<string, string[]> {
  if (adjacencyCache) return adjacencyCache;
  const candidates = [
    path.resolve(__dirname, '../../public/geo/adjacency.json'),
    path.resolve(__dirname, '../../../public/geo/adjacency.json'),
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) {
      adjacencyCache = JSON.parse(fs.readFileSync(p, 'utf-8')) as Record<string, string[]>;
      return adjacencyCache;
    }
  }
  console.warn('adjacency.json ikke funnet — sammenheng-validering deaktivert');
  adjacencyCache = {};
  return adjacencyCache;
}

// ---------------------------------------------------------------------------
// formNation
// ---------------------------------------------------------------------------

export const formNation = functions.onCall<FormNationArgs, Promise<CallableResult<{ nationId: string }>>>(
  { region: REGION, invoker: 'public', cors: true },
  async (req) => {
    if (!req.auth?.uid) {
      return { ok: false, error: 'unauthenticated', melding: M.IKKE_AUTENTISERT };
    }

    const { gameId, name, flag, type, color } = req.data;
    const slotId = req.auth.uid;

    if (!gameId || !name || !flag || !type) {
      return { ok: false, error: 'missing_fields', melding: 'Mangler obligatoriske felter.' };
    }

    const trimmedName = name.trim();
    if (trimmedName.length < 2 || trimmedName.length > 40) {
      return { ok: false, error: 'invalid_name', melding: 'Navnet må være 2–40 tegn.' };
    }

    const slug = slugifyNationName(trimmedName);
    if (slug.length < 2) {
      return { ok: false, error: 'invalid_name', melding: 'Navnet inneholder for få bokstaver.' };
    }

    // Hent spillstate
    const [metaSnap, playerSnap, rosterSnap] = await Promise.all([
      db.ref(`games/${gameId}/meta/status`).once('value'),
      db.ref(`games/${gameId}/players/${slotId}`).once('value'),
      db.ref(`games/${gameId}/roster/${slotId}`).once('value'),
    ]);

    if (!rosterSnap.exists()) {
      return { ok: false, error: 'not_in_game', melding: 'Du er ikke med i dette spillet.' };
    }
    if (metaSnap.val() !== 'active') {
      return { ok: false, error: 'game_not_active', melding: M.SPILL_IKKE_AKTIVT };
    }

    const player = playerSnap.val() as Player | null;
    if (!player) {
      return { ok: false, error: 'no_player', melding: M.IKKE_AUTENTISERT };
    }
    if (player.nationId) {
      return { ok: false, error: 'already_in_nation', melding: 'Du har allerede en nasjon.' };
    }
    if ((player.regionIds ?? []).length < MIN_REGIONS_FOR_NATION) {
      return {
        ok: false,
        error: 'not_enough_regions',
        melding: `En nasjon krever minst ${MIN_REGIONS_FOR_NATION} regioner.`,
      };
    }

    // Hent region-data for kulturmatch og sammenheng
    const regionSnaps = await Promise.all(
      player.regionIds.map(rid => db.ref(`games/${gameId}/regions/${rid}`).once('value')),
    );
    const regions = regionSnaps
      .map(s => s.val() as Region | null)
      .filter((r): r is Region => r !== null);

    if (regions.length !== player.regionIds.length) {
      return { ok: false, error: 'regions_missing', melding: 'En eller flere regioner mangler i spillet.' };
    }

    const adjacency = getAdjacency();
    if (Object.keys(adjacency).length > 0 && !isContiguous(player.regionIds, adjacency)) {
      return {
        ok: false,
        error: 'not_contiguous',
        melding: 'Regionene må være sammenhengende.',
      };
    }

    const { dominantCulture, matchPct } = computeCultureMatch(regions);
    if (matchPct < MIN_CULTURE_MATCH) {
      return {
        ok: false,
        error: 'low_culture_match',
        melding: `Minst ${Math.round(MIN_CULTURE_MATCH * 100)} % av regionene må dele én kulturgruppe (du har ${Math.round(matchPct * 100)} %).`,
      };
    }

    // Atomisk reservasjon av nasjonen — første som vinner får navnet
    const nationId = `nation_${slug}`;
    const now = Date.now();
    const bonus: NationBonus = { production: 0.1, prestige: 100 };

    const nation: Nation = {
      founderId: slotId,
      name: trimmedName,
      flag,
      type,
      cultureMatch: matchPct,
      dominantCulture,
      color: color || 'hsl(210, 60%, 50%)',
      bonus,
      members: [slotId],
      formedAt: now,
    };

    let reserved = false;
    await db.ref(`games/${gameId}/nations/${nationId}`).transaction((curr: Nation | null) => {
      if (curr !== null) return; // navnet er tatt — abort
      reserved = true;
      return nation;
    });

    if (!reserved) {
      return { ok: false, error: 'name_taken', melding: 'Navnet er allerede i bruk.' };
    }

    // Oppdater player + alle regioner med nationId, og inkrementer nationCount
    const update: Record<string, unknown> = {};
    update[`games/${gameId}/players/${slotId}/nationId`] = nationId;
    for (const rid of player.regionIds) {
      update[`games/${gameId}/regions/${rid}/nationId`] = nationId;
    }

    const teacherEntryRef = db.ref(`games/${gameId}/teacher/log`).push();
    update[`games/${gameId}/teacher/log/${teacherEntryRef.key}`] = {
      type: 'nation_formed',
      slotId,
      nationId,
      name: trimmedName,
      flag,
      ts: now,
    };

    await db.ref().update(update);

    await db.ref(`games/${gameId}/meta/nationCount`).transaction(
      (current: number | null) => (current ?? 0) + 1,
    );

    return { ok: true, data: { nationId } };
  },
);

// ---------------------------------------------------------------------------
// dissolveNation
// ---------------------------------------------------------------------------

export const dissolveNation = functions.onCall<DissolveNationArgs, Promise<CallableResult>>(
  { region: REGION, invoker: 'public', cors: true },
  async (req) => {
    if (!req.auth?.uid) {
      return { ok: false, error: 'unauthenticated', melding: M.IKKE_AUTENTISERT };
    }

    const { gameId, nationId } = req.data;
    const slotId = req.auth.uid;

    const nationSnap = await db.ref(`games/${gameId}/nations/${nationId}`).once('value');
    const nation = nationSnap.val() as Nation | null;
    if (!nation) {
      return { ok: false, error: 'nation_not_found', melding: 'Nasjonen ble ikke funnet.' };
    }
    if (nation.founderId !== slotId) {
      return { ok: false, error: 'not_founder', melding: 'Bare grunnleggeren kan oppløse nasjonen.' };
    }

    // Finn alle medlemmer og deres regioner
    const memberSnaps = await Promise.all(
      nation.members.map(mid => db.ref(`games/${gameId}/players/${mid}`).once('value')),
    );

    const update: Record<string, unknown> = {};
    update[`games/${gameId}/nations/${nationId}`] = null;

    for (const memberSnap of memberSnaps) {
      const memberSlot = memberSnap.key!;
      const memberPlayer = memberSnap.val() as Player | null;
      if (!memberPlayer) continue;

      update[`games/${gameId}/players/${memberSlot}/nationId`] = null;
      for (const rid of memberPlayer.regionIds ?? []) {
        update[`games/${gameId}/regions/${rid}/nationId`] = null;
      }
    }

    const teacherEntryRef = db.ref(`games/${gameId}/teacher/log`).push();
    update[`games/${gameId}/teacher/log/${teacherEntryRef.key}`] = {
      type: 'nation_dissolved',
      slotId,
      nationId,
      name: nation.name,
      ts: Date.now(),
    };

    await db.ref().update(update);

    await db.ref(`games/${gameId}/meta/nationCount`).transaction(
      (current: number | null) => Math.max(0, (current ?? 0) - 1),
    );

    return { ok: true };
  },
);
