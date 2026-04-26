import { useState, useEffect, useMemo, useRef } from 'react';
import { MapView } from '../map/MapView';
import { MapModeControl } from '../map/MapModeControl';
import type { MapMode } from '../map/MapModeControl';
import { computeGraphColoring } from '../map/graphColoring';
import { NasjonsPanel } from '../features/nation/NasjonsPanel';
import { KontekstPanel } from '../features/region/KontekstPanel';
import { FloatingPanel } from '../ui/FloatingPanel';
import { useMyPlayer } from '../game/selectors';
import { useGameStore } from '../game/store';
import type { GeoJsonMeta } from '../types/region';

async function loadJson<T>(url: string, fallback: T): Promise<T> {
  try {
    const res = await fetch(url);
    if (!res.ok) return fallback;
    return (await res.json()) as T;
  } catch {
    return fallback;
  }
}

const EMPTY_GEOJSON: GeoJSON.FeatureCollection = { type: 'FeatureCollection', features: [] };

function getFeatureCenter(feature: GeoJSON.Feature): [number, number] | null {
  const coords: number[][] = [];
  const geom = feature.geometry;
  if (geom.type === 'Polygon') {
    geom.coordinates[0].forEach(c => coords.push(c));
  } else if (geom.type === 'MultiPolygon') {
    geom.coordinates.forEach(poly => poly[0].forEach(c => coords.push(c)));
  }
  if (coords.length === 0) return null;
  const lons = coords.map(c => c[0]);
  const lats = coords.map(c => c[1]);
  return [
    (Math.min(...lats) + Math.max(...lats)) / 2,
    (Math.min(...lons) + Math.max(...lons)) / 2,
  ];
}

export function MapScreen() {
  const [adjacency, setAdjacency] = useState<Record<string, string[]>>({});
  const [geojson, setGeojson] = useState<GeoJSON.FeatureCollection>(EMPTY_GEOJSON);
  const [flyTarget, setFlyTarget] = useState<[number, number] | null>(null);
  const [mapMode, setMapMode] = useState<MapMode>('region');

  const regionColors = useMemo(() => computeGraphColoring(adjacency), [adjacency]);

  const player = useMyPlayer();
  const setSelectedRegion = useGameStore(s => s.setSelectedRegion);
  const gameId = useGameStore(s => s.gameId);
  const autoSelectedRef = useRef(false);

  const geojsonMeta = useMemo<Record<string, GeoJsonMeta>>(() => {
    const out: Record<string, GeoJsonMeta> = {};
    for (const f of geojson.features) {
      const p = f.properties as {
        regionId?: string; name?: string; biome?: string;
        iso?: string; culturalGroup?: string;
      } | null;
      if (p?.regionId) {
        out[p.regionId] = {
          name: p.name ?? p.regionId,
          biome: p.biome ?? 'other',
          iso: p.iso ?? '',
          culturalGroup: p.culturalGroup ?? '',
        };
      }
    }
    return out;
  }, [geojson]);

  useEffect(() => {
    void loadJson<Record<string, string[]>>('/geo/adjacency.json', {}).then(setAdjacency);
    void loadJson<GeoJSON.FeatureCollection>('/geo/regions.geojson', EMPTY_GEOJSON).then(setGeojson);
  }, []);

  // Nullstill auto-valg ved game-bytte
  useEffect(() => {
    autoSelectedRef.current = false;
  }, [gameId]);

  // Auto-velg spillerens startregion og zoom dit én gang ved innlasting
  useEffect(() => {
    if (autoSelectedRef.current) return;
    const regionIds = player?.regionIds ?? [];
    if (regionIds.length === 0 || geojson.features.length === 0) return;

    autoSelectedRef.current = true;
    const firstId = regionIds[0];
    setSelectedRegion(firstId);

    const feature = geojson.features.find(
      f => (f.properties as { regionId?: string } | null)?.regionId === firstId,
    );
    if (feature) {
      const center = getFeatureCenter(feature);
      if (center) setFlyTarget(center);
    }
  // Trigger når enten spillerdata eller geojson laster inn
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [player?.regionIds?.length, geojson.features.length]);

  return (
    <div className="relative flex-1 overflow-hidden">
      <MapView geojson={geojson} adjacency={adjacency} flyTarget={flyTarget} mapMode={mapMode} regionColors={regionColors} />

      <div className="absolute bottom-6 right-2 z-[1000]">
        <MapModeControl mode={mapMode} onChange={setMapMode} />
      </div>

      <FloatingPanel
        title="Mitt rike"
        anchor="top-left"
        width={300}
        maxHeight="calc(100% - 24px)"
      >
        <NasjonsPanel adjacency={adjacency} />
      </FloatingPanel>

      <FloatingPanel
        title="Detaljer"
        anchor="top-right"
        width={320}
        maxHeight="calc(100% - 24px)"
      >
        <KontekstPanel adjacency={adjacency} geojsonMeta={geojsonMeta} />
      </FloatingPanel>
    </div>
  );
}
