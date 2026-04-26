import { useEffect, useState } from 'react';
import { subscribeToUnMeetings, subscribeToGameMeta } from '../../firebase/db';
import { callStartUnMeeting, callCloseUnMeeting } from './unClient';
import type { UnMeeting } from '../../types/un';
import type { GameMeta } from '../../types/game';

interface Props {
  gameId: string;
}

const MIN_NATIONS = 3;

export function UnMeetingTrigger({ gameId }: Props) {
  const [meta, setMeta] = useState<GameMeta | null>(null);
  const [meetings, setMeetings] = useState<Record<string, UnMeeting> | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [composing, setComposing] = useState(false);
  const [agenda, setAgenda] = useState('');
  const [options, setOptions] = useState<string[]>(['Ja', 'Nei', 'Avstå']);

  useEffect(() => subscribeToGameMeta(gameId, setMeta), [gameId]);
  useEffect(() => subscribeToUnMeetings(gameId, setMeetings), [gameId]);

  const activeEntry = meetings
    ? Object.entries(meetings).find(([, m]) => m.status === 'open')
    : undefined;
  const nationCount = meta?.nationCount ?? 0;

  if (nationCount < MIN_NATIONS && !activeEntry) {
    return (
      <p className="text-textLo text-xs">
        FN-møte krever minst {MIN_NATIONS} nasjoner ({nationCount}/{MIN_NATIONS}).
      </p>
    );
  }

  async function start(): Promise<void> {
    setBusy(true);
    setError(null);
    try {
      const cleaned = options.map(o => o.trim()).filter(o => o.length > 0);
      const res = await callStartUnMeeting({ gameId, agenda: agenda.trim(), options: cleaned });
      if (!res.ok) {
        setError(res.melding ?? 'Kunne ikke starte FN-møte.');
        return;
      }
      setComposing(false);
      setAgenda('');
      setOptions(['Ja', 'Nei', 'Avstå']);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Nettverksfeil.');
    } finally {
      setBusy(false);
    }
  }

  async function close(meetingId: string): Promise<void> {
    setBusy(true);
    setError(null);
    try {
      const res = await callCloseUnMeeting({ gameId, meetingId });
      if (!res.ok) setError(res.melding ?? 'Kunne ikke lukke møte.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Nettverksfeil.');
    } finally {
      setBusy(false);
    }
  }

  if (activeEntry) {
    const [meetingId, meeting] = activeEntry;
    const totalVotes = Object.keys(meeting.votes ?? {}).length;
    return (
      <div className="space-y-2 bg-bg/40 border border-panelEdge rounded p-2">
        <div className="text-xs text-textLo">FN-møte aktivt</div>
        <p className="text-xs text-textHi truncate" title={meeting.agenda}>{meeting.agenda}</p>
        <p className="text-xs text-textLo">{totalVotes} stemme{totalVotes !== 1 ? 'r' : ''} avgitt</p>
        <button
          type="button"
          disabled={busy}
          onClick={() => void close(meetingId)}
          className="w-full text-xs px-2 py-1 rounded bg-warn/20 text-warn hover:bg-warn/30 disabled:opacity-40"
        >
          Lukk møte
        </button>
        {error && <p className="text-xs text-danger">{error}</p>}
      </div>
    );
  }

  if (!composing) {
    return (
      <button
        type="button"
        onClick={() => setComposing(true)}
        className="text-xs px-3 py-1 rounded bg-accent/20 text-accent hover:bg-accent/30"
      >
        Start FN-møte
      </button>
    );
  }

  return (
    <div className="space-y-2 bg-bg/40 border border-panelEdge rounded p-2">
      <label className="text-xs text-textLo block">
        Agenda
        <textarea
          value={agenda}
          onChange={e => setAgenda(e.target.value)}
          maxLength={500}
          rows={2}
          className="w-full mt-0.5 bg-bg border border-panelEdge rounded px-2 py-1 text-xs text-textHi"
          placeholder="Skal vi sanksjonere imperium X?"
        />
      </label>
      <div className="space-y-1">
        <div className="text-xs text-textLo">Svaralternativer (2–4):</div>
        {options.map((opt, i) => (
          <div key={i} className="flex gap-1">
            <input
              type="text"
              value={opt}
              onChange={e => {
                const next = [...options];
                next[i] = e.target.value;
                setOptions(next);
              }}
              maxLength={80}
              className="flex-1 bg-bg border border-panelEdge rounded px-2 py-1 text-xs text-textHi"
            />
            {options.length > 2 && (
              <button
                type="button"
                onClick={() => setOptions(options.filter((_, j) => j !== i))}
                className="px-2 text-textLo hover:text-danger text-xs"
                aria-label="Fjern alternativ"
              >×</button>
            )}
          </div>
        ))}
        {options.length < 4 && (
          <button
            type="button"
            onClick={() => setOptions([...options, ''])}
            className="text-xs text-accent hover:underline"
          >
            + Legg til alternativ
          </button>
        )}
      </div>
      {error && <p className="text-xs text-danger">{error}</p>}
      <div className="flex gap-2">
        <button
          type="button"
          disabled={busy || agenda.trim().length < 5}
          onClick={() => void start()}
          className="flex-1 text-xs px-3 py-1.5 rounded bg-good text-white disabled:opacity-40"
        >
          Start
        </button>
        <button
          type="button"
          onClick={() => { setComposing(false); setError(null); }}
          className="text-xs px-3 py-1.5 rounded bg-bg border border-panelEdge text-textLo"
        >
          Avbryt
        </button>
      </div>
    </div>
  );
}
