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

export async function callStartUnMeeting(args: {
  gameId: string;
  agenda: string;
  options: string[];
}): Promise<CallableEnvelope<{ meetingId: string }>> {
  const f = httpsCallable<typeof args, CallableEnvelope<{ meetingId: string }>>(fns(), 'startUnMeeting');
  return (await f(args)).data;
}

export async function callCastUnVote(args: {
  gameId: string;
  meetingId: string;
  optionIndex: number;
}): Promise<CallableEnvelope> {
  const f = httpsCallable<typeof args, CallableEnvelope>(fns(), 'castUnVote');
  return (await f(args)).data;
}

export async function callCloseUnMeeting(args: {
  gameId: string;
  meetingId: string;
}): Promise<CallableEnvelope> {
  const f = httpsCallable<typeof args, CallableEnvelope>(fns(), 'closeUnMeeting');
  return (await f(args)).data;
}
