import * as functions from 'firebase-functions/v2/https';
import { db } from './_db';
import { M } from './messages';
import { validateAgenda, summarizeVotes } from './un-logic';
import type {
  UnMeeting,
  Nation,
  StartUnMeetingArgs,
  CastUnVoteArgs,
  CloseUnMeetingArgs,
  CallableResult,
} from './types';

const REGION = 'europe-west1';
const MIN_NATIONS_FOR_UN = 3;

async function requireTeacher(gameId: string, uid: string): Promise<boolean> {
  const snap = await db.ref(`games/${gameId}/meta/teacherId`).once('value');
  return snap.val() === uid;
}

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

// ---------------------------------------------------------------------------
// startUnMeeting — kun lærer, krever ≥3 nasjoner og ingen åpen meeting
// ---------------------------------------------------------------------------

export const startUnMeeting = functions.onCall<
  StartUnMeetingArgs,
  Promise<CallableResult<{ meetingId: string }>>
>({ region: REGION, invoker: 'public', cors: true }, async (req) => {
  if (!req.auth?.uid) {
    return { ok: false, error: 'unauthenticated', melding: M.IKKE_AUTENTISERT };
  }
  const { gameId, agenda, options } = req.data;

  if (!(await requireTeacher(gameId, req.auth.uid))) {
    return { ok: false, error: 'not_teacher', melding: 'Kun lærer kan starte FN-møte.' };
  }

  const validated = validateAgenda(agenda, options);
  if (!validated.ok) {
    const map = {
      agenda_too_short: 'Agendaen må være minst 5 tegn.',
      agenda_too_long:  'Agendaen kan være maks 500 tegn.',
      too_few_options:  'Du må gi minst 2 svaralternativer.',
      too_many_options: 'Maks 4 svaralternativer er tillatt.',
      option_invalid:   'Hvert svaralternativ må være 1–80 tegn.',
    } as const;
    return { ok: false, error: validated.reason, melding: map[validated.reason] };
  }

  const [metaSnap, meetingsSnap] = await Promise.all([
    db.ref(`games/${gameId}/meta`).once('value'),
    db.ref(`games/${gameId}/unMeetings`).once('value'),
  ]);
  const meta = metaSnap.val() as { nationCount?: number; status?: string } | null;
  if (meta?.status !== 'active') {
    return { ok: false, error: 'game_not_active', melding: M.SPILL_IKKE_AKTIVT };
  }
  if ((meta?.nationCount ?? 0) < MIN_NATIONS_FOR_UN) {
    return {
      ok: false,
      error: 'too_few_nations',
      melding: `FN-møte krever minst ${MIN_NATIONS_FOR_UN} nasjoner.`,
    };
  }
  const existing = meetingsSnap.val() as Record<string, UnMeeting> | null;
  if (existing) {
    const hasOpen = Object.values(existing).some(m => m.status === 'open');
    if (hasOpen) {
      return { ok: false, error: 'meeting_already_open', melding: 'Et FN-møte pågår allerede. Lukk det først.' };
    }
  }

  const now = Date.now();
  const meetingRef = db.ref(`games/${gameId}/unMeetings`).push();
  const meeting: UnMeeting = {
    agenda: validated.agenda,
    options: validated.options,
    startedAt: now,
    startedBy: req.auth.uid,
    status: 'open',
  };
  await meetingRef.set(meeting);

  return { ok: true, data: { meetingId: meetingRef.key! } };
});

// ---------------------------------------------------------------------------
// castUnVote — kun nasjons-grunnlegger
// ---------------------------------------------------------------------------

export const castUnVote = functions.onCall<
  CastUnVoteArgs,
  Promise<CallableResult>
>({ region: REGION, invoker: 'public', cors: true }, async (req) => {
  if (!req.auth?.uid) {
    return { ok: false, error: 'unauthenticated', melding: M.IKKE_AUTENTISERT };
  }
  const { gameId, meetingId, optionIndex } = req.data;

  const meetingSnap = await db.ref(`games/${gameId}/unMeetings/${meetingId}`).once('value');
  const meeting = meetingSnap.val() as UnMeeting | null;
  if (!meeting) {
    return { ok: false, error: 'meeting_not_found', melding: 'FN-møtet finnes ikke.' };
  }
  if (meeting.status !== 'open') {
    return { ok: false, error: 'meeting_closed', melding: 'FN-møtet er lukket.' };
  }
  if (typeof optionIndex !== 'number' || optionIndex < 0 || optionIndex >= meeting.options.length) {
    return { ok: false, error: 'invalid_option', melding: 'Ugyldig svaralternativ.' };
  }

  const found = await findNationOwnedBy(gameId, req.auth.uid);
  if (!found) {
    return { ok: false, error: 'no_nation', melding: 'Kun nasjons-grunnleggere kan stemme.' };
  }

  await db.ref(`games/${gameId}/unMeetings/${meetingId}/votes/${found.nationId}`).set(optionIndex);
  return { ok: true };
});

// ---------------------------------------------------------------------------
// closeUnMeeting — kun lærer; logger oppsummering
// ---------------------------------------------------------------------------

export const closeUnMeeting = functions.onCall<
  CloseUnMeetingArgs,
  Promise<CallableResult>
>({ region: REGION, invoker: 'public', cors: true }, async (req) => {
  if (!req.auth?.uid) {
    return { ok: false, error: 'unauthenticated', melding: M.IKKE_AUTENTISERT };
  }
  const { gameId, meetingId } = req.data;

  if (!(await requireTeacher(gameId, req.auth.uid))) {
    return { ok: false, error: 'not_teacher', melding: 'Kun lærer kan lukke FN-møte.' };
  }

  const meetingSnap = await db.ref(`games/${gameId}/unMeetings/${meetingId}`).once('value');
  const meeting = meetingSnap.val() as UnMeeting | null;
  if (!meeting) {
    return { ok: false, error: 'meeting_not_found', melding: 'FN-møtet finnes ikke.' };
  }
  if (meeting.status === 'closed') {
    return { ok: false, error: 'already_closed', melding: 'FN-møtet er allerede lukket.' };
  }

  const now = Date.now();
  const summary = summarizeVotes(meeting.votes, meeting.options.length);

  const updates: Record<string, unknown> = {};
  updates[`games/${gameId}/unMeetings/${meetingId}/status`] = 'closed';
  updates[`games/${gameId}/unMeetings/${meetingId}/closedAt`] = now;

  const logRef = db.ref(`games/${gameId}/teacher/log`).push();
  updates[`games/${gameId}/teacher/log/${logRef.key}`] = {
    type: 'un_meeting_closed',
    meetingId,
    agenda: meeting.agenda,
    winningOptionIndex: summary.winningIndex,
    winningOption: summary.winningIndex >= 0 ? meeting.options[summary.winningIndex] : '(ingen stemmer)',
    voteCounts: summary.counts,
    totalVotes: summary.total,
    ts: now,
  };

  await db.ref().update(updates);
  return { ok: true };
});
