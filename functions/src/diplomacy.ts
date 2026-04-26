import * as functions from 'firebase-functions/v2/https';
import { db } from './_db';
import { M } from './messages';
import { pairKey, canTransition } from './diplomacy-logic';
import type {
  Diplomacy,
  DiplomaticNote,
  ProposeAllianceArgs,
  AcceptAllianceArgs,
  BreakAllianceArgs,
  SendDiplomaticNoteArgs,
  CallableResult,
} from './types';

const REGION = 'europe-west1';

// ---------------------------------------------------------------------------
// Felles guard: spillet må være aktivt + slot må eksistere
// ---------------------------------------------------------------------------

async function assertSlotInActiveGame(
  gameId: string,
  slotId: string,
): Promise<CallableResult | null> {
  const [rosterSnap, statusSnap] = await Promise.all([
    db.ref(`games/${gameId}/roster/${slotId}`).once('value'),
    db.ref(`games/${gameId}/meta/status`).once('value'),
  ]);
  if (!rosterSnap.exists()) {
    return { ok: false, error: 'not_in_game', melding: 'Du er ikke med i dette spillet.' };
  }
  if (statusSnap.val() !== 'active') {
    return { ok: false, error: 'game_not_active', melding: M.SPILL_IKKE_AKTIVT };
  }
  const targetRosterSnap = await db.ref(`games/${gameId}/roster`).once('value');
  if (!targetRosterSnap.exists()) {
    return { ok: false, error: 'no_roster', melding: 'Spillet har ikke roster.' };
  }
  return null;
}

async function assertTargetExists(gameId: string, targetSlotId: string): Promise<CallableResult | null> {
  const snap = await db.ref(`games/${gameId}/roster/${targetSlotId}`).once('value');
  if (!snap.exists()) {
    return { ok: false, error: 'target_not_found', melding: 'Mottakeren finnes ikke i spillet.' };
  }
  return null;
}

// ---------------------------------------------------------------------------
// proposeAlliance — setter pending-alliance og noterer proposerId
// ---------------------------------------------------------------------------

export const proposeAlliance = functions.onCall<
  ProposeAllianceArgs,
  Promise<CallableResult>
>({ region: REGION, invoker: 'public', cors: true }, async (req) => {
  if (!req.auth?.uid) {
    return { ok: false, error: 'unauthenticated', melding: M.IKKE_AUTENTISERT };
  }
  const { gameId, targetSlotId } = req.data;
  const slotId = req.auth.uid;
  if (slotId === targetSlotId) {
    return { ok: false, error: 'self', melding: 'Du kan ikke foreslå allianse med deg selv.' };
  }

  const guard = await assertSlotInActiveGame(gameId, slotId);
  if (guard) return guard;
  const targetGuard = await assertTargetExists(gameId, targetSlotId);
  if (targetGuard) return targetGuard;

  const key = pairKey(slotId, targetSlotId);
  const now = Date.now();

  let ok = false;
  let melding = '';
  await db.ref(`games/${gameId}/diplomacy/${key}`).transaction((curr: Diplomacy | null) => {
    const from = curr?.status ?? 'neutral';
    if (!canTransition(from, 'pending-alliance')) {
      melding = `Ugyldig overgang fra ${from}.`;
      return; // avbryt
    }
    if (from === 'pending-alliance' && curr?.proposerId === slotId) {
      melding = 'Du har allerede et utestående forslag.';
      return;
    }
    ok = true;
    return {
      status: 'pending-alliance' as const,
      since: now,
      proposerId: slotId,
      notes: curr?.notes ?? {},
    };
  });

  if (!ok) {
    return { ok: false, error: 'invalid_transition', melding: melding || 'Forslag avvist.' };
  }
  return { ok: true };
});

// ---------------------------------------------------------------------------
// acceptAlliance — kun mottaker kan akseptere
// ---------------------------------------------------------------------------

export const acceptAlliance = functions.onCall<
  AcceptAllianceArgs,
  Promise<CallableResult>
>({ region: REGION, invoker: 'public', cors: true }, async (req) => {
  if (!req.auth?.uid) {
    return { ok: false, error: 'unauthenticated', melding: M.IKKE_AUTENTISERT };
  }
  const { gameId, targetSlotId } = req.data;
  const slotId = req.auth.uid;
  if (slotId === targetSlotId) {
    return { ok: false, error: 'self', melding: 'Ugyldig motpart.' };
  }

  const guard = await assertSlotInActiveGame(gameId, slotId);
  if (guard) return guard;

  const key = pairKey(slotId, targetSlotId);
  const now = Date.now();

  let ok = false;
  let melding = '';
  await db.ref(`games/${gameId}/diplomacy/${key}`).transaction((curr: Diplomacy | null) => {
    if (!curr || curr.status !== 'pending-alliance') {
      melding = 'Ingen utestående allianseforslag å akseptere.';
      return;
    }
    if (curr.proposerId === slotId) {
      melding = 'Du foreslo selv — kan ikke akseptere ditt eget.';
      return;
    }
    ok = true;
    return {
      ...curr,
      status: 'alliance' as const,
      since: now,
      proposerId: null,
    };
  });

  if (!ok) {
    return { ok: false, error: 'invalid_state', melding: melding || 'Kunne ikke akseptere.' };
  }
  return { ok: true };
});

