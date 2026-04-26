import { useMemo, useState } from 'react';
import { useGameStore } from '../../game/store';
import { useActiveUnMeeting } from './useActiveUnMeeting';
import { callCastUnVote } from './unClient';

const DISMISS_KEY_PREFIX = 'un_dismissed_';

export function UnMeetingModal() {
  const gameId = useGameStore(s => s.gameId);
  const slotId = useGameStore(s => s.slotId);
  const nations = useGameStore(s => s.nations);
  const active = useActiveUnMeeting(gameId);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState<string | null>(() => {
    if (typeof window === 'undefined' || !active) return null;
    return sessionStorage.getItem(DISMISS_KEY_PREFIX + (active?.meetingId ?? '')) ?? null;
  });

  const myNation = useMemo(() => {
    if (!slotId) return null;
    for (const [nationId, nation] of Object.entries(nations)) {
      if (nation.founderId === slotId) return { nationId, nation };
    }
    return null;
  }, [nations, slotId]);

  if (!active || !gameId) return null;

  const myVote = myNation ? active.meeting.votes?.[myNation.nationId] : undefined;
  const hasVoted = typeof myVote === 'number';

  if (dismissed === active.meetingId && hasVoted) return null;

  async function vote(optionIndex: number): Promise<void> {
    if (busy || !gameId || !active) return;
    setBusy(true);
    setError(null);
    try {
      const res = await callCastUnVote({ gameId, meetingId: active.meetingId, optionIndex });
      if (!res.ok) setError(res.melding ?? 'Stemming feilet.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Nettverksfeil.');
    } finally {
      setBusy(false);
    }
  }

  function dismiss(): void {
    if (!active) return;
    sessionStorage.setItem(DISMISS_KEY_PREFIX + active.meetingId, '1');
    setDismissed(active.meetingId);
  }

  // Beregn lokalt resultat for stolpediagram
  const counts = active.meeting.options.map((_, i) =>
    Object.values(active.meeting.votes ?? {}).filter(v => v === i).length,
  );
  const total = counts.reduce((a, b) => a + b, 0);

  return (
    <div
      className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-labelledby="un-meeting-title"
      aria-modal="true"
    >
      <div className="bg-panel border border-panelEdge rounded-lg max-w-md w-full p-5 space-y-4">
        <div className="flex items-start gap-2">
          <span className="text-2xl" aria-hidden="true">🗳️</span>
          <div className="flex-1">
            <h2 id="un-meeting-title" className="text-textHi font-semibold">FN-møte pågår</h2>
            <p className="text-textLo text-sm mt-1">{active.meeting.agenda}</p>
          </div>
        </div>

        {!myNation ? (
          <p className="text-textLo text-xs italic">
            Bare nasjons-grunnleggere kan stemme. Du kan likevel følge resultatet.
          </p>
        ) : hasVoted ? (
          <p className="text-good text-xs">
            Du har stemt på «{active.meeting.options[myVote!]}». Du kan endre stemmen mens møtet er åpent.
          </p>
        ) : (
          <p className="text-warn text-xs">Velg ditt svar:</p>
        )}

        <div className="space-y-2">
          {active.meeting.options.map((opt, i) => {
            const count = counts[i];
            const pct = total > 0 ? Math.round((count / total) * 100) : 0;
            const isMine = myVote === i;
            return (
              <div key={i} className="space-y-1">
                <button
                  type="button"
                  onClick={() => void vote(i)}
                  disabled={busy || !myNation}
                  className={`w-full text-left px-3 py-2 rounded text-sm transition-colors ${
                    isMine ? 'bg-accent/30 border border-accent text-textHi' : 'bg-bg/50 hover:bg-bg/70 text-textHi disabled:opacity-50'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span>{opt}</span>
                    <span className="text-xs text-textLo">{count} ({pct}%)</span>
                  </div>
                  <div className="mt-1 h-1.5 bg-bg/60 rounded overflow-hidden">
                    <div
                      className="h-full bg-accent transition-all"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </button>
              </div>
            );
          })}
        </div>

        {error && <p className="text-danger text-xs">{error}</p>}

        <div className="flex justify-end gap-2 pt-2 border-t border-panelEdge">
          <button
            type="button"
            onClick={dismiss}
            className="text-xs px-3 py-1 rounded text-textLo hover:text-textHi"
          >
            {hasVoted ? 'Lukk' : 'Lukk (jeg stemmer senere)'}
          </button>
        </div>
      </div>
    </div>
  );
}
