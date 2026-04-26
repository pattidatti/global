import { useState } from 'react';
import { BuildingCard } from './BuildingCard';
import { BuildQueueItem } from './BuildQueueItem';
import { BuildMenu } from './BuildMenu';
import type { Region } from '../../types/region';

interface BuildingPanelProps {
  region: Region;
  regionId: string;
  gameId: string;
}

export function BuildingPanel({ region, regionId, gameId }: BuildingPanelProps) {
  const [showMenu, setShowMenu] = useState(false);

  const buildings = region.buildings ?? {};
  const buildQueue = region.buildQueue ?? [];
  const usedSlots = Object.keys(buildings).length + buildQueue.length;
  const slotsLeft = (region.maxSlots ?? 1) - usedSlots;

  return (
    <div className="space-y-2">
      {/* Bygge-kø */}
      {buildQueue.length > 0 && (
        <div>
          <div className="text-xs text-textLo font-medium mb-1">Under bygging</div>
          <div className="divide-y divide-panelEdge">
            {buildQueue.map(item => (
              <BuildQueueItem
                key={item.buildingId}
                item={item}
                regionId={regionId}
                gameId={gameId}
              />
            ))}
          </div>
        </div>
      )}

      {/* Eksisterende bygninger */}
      {Object.entries(buildings).length > 0 && (
        <div>
          <div className="text-xs text-textLo font-medium mb-1">Bygninger</div>
          <div className="space-y-1">
            {Object.entries(buildings).map(([bid, building]) => (
              <BuildingCard
                key={bid}
                buildingId={bid}
                building={building}
                regionId={regionId}
                gameId={gameId}
              />
            ))}
          </div>
        </div>
      )}

      {/* Bygg ny / tomt */}
      {Object.keys(buildings).length === 0 && buildQueue.length === 0 && (
        <p className="text-textLo text-xs">Ingen bygninger ennå.</p>
      )}

      {/* Bygg-meny */}
      {showMenu ? (
        <BuildMenu
          region={region}
          regionId={regionId}
          gameId={gameId}
          onClose={() => setShowMenu(false)}
        />
      ) : (
        <button
          onClick={() => setShowMenu(true)}
          disabled={slotsLeft <= 0}
          aria-label="Bygg ny bygning"
          className={[
            'w-full py-1 rounded text-xs font-medium mt-1 transition-colors',
            slotsLeft > 0
              ? 'bg-accent/20 hover:bg-accent/30 text-accent'
              : 'bg-panelEdge/30 text-inkLo cursor-not-allowed',
          ].join(' ')}
        >
          {slotsLeft > 0 ? '+ Bygg ny' : 'Ingen ledige plasser'}
        </button>
      )}
    </div>
  );
}
