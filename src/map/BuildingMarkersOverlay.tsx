import { useEffect, useRef, useState } from 'react';
import type { Viewport } from 'pixi-viewport';
import { useGameStore } from '../game/store';
import { getBuildingPositions } from '../utils/markerPlacement';
import { project } from './projection';
import { BuildingPopup } from './BuildingPopup';
import './building-sprites.css';

interface RegionMeta {
  regionId: string;
  centroid: [number, number]; // [lng, lat] GeoJSON order
}

interface PopupState {
  buildingId: string;
  regionId: string;
  point: { x: number; y: number };
}

interface MarkerData {
  id: string;
  regionId: string;
  buildingId: string;
  worldX: number;
  worldY: number;
  html: string;
  isConstruction: boolean;
  completesAt?: number;
}

const BUILDING_ICONS: Record<string, string> = {
  farm: '🌾', mine: '⛏️', oilrig: '🛢️', harbor: '⚓', barracks: '⚔️', cityExpand: '🏙️',
};

function formatCountdown(ms: number): string {
  if (ms <= 0) return 'Ferdig…';
  const t = Math.ceil(ms / 1000);
  const m = Math.floor(t / 60);
  return m > 0 ? `${m}m ${t % 60}s` : `${t}s`;
}

function harvestStars(pendingHarvest: Partial<Record<string, number>>, maxStorage: number): string {
  const total = Object.values(pendingHarvest).reduce<number>((a, v) => a + (v ?? 0), 0);
  const filled = maxStorage > 0 ? Math.min(3, Math.floor((total / maxStorage) * 3)) : 0;
  return '★'.repeat(filled) + '☆'.repeat(3 - filled);
}

function getZoomClass(scale: number): string {
  if (scale <= 0.6) return 'building-sprite--zoom-sm';
  if (scale <= 1.2) return 'building-sprite--zoom-md';
  return 'building-sprite--zoom-lg';
}

export function BuildingMarkersOverlay({ viewport }: { viewport: Viewport | null }) {
  const regions = useGameStore(s => s.regions);
  const gameId = useGameStore(s => s.gameId);
  const [regionsMeta, setRegionsMeta] = useState<Map<string, RegionMeta>>(new Map());
  const [markers, setMarkers] = useState<MarkerData[]>([]);
  const [popup, setPopup] = useState<PopupState | null>(null);
  const [zoomClass, setZoomClass] = useState('building-sprite--zoom-md');
  const elRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch('/geo/regions-meta.json')
      .then(r => r.json())
      .then((data: RegionMeta[]) => setRegionsMeta(new Map(data.map(m => [m.regionId, m]))))
      .catch(console.error);
  }, []);

  // Rebuild marker data (world coords) when regions change
  useEffect(() => {
    if (regionsMeta.size === 0) return;
    const newMarkers: MarkerData[] = [];

    for (const [regionId, region] of Object.entries(regions)) {
      const meta = regionsMeta.get(regionId);
      if (!meta) continue;

      const buildings = Object.entries(region.buildings ?? {});
      const queue = region.buildQueue ?? [];
      if (buildings.length === 0 && queue.length === 0) continue;

      // centroid is [lng, lat] — getBuildingPositions returns [lat, lon]
      const positions = getBuildingPositions(meta.centroid, buildings.length + queue.length);
      let posIdx = 0;

      for (const [buildingId, building] of buildings) {
        const pos = positions[posIdx++]; // [lat, lon]
        const { x, y } = project(pos[1], pos[0]);
        const icon = BUILDING_ICONS[building.type] ?? '🏗️';
        const stars = harvestStars(building.pendingHarvest ?? {}, building.maxStorage);
        const total = Object.values(building.pendingHarvest ?? {}).reduce<number>((a, v) => a + (v ?? 0), 0);
        const ready = building.maxStorage > 0 && total / building.maxStorage >= 0.8;
        newMarkers.push({
          id: `${regionId}-${buildingId}`,
          regionId,
          buildingId,
          worldX: x,
          worldY: y,
          html: `<span class="building-sprite__icon">${icon}</span><span class="building-sprite__stars">${stars}</span>`,
          isConstruction: false,
          completesAt: undefined,
        });
        void ready;
      }

      for (const item of queue) {
        const pos = positions[posIdx++];
        const { x, y } = project(pos[1], pos[0]);
        const icon = BUILDING_ICONS[item.type] ?? '🏗️';
        newMarkers.push({
          id: `${regionId}-${item.buildingId}-q`,
          regionId,
          buildingId: item.buildingId,
          worldX: x,
          worldY: y,
          html: `<span class="building-sprite__timer">${formatCountdown(item.completesAt - Date.now())}</span><span class="building-sprite__icon">${icon}</span>`,
          isConstruction: true,
          completesAt: item.completesAt,
        });
      }
    }

    setMarkers(newMarkers);
  }, [regions, regionsMeta]);

  // Update DOM positions when viewport moves
  useEffect(() => {
    if (!viewport) return;

    const updatePositions = () => {
      setZoomClass(getZoomClass(viewport.scaled));
      const container = containerRef.current;
      if (!container) return;
      for (const [id, el] of elRefs.current) {
        const marker = markers.find(m => m.id === id);
        if (!marker) continue;
        const screen = viewport.toScreen(marker.worldX, marker.worldY);
        el.style.transform = `translate(${screen.x}px, ${screen.y}px)`;
      }
    };

    viewport.on('moved', updatePositions);
    viewport.on('zoomed', updatePositions);
    updatePositions();

    return () => {
      viewport.off('moved', updatePositions);
      viewport.off('zoomed', updatePositions);
    };
  }, [viewport, markers]);

  // Tick construction countdowns
  useEffect(() => {
    const constructions = markers.filter(m => m.isConstruction && m.completesAt != null);
    if (constructions.length === 0) return;
    const id = setInterval(() => {
      for (const m of constructions) {
        const el = elRefs.current.get(m.id);
        if (!el) continue;
        const timerEl = el.querySelector<HTMLElement>('.building-sprite__timer');
        if (timerEl && m.completesAt != null) {
          timerEl.textContent = formatCountdown(m.completesAt - Date.now());
        }
      }
    }, 1000);
    return () => clearInterval(id);
  }, [markers]);

  if (!gameId) return null;

  return (
    <>
      <div ref={containerRef} className="absolute inset-0 pointer-events-none overflow-hidden">
        {markers.map(marker => (
          <div
            key={marker.id}
            ref={el => {
              if (el) elRefs.current.set(marker.id, el);
              else elRefs.current.delete(marker.id);
            }}
            className={`building-sprite pointer-events-auto z-[500] ${marker.isConstruction ? 'building-sprite--construction' : ''} ${zoomClass}`}
            style={{ position: 'absolute', top: 0, left: 0, transform: 'translate(0px, 0px)' }}
            onClick={e => {
              if (marker.isConstruction) return;
              const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
              setPopup({ buildingId: marker.buildingId, regionId: marker.regionId, point: { x: rect.left + rect.width / 2, y: rect.top } });
            }}
            dangerouslySetInnerHTML={{ __html: marker.html }}
          />
        ))}
      </div>
      {popup && (
        <BuildingPopup
          buildingId={popup.buildingId}
          regionId={popup.regionId}
          gameId={gameId}
          point={popup.point}
          onClose={() => setPopup(null)}
        />
      )}
    </>
  );
}
