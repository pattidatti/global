import * as functions from 'firebase-functions/v2/https';
import { db } from './_db';
import { M } from './messages';
import { slugifyLeagueName } from './league-logic';
import type {
  League,
  Nation,
  CreateLeagueArgs,
  InviteNationToLeagueArgs,
  AcceptLeagueInviteArgs,
  LeaveLeagueArgs,
  DissolveLeagueArgs,
  CallableResult,
} from './types';

const REGION = 'europe-west1';

async function findNationOwnedBy(
  gameId: string,
  slotId: string,
): Promise<{ nationId: string; nation: Nation } | null> {
  const snap = await db.ref(`games/${gameId}/nations`).once('value');
  const nations = snap.val() as Record<string, Nation> | null;
  if (!nations) return null;
  for (const [nationId, nation] of Object.entries(nations)) {
    if (nation.founderId === slotId) return { nationId, nation };
  }
  return null;
}

async function assertGameActive(gameId: string): Promise<CallableResult | null> {
  const snap = await db.ref(`games/${gameId}/meta/status`).once('value');
  if (snap.val() !== 'active') {
    return { ok: false, error: 'game_not_active', melding: M.SPILL_IKKE_AKTIVT };
  }
  return null;
}

// ---------------------------------------------------------------------------
// createLeague
// ---------------------------------------------------------------------------

export const createLeague = functions.onCall<
  CreateLeagueArgs,
  Promise<CallableResult<{ leagueId: string }>>
>({ region: REGION, invoker: 'public', cors: true }, async (req) => {
  if (!req.auth?.uid) {
    return { ok: false, error: 'unauthenticated', melding: M.IKKE_AUTENTISERT };
  }

  const { gameId, name } = req.data;
  const slotId = req.auth.uid;

  const trimmed = (name ?? '').trim();
  if (trimmed.length < 2 || trimmed.length > 40) {
    return { ok: false, error: 'invalid_name', melding: 'Navnet må være 2–40 tegn.' };
  }
  const slug = slugifyLeagueName(trimmed);
  if (slug.length < 2) {
    return { ok: false, error: 'invalid_name', melding: 'Navnet inneholder for få bokstaver.' };
  }

  const guard = await assertGameActive(gameId);
  if (guard) return guard;

  const found = await findNationOwnedBy(gameId, slotId);
  if (!found) {
    return { ok: false, error: 'no_nation', melding: 'Du må være grunnlegger av en nasjon for å opprette forbund.' };
  }
  if (found.nation.leagueId) {
    return { ok: false, error: 'already_in_league', melding: 'Nasjonen din er allerede i et forbund.' };
  }

  const leagueId = `league_${slug}`;
  const now = Date.now();
  const league: League = {
    name: trimmed,
    founderNationId: found.nationId,
    memberNationIds: [found.nationId],
    charter: 'defense_pact',
    formedAt: now,
  };

  let reserved = false;
  await db.ref(`games/${gameId}/leagues/${leagueId}`).transaction((curr: League | null) => {
    if (curr !== null) return;
    reserved = true;
    return league;
  });
  if (!reserved) {
    return { ok: false, error: 'name_taken', melding: 'Forbundnavnet er allerede i bruk.' };
  }

  const updates: Record<string, unknown> = {};
  updates[`games/${gameId}/nations/${found.nationId}/leagueId`] = leagueId;

  const logRef = db.ref(`games/${gameId}/teacher/log`).push();
  updates[`games/${gameId}/teacher/log/${logRef.key}`] = {
    type: 'league_formed',
    leagueId,
    name: trimmed,
    founderNationId: found.nationId,
    ts: now,
  };

  await db.ref().update(updates);

  return { ok: true, data: { leagueId } };
});

// ---------------------------------------------------------------------------
// inviteNationToLeague — kun grunnlegger
// ---------------------------------------------------------------------------

export const inviteNationToLeague = functions.onCall<
  InviteNationToLeagueArgs,
  Promise<CallableResult>
