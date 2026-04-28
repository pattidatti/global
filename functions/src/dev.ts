import * as functions from 'firebase-functions/v2/https';
import { tickGame } from './tick';

const REGION = 'europe-west1';

export const triggerDevTick = functions.onCall<
  { gameId: string },
  Promise<{ ok: boolean; error?: string }>
>(
  { region: REGION, invoker: 'public', cors: true },
  async (req) => {
    if (process.env.TICK_DEV_ENABLED !== 'true') {
      return { ok: false, error: 'not-available' };
    }
    const { gameId } = req.data;
    if (!gameId) return { ok: false, error: 'missing-gameId' };
    await tickGame(gameId, Date.now());
    return { ok: true };
  },
);
