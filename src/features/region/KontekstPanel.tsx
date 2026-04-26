import { useRegion } from '../../game/selectors';
import { useGameStore } from '../../game/store';
import { Panel } from '../../ui/Panel';
import { IntegrationBar } from './IntegrationBar';
import { BuildingPanel } from '../building/BuildingPanel';
import { ExpandButton } from '../expansion/ExpandButton';
import { NpcInfluencePanel } from '../expansion/NpcInfluencePanel';
import { EXPAND_MILITARY_COST } from '../../constants';
import type { GeoJsonMeta } from '../../types/region';

const BIOME_LABELS: Record<string, { icon: string; name: string }> = {
  plains:   { icon: '🌿', name: 'Slette' },
  coast:    { icon: '🌊', name: 'Kyst' },
  mountain: { icon: '⛰️', name: 'Fjell' },
  desert:   { icon: '🏜️', name: 'Ørken' },
  arctic:   { icon: '❄️', name: 'Arktis' },
  regnskog: { icon: '🌳', name: 'Regnskog' },
  other:    { icon: '🗺️', name: 'Annet' },
};

interface KontekstPanelProps {
  adjacency: Record<string, string[]>;
  geojsonMeta: Record<string, GeoJsonMeta>;
}

export function KontekstPanel({ adjacency, geojsonMeta }: KontekstPanelProps) {
  const { selectedRegionId, slotId, gameId, players } = useGameStore();
  const region = useRegion(selectedRegionId ?? '');

  if (!selectedRegionId) {
    return (
      <div className="p-6 text-center">
        <p className="text-inkLo text-xs italic font-serif">
          Klikk på en region på kartet for å se detaljer.
        </p>
      </div>
    );
  }

  // NPC-region ikke seeda inn i RTDB — vis GeoJSON-metadata som fallback
  if (!region) {
    const meta = geojsonMeta[selectedRegionId];
    const biome = BIOME_LABELS[meta?.biome ?? 'other'] ?? BIOME_LABELS.other;
    const neighbors = adjacency[selectedRegionId] ?? [];
    const playerRegionIds = slotId ? (players[slotId]?.regionIds ?? []) : [];
    const ownsNeighbor = playerRegionIds.some(id => neighbors.includes(id));
    const myMilitary = slotId ? (players[slotId]?.military ?? 0) : 0;
    const hasMilitaryForExpansion = myMilitary >= EXPAND_MILITARY_COST;

    return (
      <div
        className="p-2 flex flex-col gap-2"
        aria-label={`Detaljer for ${selectedRegionId}`}
      >
        <Panel title={meta?.name ?? selectedRegionId}>
          <div className="space-y-1 text-xs">
            <div className="flex items-center gap-1 text-textLo">
              <span aria-hidden="true">{biome.icon}</span>
              <span>{biome.name}</span>
            </div>
            <div className="text-textLo">NPC-region</div>
          </div>
        </Panel>

        {!ownsNeighbor && (
          <Panel title="Hva kan du gjøre?">
            <p className="text-xs text-textLo leading-relaxed">
              Du har ingen naboregioner hit ennå. Ekspander imperiet til en region
              som grenser mot denne for å kunne overta den.
            </p>
          </Panel>
        )}

        {ownsNeighbor && !hasMilitaryForExpansion && !!gameId && (
          <Panel title="Nesten klar">
            <p className="text-xs text-textLo leading-relaxed">
              Du grenser mot denne regionen, men trenger {EXPAND_MILITARY_COST} ⚔️ militær.
              Bygg kaserner i dine regioner for å øke militærmakten.
            </p>
          </Panel>
        )}

        {ownsNeighbor && hasMilitaryForExpansion && !!gameId && (
          <Panel title="Klar til ekspansjon">
            <p className="text-xs text-textLo leading-relaxed">
              Du grenser mot denne regionen. Bruk militærmakt, invester penger,
              eller prøv diplomatisk overtakelse.
            </p>
          </Panel>
        )}
      </div>
    );
  }

  const isMyRegion = region.ownerId === slotId;
  const isNPC = region.ownerId === null;
  const ownerPlayer = region.ownerId ? players[region.ownerId] : null;
  const biome = BIOME_LABELS[region.biome ?? 'other'] ?? BIOME_LABELS.other;
  const meta = geojsonMeta[selectedRegionId];

  const playerRegionIds = slotId ? (players[slotId]?.regionIds ?? []) : [];
  const neighbors = adjacency[selectedRegionId] ?? [];
  const ownsNeighbor = playerRegionIds.some(id => neighbors.includes(id));
  const myMilitary = slotId ? (players[slotId]?.military ?? 0) : 0;
  const hasMilitaryForExpansion = myMilitary >= EXPAND_MILITARY_COST;
  const canExpand = isNPC && (ownsNeighbor || neighbors.length === 0) && !!gameId;

  return (
    <div
      className="p-2 flex flex-col gap-2"
      aria-label={`Detaljer for ${selectedRegionId}`}
    >
      {/* Regionhode */}
      <Panel title={meta?.name ?? selectedRegionId}>
        <div className="space-y-1 text-xs">
          {isMyRegion && (
            <div className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-accent/20 text-accent text-xs font-semibold mb-1">
              <span aria-hidden="true">★</span>
              <span>Din region</span>
            </div>
          )}
          <div className="flex items-center gap-1 text-textLo">
            <span aria-hidden="true">{biome.icon}</span>
            <span>{biome.name}</span>
          </div>
          <div className="flex items-center gap-1">
            {isNPC ? (
              <span className="text-textLo">NPC-region</span>
            ) : ownerPlayer ? (
              <>
                <span
                  className="w-2.5 h-2.5 rounded-full inline-block"
                  style={{ backgroundColor: ownerPlayer.empireColor }}
                  aria-hidden="true"
                />
                <span className="text-textHi">{ownerPlayer.displayName}</span>
              </>
            ) : null}
          </div>
          <div className="text-textLo">
            <span>Tilfredshet: {Math.round(region.satisfaction ?? 0)}%</span>
            <span className="mx-2">·</span>
            <span>Forsvar: {region.defense ?? 0}</span>
          </div>
        </div>
      </Panel>

      {/* Integrasjonsbar */}
      {region.integration < 100 && region.integrationStartedAt !== null && (
        <div className="px-2">
          <IntegrationBar
            integration={region.integration}
            integrationStartedAt={region.integrationStartedAt}
          />
        </div>
      )}

      {/* Egne regioner: vis bygningspanel */}
      {isMyRegion && gameId && (
        <Panel title="Bygninger">
          <BuildingPanel
            region={region}
            regionId={selectedRegionId}
            gameId={gameId}
          />
        </Panel>
      )}

      {/* Ressurser i regionen */}
      {isMyRegion && Object.keys(region.resources ?? {}).length > 0 && (
        <Panel title="Lager">
          <div className="grid grid-cols-2 gap-1 text-xs">
            {Object.entries(region.resources ?? {}).map(([res, val]) => (
              <div key={res} className="flex justify-between text-textHi">
                <span className="text-textLo capitalize">{res}</span>
                <span className="font-mono">{Math.floor(val ?? 0)}</span>
              </div>
            ))}
          </div>
        </Panel>
      )}

      {/* NPC-naboregion: ekspander-knapp + diplomati/invester */}
      {canExpand && (
        <div className="space-y-2">
          <div className="px-1">
            <ExpandButton targetRegionId={selectedRegionId} gameId={gameId} />
          </div>
          <NpcInfluencePanel targetRegionId={selectedRegionId} gameId={gameId} />
        </div>
      )}

      {/* Fremmed region */}
      {!isMyRegion && !isNPC && (
        <Panel title="Fremmed region">
          <p className="text-xs text-textLo leading-relaxed">
            Denne regionen tilhører {ownerPlayer?.displayName ?? 'en annen spiller'}.
            Bruk diplomati eller militærmakt for å påvirke forholdet.
          </p>
        </Panel>
      )}

      {/* NPC-region: kontekstuell veiledning */}
      {isNPC && !canExpand && !ownsNeighbor && (
        <Panel title="Hva kan du gjøre?">
          <p className="text-xs text-textLo leading-relaxed">
            Du har ingen naboregioner hit. Ekspander imperiet til en region
            som grenser mot denne, så kan du overta den.
          </p>
        </Panel>
      )}

      {isNPC && ownsNeighbor && !hasMilitaryForExpansion && !!gameId && (
        <Panel title="Nesten klar">
          <p className="text-xs text-textLo leading-relaxed">
            Du grenser mot denne regionen, men trenger {EXPAND_MILITARY_COST} ⚔️ militær.
            Bygg kaserner i dine regioner for å øke militærmakten.
          </p>
        </Panel>
      )}
    </div>
  );
}