>({ region: REGION, invoker: 'public', cors: true }, async (req) => {
  if (!req.auth?.uid) {
    return { ok: false, error: 'unauthenticated', melding: M.IKKE_AUTENTISERT };
  }
  const { gameId, leagueId, targetNationId } = req.data;
  const slotId = req.auth.uid;

  const guard = await assertGameActive(gameId);
  if (guard) return guard;

  const [leagueSnap, targetSnap] = await Promise.all([
    db.ref(`games/${gameId}/leagues/${leagueId}`).once('value'),
    db.ref(`games/${gameId}/nations/${targetNationId}`).once('value'),
  ]);

  const league = leagueSnap.val() as League | null;
  if (!league) {
    return { ok: false, error: 'league_not_found', melding: 'Forbundet ble ikke funnet.' };
  }

  const founderNationSnap = await db.ref(`games/${gameId}/nations/${league.founderNationId}`).once('value');
  const founderNation = founderNationSnap.val() as Nation | null;
  if (!founderNation || founderNation.founderId !== slotId) {
    return { ok: false, error: 'not_founder', melding: 'Bare forbundets grunnlegger kan invitere.' };
  }

  const targetNation = targetSnap.val() as Nation | null;
  if (!targetNation) {
    return { ok: false, error: 'target_not_found', melding: 'Mål-nasjonen finnes ikke.' };
  }
  if (league.memberNationIds.includes(targetNationId)) {
    return { ok: false, error: 'already_member', melding: 'Nasjonen er allerede medlem.' };
  }
  if (targetNation.leagueId) {
    return { ok: false, error: 'target_in_league', melding: 'Nasjonen er allerede i et annet forbund.' };
  }

  await db.ref(`games/${gameId}/leagues/${leagueId}/pendingInvites/${targetNationId}`).set({
    invitedAt: Date.now(),
    invitedBy: slotId,
  });

  return { ok: true };
});

// ---------------------------------------------------------------------------
// acceptLeagueInvite — kun nasjonens grunnlegger
// ---------------------------------------------------------------------------

export const acceptLeagueInvite = functions.onCall<
  AcceptLeagueInviteArgs,
  Promise<CallableResult>
>({ region: REGION, invoker: 'public', cors: true }, async (req) => {
  if (!req.auth?.uid) {
    return { ok: false, error: 'unauthenticated', melding: M.IKKE_AUTENTISERT };
  }
  const { gameId, leagueId, nationId } = req.data;
  const slotId = req.auth.uid;

  const guard = await assertGameActive(gameId);
  if (guard) return guard;

  const [leagueSnap, nationSnap] = await Promise.all([
    db.ref(`games/${gameId}/leagues/${leagueId}`).once('value'),
    db.ref(`games/${gameId}/nations/${nationId}`).once('value'),
  ]);

  const league = leagueSnap.val() as League | null;
  if (!league) {
    return { ok: false, error: 'league_not_found', melding: 'Forbundet ble ikke funnet.' };
  }
  const nation = nationSnap.val() as Nation | null;
  if (!nation) {
    return { ok: false, error: 'nation_not_found', melding: 'Nasjonen ble ikke funnet.' };
  }
  if (nation.founderId !== slotId) {
    return { ok: false, error: 'not_founder', melding: 'Kun nasjonens grunnlegger kan godta invitasjoner.' };
  }
  if (nation.leagueId) {
    return { ok: false, error: 'already_in_league', melding: 'Nasjonen din er allerede i et forbund.' };
  }
  if (!league.pendingInvites?.[nationId]) {
    return { ok: false, error: 'no_invite', melding: 'Ingen aktiv invitasjon funnet.' };
  }

  const now = Date.now();
  const updates: Record<string, unknown> = {};
  updates[`games/${gameId}/leagues/${leagueId}/memberNationIds`] = [
    ...league.memberNationIds,
    nationId,
  ];
  updates[`games/${gameId}/leagues/${leagueId}/pendingInvites/${nationId}`] = null;
  updates[`games/${gameId}/nations/${nationId}/leagueId`] = leagueId;

  const logRef = db.ref(`games/${gameId}/teacher/log`).push();
  updates[`games/${gameId}/teacher/log/${logRef.key}`] = {
    type: 'league_member_joined',
    leagueId,
    leagueName: league.name,
    nationId,
    nationName: nation.name,
    ts: now,
  };

  await db.ref().update(updates);

  return { ok: true };
});

// ---------------------------------------------------------------------------
// leaveLeague — nasjonens grunnlegger forlater
// ---------------------------------------------------------------------------

