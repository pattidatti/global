import { useEffect, useState } from 'react';
import { subscribeToUnMeetings } from '../../firebase/db';
import type { UnMeeting } from '../../types/un';

export interface ActiveMeeting {
  meetingId: string;
  meeting: UnMeeting;
}

/**
 * Returnerer det aktive (status === 'open') FN-møtet for et spill,
 * eller null. Antar maks ett åpent møte om gangen (server-validert).
 */
export function useActiveUnMeeting(gameId: string | null): ActiveMeeting | null {
  const [active, setActive] = useState<ActiveMeeting | null>(null);

  useEffect(() => {
    if (!gameId) return;
    return subscribeToUnMeetings(gameId, snap => {
      if (!snap) {
        setActive(null);
        return;
      }
      for (const [id, m] of Object.entries(snap)) {
        if (m.status === 'open') {
          setActive({ meetingId: id, meeting: m });
          return;
        }
      }
      setActive(null);
    });
  }, [gameId]);

  return active;
}
