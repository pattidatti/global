import { httpsCallable, getFunctions } from 'firebase/functions';
import { firebaseApp } from '../../firebase/config';

const FUNCTIONS_REGION = 'europe-west1';

interface CallableEnvelope {
  ok: boolean;
  error?: string;
  melding?: string;
}

function fns() {
  return getFunctions(firebaseApp, FUNCTIONS_REGION);
}

export function pairKey(a: string, b: string): string {
  if (a === b) throw new Error('pairKey krever to forskjellige slotIds');
  return a < b ? `${a}__${b}` : `${b}__${a}`;
}

export async function callProposeAlliance(args: {
  gameId: string;
  slotId: string;
  targetSlotId: string;
}): Promise<CallableEnvelope> {
  const f = httpsCallable<typeof args, CallableEnvelope>(fns(), 'proposeAlliance');
  return (await f(args)).data;
}

export async function callAcceptAlliance(args: {
  gameId: string;
  slotId: string;
  targetSlotId: string;
}): Promise<CallableEnvelope> {
  const f = httpsCallable<typeof args, CallableEnvelope>(fns(), 'acceptAlliance');
  return (await f(args)).data;
}

export async function callBreakAlliance(args: {
  gameId: string;
  slotId: string;
  targetSlotId: string;
}): Promise<CallableEnvelope> {
  const f = httpsCallable<typeof args, CallableEnvelope>(fns(), 'breakAlliance');
  return (await f(args)).data;
}

export async function callSendDiplomaticNote(args: {
  gameId: string;
  slotId: string;
  targetSlotId: string;
  text: string;
}): Promise<CallableEnvelope> {
  const f = httpsCallable<typeof args, CallableEnvelope>(fns(), 'sendDiplomaticNote');
  return (await f(args)).data;
}
