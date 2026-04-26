import { useEffect, useRef, useState } from 'react';
import { useChatMessages } from './useChatMessages';
import { useGameStore } from '../../game/store';

interface ChatPanelProps {
  channelId: string;
  /** Vis avsendernavn (for global). For private er det åpenbart hvem motparten er. */
  showAuthor?: boolean;
  /** Etikett over panelet, f.eks. "Globalt" eller mottakerens navn. */
  title?: string;
}

export function ChatPanel({ channelId, showAuthor = true, title }: ChatPanelProps) {
  const { messages, send } = useChatMessages(channelId);
  const players = useGameStore(s => s.players);
  const slotId = useGameStore(s => s.slotId);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll til bunn ved nye meldinger
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  async function handleSend() {
    if (!draft.trim() || sending) return;
    setSending(true);
    setError(null);
    try {
      await send(draft);
      setDraft('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Kunne ikke sende.');
    } finally {
      setSending(false);
    }
  }

  function authorName(authorSlotId: string): string {
    return players[authorSlotId]?.displayName ?? authorSlotId.slice(0, 6);
  }

  function authorColor(authorSlotId: string): string {
    return players[authorSlotId]?.empireColor ?? '#888';
  }

  return (
    <div className="flex flex-col h-full">
      {title && (
        <div className="px-2 py-1 text-xs text-textLo border-b border-panelEdge font-semibold uppercase tracking-wide">
          {title}
        </div>
      )}

      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-2 space-y-1"
        aria-live="polite"
        aria-label="Chat-meldinger"
      >
        {messages.length === 0 && (
          <p className="text-textLo text-xs italic">Ingen meldinger ennå.</p>
        )}
        {messages.map(m => {
          const own = m.authorSlotId === slotId;
          return (
            <div
              key={m.id}
              className={`text-xs flex flex-col ${own ? 'items-end' : 'items-start'}`}
            >
              {showAuthor && !own && (
                <span
                  className="text-[10px] font-semibold mb-0.5"
                  style={{ color: authorColor(m.authorSlotId) }}
                >
                  {authorName(m.authorSlotId)}
                </span>
              )}
              <span
                className={`px-2 py-1 rounded-md max-w-[80%] break-words ${
                  own
                    ? 'bg-accent/30 text-textHi'
                    : 'bg-bg/60 text-textHi border border-panelEdge'
                }`}
              >
                {m.text}
              </span>
            </div>
          );
        })}
      </div>

      <div className="border-t border-panelEdge p-2 flex gap-2">
        <input
          type="text"
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              void handleSend();
            }
          }}
          maxLength={500}
          placeholder="Skriv en melding..."
          disabled={sending}
          className="flex-1 px-2 py-1 rounded bg-bg border border-panelEdge text-sm text-textHi"
        />
        <button
          type="button"
          onClick={handleSend}
          disabled={sending || !draft.trim()}
          className="px-3 py-1 rounded bg-accent text-white text-sm disabled:opacity-40"
        >
          Send
        </button>
      </div>

      {error && <p className="px-2 pb-1 text-xs text-danger">{error}</p>}
    </div>
  );
}
