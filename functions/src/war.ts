import * as functions from 'firebase-functions/v2/https';
import { db } from './_db';
import { getAdjacency } from './_geo';
import { M } from './messages';
import { pairKey } from './diplomacy-logic';
import {
  UNIT_BASE_STRENGTH,
  UNIT_COST_MILITARY,
  computeBattleStep,
} from './war-logic';

const NEIGHBOR_SATISFACTION_PENALTY = 2;
import type {
  War,
  Unit,
  Player,
  Region,
  Diplomacy,
  BattleLogEntry,
  DeclareWarArgs,
  DeployUnitsArgs,
  ProposeCeasefireArgs,
  AcceptCeasefireArgs,
  CallableResult,
} from './types';

const MAX_BATTLE_LOG_ENTRIES = 50;
const TICK_INTERVAL_MS = 10 * 60 * 1000;

const REGION = 'europe-west1';
const MAX_CONTESTED_PER_WAR = 5;

// ---------------------------------------------------------------------------
// declareWar
// ---------------------------------------------------------------------------

export const declareWar = functions.onCall<
  DeclareWarArgs,
  Promise<CallableResult<{ warId: string }>>
>({ region: REGION, invoker: 'public', cors: true }, async (req) => {
  if (!req.auth?.uid) {
    return { ok: false, error: 'unauthenticated', melding: M.IKKE_AUTENTISERT };
  }
  const { gameId, targetSlotId, contestedRegionIds } = req.data;
  const slotId = req.auth.uid;

  if (slotId === targetSlotId) {
    return { ok: false, error: 'self', melding: 'Du kan ikke erklære krig mot deg selv.' };
  }
  if (!Array.isArray(contestedRegionIds) || contestedRegionIds.length === 0) {
    return { ok: false, error: 'no_regions', melding: 'Du må velge minst én region som omstridt.' };
  }
  if (contestedRegionIds.length > MAX_CONTESTED_PER_WAR) {
    return {
      ok: false,
      error: 'too_many_regions',
      melding: `Maks ${MAX_CONTESTED_PER_WAR} omstridte regioner per krig.`,
    };
  }

  const [rosterSnap, statusSnap, targetSnap] = await Promise.all([
    db.ref(`games/${gameId}/roster/${slotId}`).once('value'),
    db.ref(`games/${gameId}/meta/status`).once('value'),
    db.ref(`games/${gameId}/roster/${targetSlotId}`).once('value'),
  ]);
  if (!rosterSnap.exists()) {
    return { ok: false, error: 'not_in_game', melding: 'Du er ikke med i dette spillet.' };
  }
  if (statusSnap.val() !== 'active') {
    return { ok: false, error: 'game_not_active', melding: M.SPILL_IKKE_AKTIVT };
  }
  if (!targetSnap.exists()) {
    return { ok: false, error: 'target_not_found', melding: 'Motparten finnes ikke.' };
  }

  // Verifiser at alle omstridte regioner faktisk eies av target
  const regionSnaps = await Promise.all(
    contestedRegionIds.map(rid => db.ref(`games/${gameId}/regions/${rid}`).once('value')),
  );
  for (let i = 0; i < regionSnaps.length; i++) {
    const region = regionSnaps[i].val() as Region | null;
    if (!region) {
      return {
        ok: false,
        error: 'region_not_found',
        melding: `Regionen ${contestedRegionIds[i]} finnes ikke.`,
      };
    }
    if (region.ownerId !== targetSlotId) {
      return {
        ok: false,
        error: 'region_not_target_owned',
        melding: `Regionen ${contestedRegionIds[i]} eies ikke av motparten.`,
      };
    }
  }

  const now = Date.now();
  const warRef = db.ref(`games/${gameId}/wars`).push();
  const warId = warRef.key!;
  const war: War = {
    attacker: slotId,
    defender: targetSlotId,
    startedAt: now,
    contestedRegionIds: [...contestedRegionIds],
    battleLog: [],
    status: 'active',
    endedAt: null,
    ceasefireProposedBy: null,
  };

  // Atomisk: opprett krig + sett contestedAt + diplomacy → war + lærervarsel
  const updates: Record<string, unknown> = {};
  updates[`games/${gameId}/wars/${warId}`] = war;
  for (const rid of contestedRegionIds) {
    updates[`games/${gameId}/regions/${rid}/contestedAt`] = now;
  }
  const dipKey = pairKey(slotId, targetSlotId);
  updates[`games/${gameId}/diplomacy/${dipKey}`] = {
    status: 'war',
    since: now,
    proposerId: null,
    notes: {},
  } satisfies Diplomacy;

  // Lærer-varsel
  const teacherEntryRef = db.ref(`games/${gameId}/teacher/log`).push();
  updates[`games/${gameId}/teacher/log/${teacherEntryRef.key}`] = {
    type: 'war_declared',
    attacker: slotId,
    defender: targetSlotId,
    warId,
    contestedRegionIds: [...contestedRegionIds],
    ts: now,
  };

  // Forbund-varsel: hvis forsvarer er i en nasjon som er i et forbund,
  // varsle læreren om at forbundet kan involveres.
  const defenderPlayerSnap = await db.ref(`games/${gameId}/players/${targetSlotId}`).once('value');
  const defenderPlayer = defenderPlayerSnap.val() as { nationId?: string | null } | null;
  if (defenderPlayer?.nationId) {
    const defenderNationSnap = await db
      .ref(`games/${gameId}/nations/${defenderPlayer.nationId}`)
      .once('value');
    const defenderNation = defenderNationSnap.val() as { leagueId?: string | null; name?: string } | null;
    if (defenderNation?.leagueId) {
      const leagueSnap = await db
        .ref(`games/${gameId}/leagues/${defenderNation.leagueId}`)
        .once('value');
      const league = leagueSnap.val() as { name?: string; memberNationIds?: string[] } | null;
      if (league) {
        const threatenedRef = db.ref(`games/${gameId}/teacher/log`).push();
        updates[`games/${gameId}/teacher/log/${threatenedRef.key}`] = {
          type: 'league_threatened',
          leagueId: defenderNation.leagueId,
          leagueName: league.name ?? '',
          attackerSlotId: slotId,
          defenderSlotId: targetSlotId,
          defenderNationName: defenderNation.name ?? '',
          warId,
          ts: now,
        };
      }
    }
  }

  await db.ref().update(updates);

  return { ok: true, data: { warId } };
});

