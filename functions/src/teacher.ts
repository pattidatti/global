import * as functions from 'firebase-functions/v2/https';
import { db } from './_db';
import type { CallableResult } from './types';

const REGION = 'europe-west1';

async function requireTeacher(gameId: string, uid: string): Promise<boolean> {
  const snap = await db.ref(`games/${gameId}/meta/teacherId`).once('value');
  return snap.val() === uid;
}

export const freezeGame = functions.onCall<
  { gameId: string },
  Promise<CallableResult>
>(
  { region: REGION, invoker: 'public', cors: true },
  async (req) => {
    if (!req.auth?.uid) return { ok: false, error: 'unauthenticated', melding: 'Ikke autentisert.' };
    if (!(await requireTeacher(req.data.gameId, req.auth.uid))) {
      return { ok: false, error: 'not_teacher', melding: 'Kun lærer kan fryse spillet.' };
    }
    await db.ref(`games/${req.data.gameId}/meta/status`).set('frozen');
    await db.ref(`serverList/${req.data.gameId}/status`).set('frozen');
    return { ok: true };
  },
);

export const resumeGame = functions.onCall<
  { gameId: string },
  Promise<CallableResult>
>(
  { region: REGION, invoker: 'public', cors: true },
  async (req) => {
    if (!req.auth?.uid) return { ok: false, error: 'unauthenticated', melding: 'Ikke autentisert.' };
    if (!(await requireTeacher(req.data.gameId, req.auth.uid))) {
      return { ok: false, error: 'not_teacher', melding: 'Kun lærer kan gjenoppta spillet.' };
    }
    await db.ref(`games/${req.data.gameId}/meta/status`).set('active');
    await db.ref(`serverList/${req.data.gameId}/status`).set('active');
    return { ok: true };
  },
);

export const endGame = functions.onCall<
  { gameId: string },
  Promise<CallableResult>
>(
  { region: REGION, invoker: 'public', cors: true },
  async (req) => {
    if (!req.auth?.uid) return { ok: false, error: 'unauthenticated', melding: 'Ikke autentisert.' };
    if (!(await requireTeacher(req.data.gameId, req.auth.uid))) {
      return { ok: false, error: 'not_teacher', melding: 'Kun lærer kan avslutte spillet.' };
    }
    await db.ref(`games/${req.data.gameId}/meta/status`).set('ended');
    await db.ref(`serverList/${req.data.gameId}/status`).set('ended');
    return { ok: true };
  },
);

export const deleteGame = functions.onCall<
  { gameId: string },
  Promise<CallableResult>
>(
  { region: REGION, invoker: 'public', cors: true },
  async (req) => {
    if (!req.auth?.uid) return { ok: false, error: 'unauthenticated', melding: 'Ikke autentisert.' };
    if (!(await requireTeacher(req.data.gameId, req.auth.uid))) {
      return { ok: false, error: 'not_teacher', melding: 'Kun lærer kan slette spillet (GDPR).' };
    }
    await db.ref(`games/${req.data.gameId}`).remove();
    await db.ref(`serverList/${req.data.gameId}`).remove();
    return { ok: true };
  },
);
