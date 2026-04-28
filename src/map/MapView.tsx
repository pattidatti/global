import { useRef, useMemo, useEffect, useState } from 'react';
import { usePixiApp } from './usePixiApp';
import { usePixiViewport } from './usePixiViewport';
import { projectFeatures } from './geoProjector';
import { project } from './projection';
import { RegionGraphicsLayer } from './RegionGraphicsLayer';
import { useRegionLayer } from './RegionLayer';
import { BuildingMarkersOverlay } from './BuildingMarkersOverlay';
import { OceanLayer } from './effects/OceanLayer';
import { CloudLayer } from './effects/CloudLayer';
import { VignetteOverlay } from './effects/VignetteOverlay';
import { useGameStore } from '../game/store';
import type { MapMode } from './MapModeControl';
import type { Viewport } from 'pixi-viewport';

interface MapViewProps {
  geojson?: GeoJSON.FeatureCollection | null;
  adjacency?: Record<string, string[]>;
  flyTarget?: [number, number] | null;
  mapMode?: MapMode;
  regionColors?: Record<string, string>;
}

const EMPTY_GEOJSON: GeoJSON.FeatureCollection = { type: 'FeatureCollection', features: [] };

// Inner component that runs after both app + viewport are ready
function MapCanvas({
  geojson,
  adjacency,
  flyTarget,
  mapMode,
  regionColors,
  viewport,
}: MapViewProps & { viewport: Viewport }) {
  const setSelectedRegion = useGameStore(s => s.setSelectedRegion);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const layerRef = useRef<RegionGraphicsLayer | null>(null);
  const prevFlyRef = useRef<string>('');

  const features = useMemo(() => projectFeatures(geojson ?? EMPTY_GEOJSON), [geojson]);

  // Build region graphics once per geojson load
  useEffect(() => {
    if (features.length === 0) return;
    const layer = new RegionGraphicsLayer(viewport, setSelectedRegion, setHoveredId);
    layer.buildAll(features);
    layerRef.current = layer;
    return () => {
      layer.destroy();
      layerRef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [features, viewport]);

  // Zustand → PixiJS style bridge
  useRegionLayer(layerRef, adjacency ?? {}, mapMode, regionColors);

  // FlyTo — flyTarget is [lat, lon]
  useEffect(() => {
    if (!flyTarget) return;
    const key = `${flyTarget[0]},${flyTarget[1]}`;
    if (prevFlyRef.current === key) return;
    prevFlyRef.current = key;
    const { x, y } = project(flyTarget[1], flyTarget[0]);
    viewport.animate({ position: { x, y }, scale: 3, time: 800 });
  }, [flyTarget, viewport]);

  const hoveredName = hoveredId
    ? features.find(f => f.regionId === hoveredId)?.name ?? hoveredId
    : null;

  return (
    <>
      <div
        className="absolute inset-0"
        onMouseMove={e => setMousePos({ x: e.clientX, y: e.clientY })}
      />
      {hoveredName && (
        <div
          className="pointer-events-none absolute z-[500] px-2 py-1 text-xs font-serif bg-panel border border-panelEdge/60 rounded shadow-paper text-ink whitespace-nowrap"
          style={{ left: mousePos.x + 14, top: mousePos.y - 28 }}
        >
          {hoveredName}
        </div>
      )}
      <BuildingMarkersOverlay viewport={viewport} />
    </>
  );
}

export function MapView({ geojson, adjacency = {}, flyTarget, mapMode, regionColors }: MapViewProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const app = usePixiApp(canvasRef);
  const viewport = usePixiViewport(app);

  // Visual effects — created once when both app and viewport are ready
  useEffect(() => {
    if (!app || !viewport) return;
    const ocean = new OceanLayer(app, viewport);
    const clouds = new CloudLayer(app, viewport);
    const vignette = new VignetteOverlay(app);
    return () => {
      ocean.destroy();
      clouds.destroy();
      vignette.destroy();
    };
  }, [app, viewport]);

  return (
    <div className="relative w-full h-full">
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />
      {viewport && (
        <MapCanvas
          geojson={geojson}
          adjacency={adjacency}
          flyTarget={flyTarget}
          mapMode={mapMode}
          regionColors={regionColors}
          viewport={viewport}
        />
      )}
    </div>
  );
}
