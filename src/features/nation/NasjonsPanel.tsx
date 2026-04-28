import { useState, useMemo } from 'react';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { useMyPlayer, useMyRegions, useTotalResources } from '../../game/selectors';
import { useGameStore } from '../../game/store';
import { firebaseApp } from '../../firebase/config';
import { Panel } from '../../ui/Panel';
import { estimateTotalOutput } from '../../utils/production';
import { NationModal } from './NationModal';

interface NasjonsPanelProps {
  adjacency: Record<string, string[]>;
}

const RESOURCE_META: { key: string; icon: string; label: string }[] = [
  { key: 'food',   icon: '🌾', label: 'Mat' },
  { key: 'oil',    icon: '🛢️', label: 'Olje' },
  { key: 'metal',  icon: '⛏️', label: 'Metall' },
  { key: 'trade',  icon: '🤝', label: 'Handel' },
];

const BUILDING_LABELS: Record<string, string> = {
  farm:       '🌾 Gård',
  mine:       '⛏️ Gruve',
  oilrig:     '🛢️ Oljerigg',
  harbor:     '⚓ Havn',
  barracks:   '⚔️ Kaserne',
  cityExpand: '🏙️ Byvekst',
};

export function NasjonsPanel({ adjacency }: NasjonsPanelProps) {
  const player = useMyPlayer();
  const myRegions = useMyRegions();
  const resources = useTotalResources();
  const outputPerTick = estimateTotalOutput(myRegions);
  const nations = useGameStore(s => s.nations);
  const gameId = useGameStore(s => s.gameId);
  const pendingHarvests = useGameStore(s => s.pendingHarvests);
  const setPendingHarvest = useGameStore(s => s.setPendingHarvest);
  const [showNationModal, setShowNationModal] = useState(false);
  const [isHarvestingAll, setIsHarvestingAll] = useState(false);

  const myNation = player?.nationId ? nations[player.nationId] ?? null : null;

  const readyBuildings = useMemo(() => {
    const result: { regionId: string; buildingId: string }[] = [];
    for (const [regionId, region] of Object.entries(myRegions)) {
      for (const [buildingId, building] of Object.entries(region.buildings ?? {})) {
        const hasPending = Object.values(building.pendingHarvest ?? {}).some(v => (v ?? 0) > 0);
        if (hasPending && !pendingHarvests.has(buildingId)) {
          result.push({ regionId, buildingId });
        }
      }
    }
    return result;
  }, [myRegions, pendingHarvests]);

  async function harvestAll() {
    if (!gameId || readyBuildings.length === 0 || isHarvestingAll) return;
    setIsHarvestingAll(true);
    const fns = getFunctions(firebaseApp, 'europe-west1');
    const fn = httpsCallable(fns, 'harvestBuilding');
    await Promise.allSettled(
      readyBuildings.map(({ regionId, buildingId }) => {
        setPendingHarvest(buildingId, true);
        return fn({ gameId, regionId, buildingId }).finally(() => setPendingHarvest(buildingId, false));
      }),
    );
    setIsHarvestingAll(false);
  }

  if (!player) {
    return (
      <div className="p-2">
        <Panel title="Imperium">
          <p className="text-textLo text-xs">Ikke tilkoblet</p>
        </Panel>
      </div>
    );
  }

  // Tell bygninger på tvers av alle regioner
  const buildingCounts: Record<string, number> = {};
  for (const region of Object.values(myRegions)) {
    for (const building of Object.values(region.buildings ?? {})) {
      buildingCounts[building.type] = (buildingCounts[building.type] ?? 0) + 1;
    }
  }

  return (
    <div
      className="p-2 flex flex-col gap-2"
      aria-label="Imperiumoversikt"
    >
      {/* Imperiuminfo */}
      <Panel title="Imperium">
        <div className="space-y-1 text-sm">
          <div className="flex items-center gap-2">
            <span
              className="w-3 h-3 rounded-full shrink-0"
              style={{ backgroundColor: player.empireColor }}
              aria-hidden="true"
            />
            <span className="font-semibold text-textHi truncate">{player.displayName}</span>
          </div>
          <div className="text-textLo text-xs">
            {player.regionIds.length} region{player.regionIds.length !== 1 ? 'er' : ''}
          </div>
          <div className="grid grid-cols-3 gap-1 pt-1 text-xs">
            <div className="text-center">
              <div className="text-textHi font-mono">{player.treasury}</div>
              <div className="text-textLo">💰</div>
            </div>
            <div className="text-center">
              <div className="text-textHi font-mono">{player.military}</div>
              <div className="text-textLo">⚔️</div>
            </div>
            <div className="text-center">
              <div className="text-textHi font-mono">{player.influence}</div>
              <div className="text-textLo">🌟</div>
            </div>
          </div>
        </div>
      </Panel>

      {/* Ressurser */}
      <Panel title="Ressurser">
        {RESOURCE_META.map(({ key, icon, label }) => {
          const amount = Math.floor(resources[key] ?? 0);
          const rate = (outputPerTick[key] ?? 0).toFixed(1);
          const isLow = amount < 100;
          return (
            <div key={key} className="flex items-center justify-between py-0.5 text-xs">
              <span className="text-textLo">{icon} {label}</span>
              <span className={`font-mono ${isLow ? 'text-warn' : 'text-textHi'}`}>
                {amount}
                {Number(rate) > 0 && (
                  <span className="text-good ml-1">+{rate}/tikk</span>
                )}
              </span>
            </div>
          );
        })}
        {Object.keys(resources).length === 0 && (
          <p className="text-textLo text-xs">Ingen ressurser ennå.</p>
        )}
      </Panel>

      {/* Bygninger + høst-alle */}
      <Panel title="Bygninger">
        {Object.entries(buildingCounts).length > 0 ? (
          <div className="space-y-0.5 text-xs">
            {Object.entries(buildingCounts).map(([type, count]) => (
              <div key={type} className="flex justify-between text-textHi">
                <span>{BUILDING_LABELS[type] ?? type}</span>
                <span className="font-mono text-textLo">×{count}</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-textLo text-xs">Ingen bygninger ennå.</p>
        )}
        {readyBuildings.length > 0 && (
          <button
            type="button"
            onClick={() => void harvestAll()}
            disabled={isHarvestingAll}
            className={[
              'mt-2 w-full py-1.5 px-2 rounded text-xs font-semibold transition-colors',
              isHarvestingAll
                ? 'bg-panelEdge/30 text-inkLo cursor-not-allowed'
                : 'bg-good text-panel hover:brightness-110 animate-pulse ring-1 ring-good ring-offset-1 ring-offset-panel',
            ].join(' ')}
          >
            {isHarvestingAll ? 'Høster…' : `🌾 Høst alle (${readyBuildings.length})`}
          </button>
        )}
      </Panel>

      {/* Nasjon */}
      <Panel title="Nasjon">
        {myNation ? (
          <div className="space-y-1 text-xs">
            <div className="flex items-center gap-2">
              <span className="text-lg" aria-hidden="true">{myNation.flag}</span>
              <span
                className="w-3 h-3 rounded-full shrink-0"
                style={{ backgroundColor: myNation.color }}
                aria-hidden="true"
              />
              <span className="font-semibold text-textHi truncate">{myNation.name}</span>
            </div>
            <div className="text-textLo">
              {myNation.dominantCulture} · kulturmatch {Math.round(myNation.cultureMatch * 100)} %
            </div>
            <div className="text-textLo">
              {myNation.members.length} medlem{myNation.members.length !== 1 ? 'mer' : ''}
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setShowNationModal(true)}
            className="w-full py-1.5 px-2 rounded-paper bg-accent hover:brightness-110 text-panel text-xs font-semibold shadow-paper"
          >
            Dann nasjon
          </button>
        )}
      </Panel>

      {showNationModal && (
        <NationModal adjacency={adjacency} onClose={() => setShowNationModal(false)} />
      )}
    </div>
  );
}
