import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { firebaseApp } from '../firebase/config';
import { useGameStore } from '../game/store';

const BUILDING_LABELS: Record<string, { icon: string; name: string }> = {
  farm:       { icon: '🌾', name: 'Gård' },
  mine:       { icon: '⛏️', name: 'Gruve' },
  oilrig:     { icon: '🛢️', name: 'Oljerigg' },
  harbor:     { icon: '⚓', name: 'Havn' },
  barracks:   { icon: '⚔️', name: 'Kaserne' },
  cityExpand: { icon: '🏙️', name: 'Byvekst' },
};

const RESOURCE_ICONS: Record<string, string> = {
  food: '🌾', oil: '🛢️', metal: '⛏️', trade: '🤝', military: '⚔️', influence: '🌟',
};

function formatCountdown(ms: number): string {
  if (ms <= 0) return 'Ferdig snart…';
  const totalSec = Math.ceil(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

interface BuildingPopupProps {
  buildingId: string;
  regionId: string;
  gameId: string;
  point: { x: number; y: number };
  onClose: () => void;
}

export function BuildingPopup({ buildingId, regionId, gameId, point, onClose }: BuildingPopupProps) {
  const { regions, pendingHarvests, setPendingHarvest } = useGameStore();
  const region = regions[regionId];
  const building = region?.buildings?.[buildingId];
  const [, forceUpdate] = useState(0);

  // Update timer display every second
  useEffect(() => {
    const id = setInterval(() => forceUpdate(n => n + 1), 1000);
    return () => clearInterval(id);
  }, []);

  if (!building) return null;

  const meta = BUILDING_LABELS[building.type] ?? { icon: '🏗️', name: building.type };
  const pending = building.pendingHarvest ?? {};
  const hasHarvest = Object.values(pending).some(v => (v ?? 0) > 0);
  const isHarvesting = pendingHarvests.has(buildingId);
  const total = Object.values(pending).reduce<number>((a, v) => a + (v ?? 0), 0);
  const fillRatio = building.maxStorage > 0 ? total / building.maxStorage : 0;
  const stars = Math.min(3, Math.floor(fillRatio * 3));
  const nextHarvestMs = building.lastHarvestedAt > 0
    ? building.lastHarvestedAt + 10 * 60 * 1000 - Date.now()
    : 0;

  async function handleHarvest() {
    if (!hasHarvest || isHarvesting) return;
    setPendingHarvest(buildingId, true);
    try {
      const fns = getFunctions(firebaseApp, 'europe-west1');
      await httpsCallable(fns, 'harvestBuilding')({ gameId, regionId, buildingId });
    } catch (err) {
      console.error('Høsting feilet:', err);
    } finally {
      setPendingHarvest(buildingId, false);
    }
  }

  // Position popup above the sprite in fixed viewport coords (point is already page-relative)
  const left = Math.min(point.x - 104, window.innerWidth - 224);
  const top = Math.max(8, point.y - 170);

  return createPortal(
    <div
      className="fixed z-[9999] w-52 rounded-lg border border-panelEdge bg-panel shadow-xl text-sm"
      style={{ left, top }}
    >
      {/* Header */}
      <div className="flex items-center gap-2 px-3 pt-3 pb-2 border-b border-panelEdge">
        <span className="text-xl">{meta.icon}</span>
        <span className="flex-1 font-medium text-textHi">{meta.name}</span>
        <button
          onClick={onClose}
          className="text-textLo hover:text-textHi transition-colors leading-none"
          aria-label="Lukk"
        >
          ✕
        </button>
      </div>

      {/* Stars + resources */}
      <div className="px-3 py-2 space-y-1.5">
        <div className="flex items-center gap-1.5">
          <span className="text-warn text-xs tracking-wide">
            {'★'.repeat(stars)}{'☆'.repeat(3 - stars)}
          </span>
          {hasHarvest && (
            <span className="text-xs text-textLo">
              {Object.entries(pending).map(([r, v]) => (
                <span key={r} className="mr-1">{RESOURCE_ICONS[r] ?? '•'} {Math.floor(v ?? 0)}</span>
              ))}
            </span>
          )}
        </div>

        {/* Next harvest timer */}
        {!hasHarvest && nextHarvestMs > 0 && (
          <div className="text-xs text-textLo">
            Neste høst: <span className="font-mono">{formatCountdown(nextHarvestMs)}</span>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex gap-2 px-3 pb-3">
        <button
          onClick={handleHarvest}
          disabled={!hasHarvest || isHarvesting}
          className={[
            'flex-1 py-1.5 rounded text-xs font-medium transition-colors',
            hasHarvest && !isHarvesting
              ? 'bg-good text-panel hover:brightness-110 animate-pulse'
              : 'bg-panelEdge/30 text-textLo cursor-not-allowed',
          ].join(' ')}
        >
          {isHarvesting ? '…' : 'Høst'}
        </button>
        <button
          disabled
          title="Kommende funksjon"
          className="flex-1 py-1.5 rounded text-xs font-medium bg-panelEdge/30 text-textLo cursor-not-allowed"
        >
          Oppgrader →
        </button>
      </div>
    </div>,
    document.body
  );
}