// ---------------------------------------------------------------------------
// deployUnits — trekk player.military, opprett units i en region
// ---------------------------------------------------------------------------

export const deployUnits = functions.onCall<
  DeployUnitsArgs,
  Promise<CallableResult<{ unitIds: string[] }>>
>({ region: REGION, invoker: 'public', cors: true }, async (req) => {
  if (!req.auth?.uid) {
    return { ok: false, error: 'unauthenticated', melding: M.IKKE_AUTENTISERT };
  }
  const { gameId, regionId, unitType, count } = req.data;
  const slotId = req.auth.uid;

  if (count <= 0 || count > 10) {
    return { ok: false, error: 'invalid_count', melding: 'Antall enheter må være 1–10 per kall.' };
  }
  if (!['infantry', 'armor', 'navy'].includes(unitType)) {
    return { ok: false, error: 'invalid_type', melding: 'Ugyldig enhetstype.' };
  }

  const [rosterSnap, playerSnap, regionSnap] = await Promise.all([
    db.ref(`games/${gameId}/roster/${slotId}`).once('value'),
    db.ref(`games/${gameId}/players/${slotId}`).once('value'),
    db.ref(`games/${gameId}/regions/${regionId}`).once('value'),
  ]);
  if (!rosterSnap.exists()) {
    return { ok: false, error: 'not_in_game', melding: 'Du er ikke med i dette spillet.' };
  }
  const player = playerSnap.val() as Player | null;
  if (!player) return { ok: false, error: 'no_player', melding: M.IKKE_AUTENTISERT };

  const region = regionSnap.val() as Region | null;
  if (!region) return { ok: false, error: 'region_not_found', melding: M.REGION_IKKE_FUNNET };

  // Krever at deploy-regionen enten eies av spilleren eller er nabo til en egen region
  // For MVP: kun deploy til egne regioner
  if (region.ownerId !== slotId) {
    return {
      ok: false,
      error: 'not_own_region',
      melding: 'Du kan kun deployere til dine egne regioner.',
    };
  }

  const totalCost = count * UNIT_COST_MILITARY;
  if (player.military < totalCost) {
    return {
      ok: false,
      error: 'insufficient_military',
      melding: `Du trenger ${totalCost} militær (har ${player.military}).`,
    };
  }

  // Atomisk trekk på military
  let trekt = false;
  await db.ref(`games/${gameId}/players/${slotId}/military`).transaction((curr: number | null) => {
    const m = curr ?? 0;
    if (m < totalCost) return;
    trekt = true;
    return m - totalCost;
  });
  if (!trekt) {
    return { ok: false, error: 'race', melding: 'Militær-saldo endret seg. Prøv igjen.' };
  }

  const now = Date.now();
  const unitIds: string[] = [];
  const updates: Record<string, unknown> = {};
  for (let i = 0; i < count; i++) {
    const ref = db.ref(`games/${gameId}/units`).push();
    const unitId = ref.key!;
    unitIds.push(unitId);
    const u: Unit = {
      ownerId: slotId,
      regionId,
      type: unitType,
      strength: UNIT_BASE_STRENGTH,
      movedAt: now,
    };
    updates[`games/${gameId}/units/${unitId}`] = u;
  }
  await db.ref().update(updates);

  return { ok: true, data: { unitIds } };
});

