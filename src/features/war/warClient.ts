import { httpsCallable, getFunctions } from 'firebase/functions';
import { firebaseApp } from '../../firebase/config';
import type { UnitType } from '../../types/war';

const FUNCTIONS_REGION = 'europe-west1';

interface CallableEnvelope<T = undefined> {
  ok: boolean;
  error?: string;
  melding?: string;
  data?: T;
}

function fns() {
  return getFunctions(firebaseApp, FUNCTIONS_REGION);
}

export async function callDeclareWar(args: {
  gameId: string;
  slotId: string;
  targetSlotId: string;
  contestedRegionIds: string[];
}): Promise<CallableEnvelope<{ warId: string }>> {
  const f = httpsCallable<typeof args, CallableEnvelope<{ warId: string }>>(fns(), 'declareWar');
  return (await f(args)).data;
}

export async function callDeployUnits(args: {
  gameId: string;
  slotId: string;
  regionId: string;
  unitType: UnitType;
  count: number;
}): Promise<CallableEnvelope<{ unitIds: string[] }>> {
  const f = httpsCallable<typeof args, CallableEnvelope<{ unitIds: string[] }>>(fns(), 'deployUnits');
  return (await f(args)).data;
}

export async function callProposeCeasefire(args: {
  gameId: string;
  slotId: string;
  warId: string;
}): Promise<CallableEnvelope> {
  const f = httpsCallable<typeof args, CallableEnvelope>(fns(), 'proposeCeasefire');
  return (await f(args)).data;
}

export async function callAcceptCeasefire(args: {
  gameId: string;
  slotId: string;
  warId: string;
}): Promise<CallableEnvelope> {
  const f = httpsCallable<typeof args, CallableEnvelope>(fns(), 'acceptCeasefire');
  return (await f(args)).data;
}
