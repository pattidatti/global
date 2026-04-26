import { httpsCallable, getFunctions } from 'firebase/functions';
import { firebaseApp } from '../../firebase/config';

const FUNCTIONS_REGION = 'europe-west1';

interface CallableEnvelope<T = unknown> {
  ok: boolean;
  error?: string;
  melding?: string;
  data?: T;
}

function fns() {
  return getFunctions(firebaseApp, FUNCTIONS_REGION);
}

export async function callCreateLeague(args: {
  gameId: string;
  name: string;
}): Promise<CallableEnvelope<{ leagueId: string }>> {
  const f = httpsCallable<typeof args, CallableEnvelope<{ leagueId: string }>>(fns(), 'createLeague');
  return (await f(args)).data;
}

export async function callInviteNationToLeague(args: {
  gameId: string;
  leagueId: string;
  targetNationId: string;
}): Promise<CallableEnvelope> {
  const f = httpsCallable<typeof args, CallableEnvelope>(fns(), 'inviteNationToLeague');
  return (await f(args)).data;
}

export async function callAcceptLeagueInvite(args: {
  gameId: string;
  leagueId: string;
  nationId: string;
}): Promise<CallableEnvelope> {
  const f = httpsCallable<typeof args, CallableEnvelope>(fns(), 'acceptLeagueInvite');
  return (await f(args)).data;
}

export async function callLeaveLeague(args: {
  gameId: string;
  leagueId: string;
  nationId: string;
}): Promise<CallableEnvelope> {
  const f = httpsCallable<typeof args, CallableEnvelope>(fns(), 'leaveLeague');
  return (await f(args)).data;
}

export async function callDissolveLeague(args: {
  gameId: string;
  leagueId: string;
}): Promise<CallableEnvelope> {
  const f = httpsCallable<typeof args, CallableEnvelope>(fns(), 'dissolveLeague');
  return (await f(args)).data;
}
