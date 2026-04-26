import { getFunctions, httpsCallable } from 'firebase/functions';
import { firebaseApp } from '../../firebase/config';
import { useGameStore } from '../../game/store';
import type { Building } from '../../types/region';

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

interface BuildingCardProps {
  buildingId: string;
  building: Building;
  regionId: string;
  gameId: string;
}

export function BuildingCard({ buildingId, building, regionId, gameId }: BuildingCardProps) {
  const { setPendingHarvest, pendingHarvests } = useGameStore();
  const meta = BUILDING_LABELS[building.type] ?? { icon: '🏗️', name: building.type };
  const pending = building.pendingHarvest ?? {};
  const hasHarvest = Object.values(pending).some(v => (v ?? 0) > 0);
  const isHarvesting = pendingHarvests.has(buildingId);

  async function handleHarvest() {
    if (!hasHarvest || isHarvesting) return;
    setPendingHarvest(buildingId, true);
    try {
      const fns = getFunctions(firebaseApp, 'europe-west1');
      const harvestBuilding = httpsCallable(fns, 'harvestBuilding');
      await harvestBuilding({ gameId, regionId, buildingId });
    } catch (err) {
      console.error('Høsting feilet:', err);
    } finally {
      setPendingHarvest(buildingId, false);
    }
  }

  return (
    <div className="rounded border border-panelEdge p-2 flex items-start gap-2 text-sm">
      <span className="text-xl" aria-hidden="true">{meta.icon}</span>
      <div className="flex-1 min-w-0">
        <div className="text-textHi font-medium text-xs">{meta.name}</div>
        <div className="flex flex-wrap gap-x-2 text-xs text-textLo mt-0.5">
          {Object.entries(pending).map(([res, val]) => (
            <span key={res}>
              {RESOURCE_ICONS[res] ?? '•'} {Math.floor(val ?? 0)}
            </span>
          ))}
          {!hasHarvest && <span className="italic">Produserer…</span>}
        </div>
      </div>
      <button
        onClick={handleHarvest}
        disabled={!hasHarvest || isHarvesting}
        aria-label={`Høst fra ${meta.name}`}
        className={[
          'shrink-0 px-2 py-0.5 rounded text-xs font-medium transition-colors',
          hasHarvest && !isHarvesting
            ? 'bg-good text-panel hover:brightness-110 ring-2 ring-good ring-offset-1 ring-offset-panel animate-pulse'
            : 'bg-panelEdge/30 text-inkLo cursor-not-allowed',
        ].join(' ')}
      >
        {isHarvesting ? '…' : 'Høst'}
      </button>
    </div>
  );
}