// ---------------------------------------------------------------------------
// proposeCeasefire / acceptCeasefire
// ---------------------------------------------------------------------------

export const proposeCeasefire = functions.onCall<
  ProposeCeasefireArgs,
  Promise<CallableResult>
>({ region: REGION, invoker: 'public', cors: true }, async (req) => {
  if (!req.auth?.uid) {
    return { ok: false, error: 'unauthenticated', melding: M.IKKE_AUTENTISERT };
  }
  const { gameId, warId } = req.data;
  const slotId = req.auth.uid;

  let ok = false;
  let melding = '';
  await db.ref(`games/${gameId}/wars/${warId}`).transaction((curr: War | null) => {
    if (!curr || curr.status !== 'active') {
      melding = 'Krigen er ikke aktiv.';
      return;
    }
    if (slotId !== curr.attacker && slotId !== curr.defender) {
      melding = 'Du er ikke part i denne krigen.';
      return;
    }
    if (curr.ceasefireProposedBy === slotId) {
      melding = 'Du har allerede foreslått våpenhvile.';
      return;
    }
    ok = true;
    return { ...curr, ceasefireProposedBy: slotId };
  });

  if (!ok) {
    return { ok: false, error: 'invalid_state', melding: melding || 'Kunne ikke foreslå.' };
  }
  return { ok: true };
});

export const acceptCeasefire = functions.onCall<
  AcceptCeasefireArgs,
  Promise<CallableResult>
