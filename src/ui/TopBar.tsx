import { useState, useEffect } from 'react';
import { ResourceCounter } from './ResourceCounter';
import { useMyPlayer, useTotalResources } from '../game/selectors';
import { useGameStore } from '../game/store';

const MACRO_TICK_MS = 10 * 60 * 1000;

function useTickCountdown(lastMacroTickAt: number | undefined): { text: string; soon: boolean } {
  const [state, setState] = useState({ text: '–:––', soon: false });
  useEffect(() => {
    if (!lastMacroTickAt) return;
    const update = () => {
      const diff = lastMacroTickAt + MACRO_TICK_MS - Date.now();
      if (diff <= 0) { setState({ text: 'tikker…', soon: true }); return; }
      const m = Math.floor(diff / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setState({ text: `${m}:${String(s).padStart(2, '0')}`, soon: diff < 60_000 });
    };
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, [lastMacroTickAt]);
  return state;
}

export function TopBar() {
  const player = useMyPlayer();
  const meta = useGameStore(s => s.meta);
  const nations = useGameStore(s => s.nations);
  const resources = useTotalResources();
  const countdown = useTickCountdown(meta?.lastMacroTickAt);

  const food     = Math.floor(resources['food'] ?? 0);
  const oil      = Math.floor(resources['oil'] ?? 0);
  const metal    = Math.floor(resources['metal'] ?? 0);
  const money    = player?.treasury ?? 0;
  const troops   = player?.military ?? 0;
  const influence = player?.influence ?? 0;
  const maintenance = player?.lastMaintenanceCost ?? 0;
  const myNation = player?.nationId ? nations[player.nationId] ?? null : null;

  return (
    <header
      className="flex items-center justify-between gap-2 px-3 sm:px-5 h-11 sm:h-13 parchment border-b border-panelEdge/50 shadow-paper shrink-0"
      role="banner"
    >
      <div className="flex items-center gap-3 sm:gap-4 min-w-0">
        <span
          className="font-serif text-accent text-lg sm:text-xl font-semibold tracking-[0.18em] select-none uppercase"
          style={{ fontVariant: 'small-caps' }}
        >
          Geopolity
        </span>
        {myNation && (
          <div
            className="hidden sm:flex items-center gap-1.5 px-2 py-0.5 rounded-paper bg-bg/50 border border-panelEdge/30 text-ink text-xs"
            aria-label={`Nasjon: ${myNation.name}`}
          >
            <span aria-hidden="true">{myNation.flag}</span>
            <span
              className="w-2 h-2 rounded-full shrink-0 ring-1 ring-ink/20"
              style={{ backgroundColor: myNation.color }}
              aria-hidden="true"
            />
            <span className="font-semibold truncate max-w-[140px] font-serif">{myNation.name}</span>
          </div>
        )}
      </div>

      <nav
        className="flex items-center gap-2 sm:gap-3 overflow-x-auto"
        aria-label="Ressursoversikt"
      >
        <ResourceCounter icon="🌾" label="Mat"         value={food}      low={food < 50} />
        <ResourceCounter icon="🛢️" label="Olje"        value={oil}       low={oil < 50} />
        <ResourceCounter icon="⛏️" label="Metall"      value={metal}     low={metal < 50} />
        <ResourceCounter icon="💰" label="Penger"      value={money}     low={money < 100} />
        {maintenance > 0 && (
          <span
            className="hidden sm:inline text-warn font-mono text-xs -ml-2"
            title="Vedlikehold per makrotikk"
            aria-label={`Vedlikehold trukket forrige tikk: ${maintenance}`}
          >
            −{maintenance}
          </span>
        )}
        <ResourceCounter icon="⚔️" label="Militær"    value={troops} />
        <ResourceCounter icon="🌟" label="Innflytelse" value={influence} />
      </nav>

      <div className="text-inkLo text-xs hidden sm:block font-serif italic">
        {meta?.status === 'frozen' ? (
          <span className="text-warn font-semibold not-italic uppercase tracking-wider">Fryst</span>
        ) : (
          <span
            className={countdown.soon ? 'text-good font-semibold not-italic' : ''}
            title="Tid til neste makrotikk (produksjon)"
          >
            ⏱ {countdown.text}
          </span>
        )}
      </div>
    </header>
  );
}
