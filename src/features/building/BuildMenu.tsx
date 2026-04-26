import { useState } from 'react';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { firebaseApp } from '../../firebase/config';
import { useMyPlayer } from '../../game/selectors';
import { useGameStore } from '../../game/store';
import type { Region, BuildingType } from '../../types/region';

interface BuildingInfo {
  type: BuildingType;
  icon: string;
  name: string;
  cost: number;
  buildTimeMin: number;
  output: string;
  requires?: string;
}

const BUILDINGS: BuildingInfo[] = [
  { type: 'farm',       icon: '🌾', name: 'Gård',     cost: 100, buildTimeMin: 5,  output: '+mat/tikk',      },
  { type: 'mine',       icon: '⛏️', name: 'Gruve',    cost: 200, buildTimeMin: 15, output: '+metall/tikk',   },
  { type: 'oilrig',     icon: '🛢️', name: 'Oljerigg', cost: 250, buildTimeMin: 20, output: '+olje/tikk',     },
  { type: 'harbor',     icon: '⚓',  name: 'Havn',     cost: 400, buildTimeMin: 30, output: '+handel/tikk',   requires: 'kyst' },
  { type: 'barracks',   icon: '⚔️', name: 'Kaserne',  cost: 300, buildTimeMin: 20, output: '+militær/tikk',  },
  { type: 'cityExpand', icon: '🏙️', name: 'Byvekst',  cost: 800, buildTimeMin: 60, output: '+innflytelse',   requires: 'by' },
];

interface BuildMenuProps {
  region: Region;
  regionId: string;
  gameId: string;
  onClose: () => void;
}

export function BuildMenu({ region, regionId, gameId, onClose }: BuildMenuProps) {
  const [building, setBuilding] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const player = useMyPlayer();
  const { setPendingBuild } = useGameStore();

  const usedSlots = Object.keys(region.buildings ?? {}).length + (region.buildQueue ?? []).length;
  const slotsLeft = (region.maxSlots ?? 1) - usedSlots;

  async function handleBuild(type: BuildingType) {
    if (building) return;
    setError(null);
    setBuilding(type);
    setPendingBuild(regionId, true);
    try {
      const fns = getFunctions(firebaseApp, 'europe-west1');
      const buildBuilding = httpsCallable<unknown, { ok: boolean; melding?: string }>(fns, 'buildBuilding');
      const result = await buildBuilding({ gameId, regionId, buildingType: type });
      if (!result.data.ok) {
        setError(result.data.melding ?? 'Noe gikk galt.');
      } else {
        onClose();
      }
    } catch {
      setError('Noe gikk galt. Prøv igjen.');
    } finally {
      setBuilding(null);
      setPendingBuild(regionId, false);
    }
  }

  return (
    <div className="space-y-1">
      <div className="flex justify-between items-center mb-2">
        <span className="text-xs text-textLo">
          {slotsLeft} plass{slotsLeft !== 1 ? 'er' : ''} ledig
        </span>
        <button onClick={onClose} className="text-textLo hover:text-textHi text-xs">✕ Lukk</button>
      </div>

      {error && <p className="text-danger text-xs">{error}</p>}

      {BUILDINGS.map(b => {
        const canAfford = (player?.treasury ?? 0) >= b.cost;
        const meetsReq = !b.requires ||
          (b.requires === 'kyst' && region.biome === 'coast') ||
          b.requires === 'by'; // by-sjekk håndteres server-side i fase 1
        const disabled = !canAfford || !meetsReq || slotsLeft <= 0 || building !== null;

        return (
          <button
            key={b.type}
            onClick={() => { if (!disabled) void handleBuild(b.type); }}
            disabled={disabled}
            aria-label={`Bygg ${b.name} (${b.cost} 💰)`}
            className={[
              'w-full flex items-center gap-2 px-2 py-1.5 rounded text-xs text-left transition-colors',
              !disabled
                ? 'bg-panelEdge hover:bg-accent/20 text-textHi cursor-pointer'
                : 'bg-panelEdge/50 text-textLo cursor-not-allowed',
            ].join(' ')}
          >
            <span className="text-base">{b.icon}</span>
            <span className="flex-1">
              <span className="font-medium">{b.name}</span>
              {b.requires && <span className="ml-1 text-warn">[{b.requires}]</span>}
            </span>
            <span className="font-mono text-textLo">{b.cost}💰</span>
            <span className="text-textLo">{b.buildTimeMin}m</span>
            {building === b.type && <span className="ml-1">…</span>}
          </button>
        );
      })}
    </div>
  );
}