>({ region: REGION, invoker: 'public', cors: true }, async (req) => {
  if (!req.auth?.uid) {
    return { ok: false, error: 'unauthenticated', melding: M.IKKE_AUTENTISERT };
  }
  const { gameId, warId } = req.data;
  const slotId = req.auth.uid;

  // Hent krig + verifiser at slotId er motparten av proposer
  const warSnap = await db.ref(`games/${gameId}/wars/${warId}`).once('value');
  const war = warSnap.val() as War | null;
  if (!war) return { ok: false, error: 'war_not_found', melding: 'Krigen finnes ikke.' };
  if (war.status !== 'active') {
    return { ok: false, error: 'not_active', melding: 'Krigen er ikke aktiv.' };
  }
  if (!war.ceasefireProposedBy) {
    return { ok: false, error: 'no_proposal', melding: 'Ingen utestående våpenhvile-forslag.' };
  }
  if (war.ceasefireProposedBy === slotId) {
    return { ok: false, error: 'self_accept', melding: 'Du foreslo selv — kan ikke akseptere ditt eget.' };
  }
  if (slotId !== war.attacker && slotId !== war.defender) {
    return { ok: false, error: 'not_party', melding: 'Du er ikke part i denne krigen.' };
  }

  const now = Date.now();
  const updates: Record<string, unknown> = {};
  updates[`games/${gameId}/wars/${warId}/status`] = 'ended';
  updates[`games/${gameId}/wars/${warId}/endedAt`] = now;

  // Fjern contestedAt på alle gjenværende omstridte regioner
  for (const rid of war.contestedRegionIds) {
    updates[`games/${gameId}/regions/${rid}/contestedAt`] = null;
  }

  // Diplomacy → neutral
  const dipKey = pairKey(war.attacker, war.defender);
  updates[`games/${gameId}/diplomacy/${dipKey}/status`] = 'neutral';
  updates[`games/${gameId}/diplomacy/${dipKey}/since`] = now;

  await db.ref().update(updates);

  return { ok: true };
});

// ---------------------------------------------------------------------------
// runCombatForGame — kalles fra tick.ts hvert makro-tikk
// ---------------------------------------------------------------------------

/**
 * Per aktive krig: kjør én battleStep per omstridt region.
 * - Anvender tap på enheter (sletter de som havner på 0)
 * - Erobrer regionen hvis defender = 0 (ownerId → attacker, integration: 0)
 * - Fjerner contestedAt når regionen er avgjort
 * - Avslutter krig når contestedRegionIds er tom
 * - Lagrer battleLog (begrenset til siste N)
 */
