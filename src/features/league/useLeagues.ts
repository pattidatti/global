import { useEffect, useState } from 'react';
import { subscribeToLeagues } from '../../firebase/db';
import type { League } from '../../types/league';

export function useLeagues(gameId: string | null): Record<string, League> {
  const [leagues, setLeagues] = useState<Record<string, League>>({});
  useEffect(() => {
    if (!gameId) return;
    return subscribeToLeagues(gameId, snap => setLeagues(snap ?? {}));
  }, [gameId]);
  return leagues;
}
