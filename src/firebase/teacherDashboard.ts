import {
  ref,
  onValue,
  off,
  query,
  orderByChild,
  limitToLast,
  type DatabaseReference,
} from 'firebase/database';
import { db } from './db';
import type { Player } from '../types/player';
import type { Nation } from '../types/nation';
import type { War } from '../types/war';
import type { TeacherLogEntry } from '../types/teacherLog';

/**
 * Siste N varsler fra teacher/log, sortert nyeste først via klient-side sortering.
 * RTDB returnerer ascending; vi reverserer i UI-laget.
 */
export function subscribeToTeacherLog(
  gameId: string,
  cb: (entries: Record<string, TeacherLogEntry> | null) => void,
  limit: number = 50,
): () => void {
  const r: DatabaseReference = ref(db, `games/${gameId}/teacher/log`);
  const q = query(r, orderByChild('ts'), limitToLast(limit));
  onValue(q, snap => cb(snap.val() as Record<string, TeacherLogEntry> | null));
  return () => off(r);
}

export interface GameSummary {
  playersOnline: number;
  playersTotal: number;
  nationCount: number;
  activeWarCount: number;
  totalRegionsClaimed: number;
}

const ONLINE_THRESHOLD_MS = 2 * 60 * 1000;

function computeSummary(
  players: Record<string, Player> | null,
  nations: Record<string, Nation> | null,
  wars: Record<string, War> | null,
): GameSummary {
  const now = Date.now();
  const playerList = players ? Object.values(players) : [];
  return {
    playersTotal: playerList.length,
    playersOnline: playerList.filter(p => now - (p.lastSeenAt ?? 0) < ONLINE_THRESHOLD_MS).length,
    nationCount: nations ? Object.keys(nations).length : 0,
    activeWarCount: wars
      ? Object.values(wars).filter(w => w.status === 'active').length
      : 0,
    totalRegionsClaimed: playerList.reduce((sum, p) => sum + (p.regionIds?.length ?? 0), 0),
  };
}

/**
 * Sammenstiller summary fra players + nations + wars. Returnerer både
 * sammendraget og rå-spillerlista (for tabellvisning) i samme callback.
 */
export function subscribeToGameSummary(
  gameId: string,
  cb: (summary: GameSummary, players: Record<string, Player> | null) => void,
): () => void {
  let players: Record<string, Player> | null = null;
  let nations: Record<string, Nation> | null = null;
  let wars: Record<string, War> | null = null;

  function emit() {
    cb(computeSummary(players, nations, wars), players);
  }

  const playersRef = ref(db, `games/${gameId}/players`);
  const nationsRef = ref(db, `games/${gameId}/nations`);
  const warsRef = ref(db, `games/${gameId}/wars`);

  onValue(playersRef, snap => { players = snap.val(); emit(); });
  onValue(nationsRef, snap => { nations = snap.val(); emit(); });
  onValue(warsRef, snap => { wars = snap.val(); emit(); });

  return () => {
    off(playersRef);
    off(nationsRef);
    off(warsRef);
  };
}