export async function runCombatForGame(gameId: string): Promise<void> {
  const [warsSnap, unitsSnap, regionsSnap] = await Promise.all([
    db.ref(`games/${gameId}/wars`).once('value'),
    db.ref(`games/${gameId}/units`).once('value'),
    db.ref(`games/${gameId}/regions`).once('value'),
  ]);

  const wars = warsSnap.val() as Record<string, War> | null;
  if (!wars) return;
  const allUnits = (unitsSnap.val() as Record<string, Unit>) ?? {};
  const regions = (regionsSnap.val() as Record<string, Region>) ?? {};

  const adjacency = getAdjacency();

  for (const [warId, war] of Object.entries(wars)) {
    if (war.status !== 'active') continue;

    const tickIdx = Math.floor((Date.now() - war.startedAt) / TICK_INTERVAL_MS);
    const updates: Record<string, unknown> = {};
    const newBattleLog: BattleLogEntry[] = [...(war.battleLog ?? [])];
    const remainingContested: string[] = [];
    /** Akkumulert satisfaction-fall per nabo-region for denne krigen. */
    const satisfactionDelta: Record<string, number> = {};

    for (const regionId of war.contestedRegionIds) {
      const region = regions[regionId];
      if (!region) {
        remainingContested.push(regionId);
        continue;
      }

      const attackers = Object.entries(allUnits)
        .filter(([, u]) => u.ownerId === war.attacker && u.regionId === regionId && u.strength > 0)
        .map(([id, u]) => ({ id, ...u }));
      const defenders = Object.entries(allUnits)
        .filter(([, u]) => u.ownerId === war.defender && u.regionId === regionId && u.strength > 0)
        .map(([id, u]) => ({ id, ...u }));

      const result = computeBattleStep({
        warId,
        tickIdx,
        regionId,
        biome: region.biome,
        regionDefense: region.defense ?? 0,
        attackers,
        defenders,
      });

      // Skriv tilbake oppdatert strength (eller slett hvis 0)
      for (const u of result.attackers) {
        if (u.strength <= 0) {
          updates[`games/${gameId}/units/${u.id}`] = null;
        } else {
          updates[`games/${gameId}/units/${u.id}/strength`] = u.strength;
        }
      }
      for (const u of result.defenders) {
        if (u.strength <= 0) {
          updates[`games/${gameId}/units/${u.id}`] = null;
        } else {
          updates[`games/${gameId}/units/${u.id}/strength`] = u.strength;
        }
      }

      // Battle log
      newBattleLog.push({
        tick: tickIdx,
        regionId,
        attackerLoss: result.attackerLoss,
        defenderLoss: result.defenderLoss,
        ts: Date.now(),
      });

      // Naboeffekt: krig sprer uro til omkringliggende regioner. Sett av et
      // mål-delta her og anvend etter løkken slik at flere kamper i samme
      // tick akkumulerer.
      if (result.attackerLoss > 0 || result.defenderLoss > 0) {
        for (const nid of adjacency[regionId] ?? []) {
          if (regions[nid]) {
            satisfactionDelta[nid] = (satisfactionDelta[nid] ?? 0) + NEIGHBOR_SATISFACTION_PENALTY;
          }
        }
      }

      // Erobring
      if (result.conquered) {
        updates[`games/${gameId}/regions/${regionId}/ownerId`] = war.attacker;
        updates[`games/${gameId}/regions/${regionId}/integration`] = 0;
        updates[`games/${gameId}/regions/${regionId}/integrationStartedAt`] = Date.now();
        updates[`games/${gameId}/regions/${regionId}/contestedAt`] = null;
        updates[`games/${gameId}/regions/${regionId}/nationId`] = null;

        // Fjern fra defender og legg til attacker
        const defenderRegionIdsSnap = await db
          .ref(`games/${gameId}/players/${war.defender}/regionIds`)
          .once('value');
        const dRegions = (defenderRegionIdsSnap.val() as string[]) ?? [];
        updates[`games/${gameId}/players/${war.defender}/regionIds`] = dRegions.filter(r => r !== regionId);

        const attackerRegionIdsSnap = await db
          .ref(`games/${gameId}/players/${war.attacker}/regionIds`)
          .once('value');
        const aRegions = (attackerRegionIdsSnap.val() as string[]) ?? [];
        if (!aRegions.includes(regionId)) {
          updates[`games/${gameId}/players/${war.attacker}/regionIds`] = [...aRegions, regionId];
        }
      } else {
        remainingContested.push(regionId);
      }
    }

    // Trim battle log
    const trimmedLog =
      newBattleLog.length > MAX_BATTLE_LOG_ENTRIES
        ? newBattleLog.slice(-MAX_BATTLE_LOG_ENTRIES)
        : newBattleLog;

    updates[`games/${gameId}/wars/${warId}/battleLog`] = trimmedLog;
    updates[`games/${gameId}/wars/${warId}/contestedRegionIds`] = remainingContested;

    // Avslutt krig hvis ingen flere omstridte regioner
    if (remainingContested.length === 0) {
      updates[`games/${gameId}/wars/${warId}/status`] = 'ended';
      updates[`games/${gameId}/wars/${warId}/endedAt`] = Date.now();
      const dipKey = pairKey(war.attacker, war.defender);
      updates[`games/${gameId}/diplomacy/${dipKey}/status`] = 'neutral';
      updates[`games/${gameId}/diplomacy/${dipKey}/since`] = Date.now();
    }

    // Anvend nabo-satisfaction-spillover (clampet til [0, 100])
    for (const [nid, drop] of Object.entries(satisfactionDelta)) {
      const r = regions[nid];
      if (!r) continue;
      const newSat = Math.max(0, Math.min(100, (r.satisfaction ?? 0) - drop));
      updates[`games/${gameId}/regions/${nid}/satisfaction`] = newSat;
    }

    if (Object.keys(updates).length > 0) {
      await db.ref().update(updates);
    }
  }
}
