import type { ComponentType, SVGProps } from 'react';
import { Map as MapIcon, Coins, Sword, Handshake, ScrollText } from 'lucide-react';
import { useGameStore, type ActiveScreen } from '../game/store';
import { useMyPlayer } from '../game/selectors';

interface Tab {
  id: ActiveScreen;
  Icon: ComponentType<SVGProps<SVGSVGElement> & { size?: number | string }>;
  label: string;
}

const TABS: Tab[] = [
  { id: 'map',       Icon: MapIcon,    label: 'Kart' },
  { id: 'market',    Icon: Coins,      label: 'Marked' },
  { id: 'war',       Icon: Sword,      label: 'Militær' },
  { id: 'diplomacy', Icon: Handshake,  label: 'Diplomati' },
  { id: 'events',    Icon: ScrollText, label: 'Hendelser' },
];

export function BottomNav() {
  const activeScreen = useGameStore(s => s.activeScreen);
  const setActiveScreen = useGameStore(s => s.setActiveScreen);
  const player = useMyPlayer();
  const empireColor = player?.empireColor ?? null;

  return (
    <nav
      className="flex items-center justify-around h-16 sm:h-14 parchment border-t border-panelEdge/50 shadow-[0_-2px_8px_rgba(60,40,15,0.08)] shrink-0 pb-[env(safe-area-inset-bottom)]"
      aria-label="Hovednavigasjon"
    >
      {TABS.map(({ id, Icon, label }) => {
        const isActive = id === activeScreen;
        return (
          <button
            key={id}
            onClick={() => setActiveScreen(id)}
            className={[
              'relative flex flex-col items-center gap-0.5 px-3 py-2 sm:py-1.5 min-w-[44px] min-h-[44px]',
              'text-[10px] sm:text-xs transition-colors font-serif',
              isActive
                ? 'text-accent font-semibold'
                : 'text-inkLo hover:text-ink',
            ].join(' ')}
            aria-current={isActive ? 'page' : undefined}
            aria-label={label}
          >
            <Icon size={20} strokeWidth={isActive ? 2.2 : 1.6} aria-hidden="true" />
            <span className="tracking-wide">{label}</span>
            {isActive && (
              <>
                <span
                  className="absolute -top-px left-1/2 -translate-x-1/2 h-[2px] w-8 bg-accent rounded-full"
                  aria-hidden="true"
                />
                {empireColor && (
                  <span
                    className="absolute top-1 right-2 w-1.5 h-1.5 rounded-full ring-1 ring-ink/15"
                    style={{ backgroundColor: empireColor }}
                    aria-hidden="true"
                  />
                )}
              </>
            )}
          </button>
        );
      })}
    </nav>
  );
}
