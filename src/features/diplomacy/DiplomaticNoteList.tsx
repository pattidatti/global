import { useState } from 'react';
import { useGameStore } from '../../game/store';
import { callSendDiplomaticNote, pairKey } from './diplomacyClient';
import type { DiplomaticNote } from '../../types/diplomacy';

interface DiplomaticNoteListProps {
  targetSlotId: string;
}

export function DiplomaticNoteList({ targetSlotId }: DiplomaticNoteListProps) {
  const gameId = useGameStore(s => s.gameId);
  const slotId = useGameStore(s => s.slotId);
  const players = useGameStore(s => s.players);
  const diplomacy = useGameStore(s => s.diplomacy);

  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!slotId) return null;

  const key = pairKey(slotId, targetSlotId);
  const notesObj = diplomacy[key]?.notes ?? {};
  const notes: Array<DiplomaticNote & { id: string }> = Object.entries(notesObj)
    .map(([id, n]) => ({ id, ...n }))
    .sort((a, b) => b.sentAt - a.sentAt);

  async function handleSend() {
    if (!gameId || !slotId || !text.trim() || sending) return;
    setSending(true);
    setError(null);
    try {
      const res = await callSendDiplomaticNote({
        gameId,
        slotId,
        targetSlotId,
        text: text.trim(),
      });
      if (!res.ok) {
        setError(res.melding ?? 'Kunne ikke sende.');
      } else {
        setText('');
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Nettverksfeil.');
    } finally {
      setSending(false);
    }
  }

  function authorName(authorSlotId: string): string {
    return players[authorSlotId]?.displayName ?? authorSlotId.slice(0, 6);
  }

  return (
    <div className="flex flex-col gap-2">
      <h3 className="text-xs uppercase tracking-wide text-textLo">Diplomatiske noter</h3>

      <div className="flex gap-2">
        <input
          type="text"
          value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter') {
              e.preventDefault();
              void handleSend();
            }
          }}
          maxLength={280}
          placeholder="Skriv en formell note..."
          disabled={sending}
          className="flex-1 px-2 py-1 rounded bg-bg border border-panelEdge text-xs text-textHi"
        />
        <button
          type="button"
          onClick={handleSend}
          disabled={sending || !text.trim()}
          className="px-2 py-1 rounded bg-accent text-white text-xs disabled:opacity-40"
        >
          Send
        </button>
      </div>

      {error && <p className="text-xs text-danger">{error}</p>}

      <ul className="space-y-1 max-h-48 overflow-y-auto">
        {notes.length === 0 && (
          <li className="text-xs text-textLo italic">Ingen noter ennå.</li>
        )}
        {notes.map(n => (
          <li
            key={n.id}
            className="px-2 py-1 rounded bg-bg/50 border border-panelEdge text-xs"
          >
            <div className="flex justify-between text-textLo text-[10px]">
              <span className="font-semibold">{authorName(n.fromSlotId)}</span>
              <span>{new Date(n.sentAt).toLocaleTimeString('nb-NO', { hour: '2-digit', minute: '2-digit' })}</span>
            </div>
            <p className="text-textHi">{n.text}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}