// ---------------------------------------------------------------------------
// breakAlliance — ensidig brudd; status → neutral
// ---------------------------------------------------------------------------

export const breakAlliance = functions.onCall<
  BreakAllianceArgs,
  Promise<CallableResult>
>({ region: REGION, invoker: 'public', cors: true }, async (req) => {
  if (!req.auth?.uid) {
    return { ok: false, error: 'unauthenticated', melding: M.IKKE_AUTENTISERT };
  }
  const { gameId, targetSlotId } = req.data;
  const slotId = req.auth.uid;
  if (slotId === targetSlotId) {
    return { ok: false, error: 'self', melding: 'Ugyldig motpart.' };
  }

  const guard = await assertSlotInActiveGame(gameId, slotId);
  if (guard) return guard;

  const key = pairKey(slotId, targetSlotId);
  const now = Date.now();

  let ok = false;
  let melding = '';
  await db.ref(`games/${gameId}/diplomacy/${key}`).transaction((curr: Diplomacy | null) => {
    if (!curr) {
      melding = 'Det er ingen relasjon å bryte.';
      return;
    }
    // Tillat brudd fra alliance og pending-alliance (avbryt forslag)
    if (curr.status !== 'alliance' && curr.status !== 'pending-alliance') {
      melding = `Kan ikke bryte fra status ${curr.status}.`;
      return;
    }
    ok = true;
    return {
      ...curr,
      status: 'neutral' as const,
      since: now,
      proposerId: null,
    };
  });

  if (!ok) {
    return { ok: false, error: 'invalid_state', melding: melding || 'Kunne ikke bryte.' };
  }
  return { ok: true };
});

// ---------------------------------------------------------------------------
// sendDiplomaticNote — append til diplomacy/{key}/notes
// ---------------------------------------------------------------------------

const MAX_NOTE_LENGTH = 280;
const MAX_NOTES_PER_PAIR = 50;

export const sendDiplomaticNote = functions.onCall<
  SendDiplomaticNoteArgs,
  Promise<CallableResult>
>({ region: REGION, invoker: 'public', cors: true }, async (req) => {
  if (!req.auth?.uid) {
    return { ok: false, error: 'unauthenticated', melding: M.IKKE_AUTENTISERT };
  }
  const { gameId, targetSlotId, text } = req.data;
  const slotId = req.auth.uid;

  if (slotId === targetSlotId) {
    return { ok: false, error: 'self', melding: 'Du kan ikke sende deg selv en note.' };
  }
  const trimmed = (text ?? '').trim();
  if (trimmed.length === 0 || trimmed.length > MAX_NOTE_LENGTH) {
    return {
      ok: false,
      error: 'invalid_text',
      melding: `Noten må være mellom 1 og ${MAX_NOTE_LENGTH} tegn.`,
    };
  }

  const guard = await assertSlotInActiveGame(gameId, slotId);
  if (guard) return guard;
  const targetGuard = await assertTargetExists(gameId, targetSlotId);
  if (targetGuard) return targetGuard;

  const key = pairKey(slotId, targetSlotId);
  const now = Date.now();

  // Sørg for at diplomacy-noden eksisterer
  await db.ref(`games/${gameId}/diplomacy/${key}`).transaction((curr: Diplomacy | null) => {
    if (curr) return curr;
    return {
      status: 'neutral' as const,
      since: now,
      proposerId: null,
      notes: {},
    };
  });

  // Append note
  const noteRef = db.ref(`games/${gameId}/diplomacy/${key}/notes`).push();
  const note: DiplomaticNote = { fromSlotId: slotId, text: trimmed, sentAt: now };
  await noteRef.set(note);

  // Trim eldste notes hvis vi overskrider grensen
  const allNotesSnap = await db.ref(`games/${gameId}/diplomacy/${key}/notes`).once('value');
  const allNotes = (allNotesSnap.val() as Record<string, DiplomaticNote>) ?? {};
  const ids = Object.keys(allNotes);
  if (ids.length > MAX_NOTES_PER_PAIR) {
    const sorted = ids
      .map(id => ({ id, sentAt: allNotes[id].sentAt }))
      .sort((a, b) => a.sentAt - b.sentAt);
    const toRemove = sorted.slice(0, ids.length - MAX_NOTES_PER_PAIR);
    const updates: Record<string, null> = {};
    for (const r of toRemove) {
      updates[`games/${gameId}/diplomacy/${key}/notes/${r.id}`] = null;
    }
    await db.ref().update(updates);
  }

  return { ok: true };
});
