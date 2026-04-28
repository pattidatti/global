import { connectAuthEmulator } from 'firebase/auth';
import { connectDatabaseEmulator } from 'firebase/database';
import { connectFunctionsEmulator, getFunctions, httpsCallable } from 'firebase/functions';
import { auth } from './auth';
import { db } from './db';
import { firebaseApp } from './config';
import { useGameStore } from '../game/store';

if (import.meta.env.VITE_USE_EMULATORS === 'true') {
  connectAuthEmulator(auth, 'http://localhost:9099', { disableWarnings: true });
  connectFunctionsEmulator(getFunctions(firebaseApp, 'europe-west1'), 'localhost', 5001);
  // RTDB-emulatoren krever Java — hopper over om VITE_EMULATE_DB ikke er satt
  if (import.meta.env.VITE_EMULATE_DB === 'true') {
    connectDatabaseEmulator(db, 'localhost', 9000);
  }
}

if (import.meta.env.DEV) {
  // Expose store for Playwright automation
  (window as Window & { __gameStore?: typeof useGameStore }).__gameStore = useGameStore;

  // Expose tick trigger for playtesting (requires TICK_DEV_ENABLED=true in functions/.env)
  const triggerFn = httpsCallable<{ gameId: string }, { ok: boolean }>(
    getFunctions(firebaseApp, 'europe-west1'), 'triggerDevTick',
  );
  (window as Window & { __triggerDevTick?: (gameId: string) => Promise<void> }).__triggerDevTick =
    async (gameId: string) => { await triggerFn({ gameId }); };
}
