import { useState, useEffect } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { firebaseApp } from '../firebase/config';
import { useGameStore } from '../game/store';

const _fns = getFunctions(firebaseApp, 'europe-west1');
const _triggerDevTick = httpsCallable<{ gameId: string }, { ok: boolean; error?: string }>(
  _fns, 'triggerDevTick',
);

const INTERVALS = [3, 10, 30] as const;
type Interval = typeof INTERVALS[number];

function formatElapsed(ms: number): string {
  const sec = Math.floor(ms / 1000);
  return sec < 60 ? `${sec}s` : `${Math.floor(sec / 60)}m ${sec % 60}s`;
}

export function DevPanel() {
  const gameId = useGameStore(s => s.gameId);
  const lastMacroTickAt = useGameStore(s => s.meta?.lastMacroTickAt ?? null);

  const [collapsed, setCollapsed] = useState(true);
  const [tickCount, setTickCount] = useState(0);
  const [lastTickAt, setLastTickAt] = useState<number | null>(lastMacroTickAt);
  const [autoInterval, setAutoInterval] = useState<Interval | null>(null);
  const [elapsed, setElapsed] = useState('–');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (lastMacroTickAt) setLastTickAt(lastMacroTickAt);
  }, [lastMacroTickAt]);

  useEffect(() => {
    if (!lastTickAt) return;
    const update = () => setElapsed(formatElapsed(Date.now() - lastTickAt));
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, [lastTickAt]);

  useEffect(() => {
    if (!autoInterval || !gameId) return;
    const id = setInterval(() => {
      void _triggerDevTick({ gameId }).then(r => {
        if (r.data.ok) {
          setTickCount(c => c + 1);
          setLastTickAt(Date.now());
          setError(null);
        } else {
          setError(r.data.error ?? 'feil');
        }
      }).catch(e => setError(String(e)));
    }, autoInterval * 1000);
    return () => clearInterval(id);
  }, [autoInterval, gameId]);

  async function handleTrigger() {
    if (!gameId) return;
    setError(null);
    try {
      const r = await _triggerDevTick({ gameId });
      if (r.data.ok) {
        setTickCount(c => c + 1);
        setLastTickAt(Date.now());
      } else {
        setError(r.data.error ?? 'feil');
      }
    } catch (e) {
      setError(String(e));
    }
  }

  return (
    <div className="fixed bottom-20 sm:bottom-16 left-2 z-[600] w-52 pointer-events-auto">
      <div className="parchment border border-panelEdge/70 rounded-paper shadow-paperLg backdrop-blur-sm bg-panel/90 overflow-hidden">
        <header className="flex items-center justify-between gap-2 px-3 py-1.5 border-b border-panelEdge/40 bg-bg/50">
          <span className="font-mono text-xs text-inkLo uppercase tracking-wider select-none">
            ⚡ Dev
          </span>
          <button
            type="button"
            onClick={() => setCollapsed(c => !c)}
            className="p-0.5 -mr-0.5 rounded hover:bg-panelEdge/15 text-inkLo hover:text-ink transition-colors"
            aria-label={collapsed ? 'Vis DevPanel' : 'Skjul DevPanel'}
            aria-expanded={!collapsed}
          >
            {collapsed ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
          </button>
        </header>

        {!collapsed && (
          <div className="px-3 py-2 space-y-2 text-xs text-ink">
            <div className="font-mono text-inkLo truncate text-[10px]" title={gameId ?? '—'}>
              {gameId ? gameId.slice(0, 14) + '…' : 'ingen spill'}
            </div>

            <div className="flex justify-between text-inkLo">
              <span>Tikk: <span className="text-ink font-semibold">{tickCount}</span></span>
              <span>Sist: <span className="text-ink">{elapsed}</span></span>
            </div>

            <button
              type="button"
              onClick={() => { void handleTrigger(); }}
              disabled={!gameId}
              className="w-full py-1 rounded text-xs font-medium bg-accent/20 hover:bg-accent/30 text-accent border border-accent/40 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              ⚡ Trigger tikk
            </button>

            <div>
              <div className="text-inkLo mb-1">Auto-tikk</div>
              <div className="flex gap-1">
                {INTERVALS.map(s => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setAutoInterval(prev => prev === s ? null : s)}
                    className={[
                      'flex-1 py-0.5 rounded text-[10px] font-mono border transition-colors',
                      autoInterval === s
                        ? 'bg-accent text-panel border-accent'
                        : 'bg-panelEdge/20 text-inkLo border-panelEdge/40 hover:border-panelEdge',
                    ].join(' ')}
                  >
                    {s}s
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => setAutoInterval(null)}
                  className={[
                    'flex-1 py-0.5 rounded text-[10px] font-mono border transition-colors',
                    autoInterval === null
                      ? 'bg-danger/20 text-danger border-danger/40'
                      : 'bg-panelEdge/20 text-inkLo border-panelEdge/40 hover:border-panelEdge',
                  ].join(' ')}
                >
                  AV
                </button>
              </div>
            </div>

            {error && (
              <div role="alert" className="text-danger text-[10px] break-all">{error}</div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