export const leaveLeague = functions.onCall<
  LeaveLeagueArgs,
  Promise<CallableResult>
>({ region: REGION, invoker: 'public', cors: true }, async (req) => {
  if (!req.auth?.uid) {
    return { ok: false, error: 'unauthenticated', melding: M.IKKE_AUTENTISERT };
  }
  const { gameId, leagueId, nationId } = req.data;
  const slotId = req.auth.uid;

  const [leagueSnap, nationSnap] = await Promise.all([
    db.ref(`games/${gameId}/leagues/${leagueId}`).once('value'),
    db.ref(`games/${gameId}/nations/${nationId}`).once('value'),
  ]);

  const league = leagueSnap.val() as League | null;
  if (!league) {
    return { ok: false, error: 'league_not_found', melding: 'Forbundet ble ikke funnet.' };
  }
  const nation = nationSnap.val() as Nation | null;
  if (!nation) {
    return { ok: false, error: 'nation_not_found', melding: 'Nasjonen ble ikke funnet.' };
  }
  if (nation.founderId !== slotId) {
    return { ok: false, error: 'not_founder', melding: 'Kun nasjonens grunnlegger kan forlate forbund.' };
  }
  if (!league.memberNationIds.includes(nationId)) {
    return { ok: false, error: 'not_member', melding: 'Nasjonen er ikke medlem av forbundet.' };
  }

  const now = Date.now();
  const updates: Record<string, unknown> = {};

  // Founder forlater → oppløs hele forbundet
  if (nationId === league.founderNationId) {
    return await dissolveLeagueInternal(gameId, leagueId, league, now);
  }

  const remaining = league.memberNationIds.filter(id => id !== nationId);
  updates[`games/${gameId}/leagues/${leagueId}/memberNationIds`] = remaining;
  updates[`games/${gameId}/nations/${nationId}/leagueId`] = null;

  const logRef = db.ref(`games/${gameId}/teacher/log`).push();
  updates[`games/${gameId}/teacher/log/${logRef.key}`] = {
    type: 'league_member_left',
    leagueId,
    leagueName: league.name,
    nationId,
    nationName: nation.name,
    ts: now,
  };

  await db.ref().update(updates);
  return { ok: true };
});

// ---------------------------------------------------------------------------
// dissolveLeague — kun grunnlegger
// ---------------------------------------------------------------------------

export const dissolveLeague = functions.onCall<
  DissolveLeagueArgs,
  Promise<CallableResult>
>({ region: REGION, invoker: 'public', cors: true }, async (req) => {
  if (!req.auth?.uid) {
    return { ok: false, error: 'unauthenticated', melding: M.IKKE_AUTENTISERT };
  }
  const { gameId, leagueId } = req.data;
  const slotId = req.auth.uid;

  const leagueSnap = await db.ref(`games/${gameId}/leagues/${leagueId}`).once('value');
  const league = leagueSnap.val() as League | null;
  if (!league) {
    return { ok: false, error: 'league_not_found', melding: 'Forbundet ble ikke funnet.' };
  }

  const founderNationSnap = await db.ref(`games/${gameId}/nations/${league.founderNationId}`).once('value');
  const founderNation = founderNationSnap.val() as Nation | null;
  if (!founderNation || founderNation.founderId !== slotId) {
    return { ok: false, error: 'not_founder', melding: 'Kun grunnleggeren kan oppløse forbundet.' };
  }

  return await dissolveLeagueInternal(gameId, leagueId, league, Date.now());
});

async function dissolveLeagueInternal(
  gameId: string,
  leagueId: string,
  league: League,
  now: number,
): Promise<CallableResult> {
  const updates: Record<string, unknown> = {};
  updates[`games/${gameId}/leagues/${leagueId}`] = null;
  for (const memberId of league.memberNationIds) {
    updates[`games/${gameId}/nations/${memberId}/leagueId`] = null;
  }
  const logRef = db.ref(`games/${gameId}/teacher/log`).push();
  updates[`games/${gameId}/teacher/log/${logRef.key}`] = {
    type: 'league_dissolved',
    leagueId,
    name: league.name,
    ts: now,
  };
  await db.ref().update(updates);
  return { ok: true };
}
