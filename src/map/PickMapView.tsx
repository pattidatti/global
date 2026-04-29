import { useRef, useMemo, useEffect } from 'react';
import { usePixiApp } from './usePixiApp';
import { usePixiViewport } from './usePixiViewport';
import { projectFeatures } from './geoProjector';
import { usePickRegionLayer } from './PickRegionLayer';
import { OceanLayer } from './effects/OceanLayer';
import { VignetteOverlay } from './effects/VignetteOverlay';
import type { Viewport } from 'pixi-viewport';

interface PickMapViewProps {
  geojson: GeoJSON.FeatureCollection;
  takenRegionIds: Set<string>;
  selectedRegionId: string | null;
  onRegionClick: (regionId: string) => void;
}

const EMPTY_FEATURES: ReturnType<typeof projectFeatures> = [];

function PickLayerBridge({
  viewport,
  geojson,
  takenRegionIds,
  selectedRegionId,
  onRegionClick,
}: PickMapViewProps & { viewport: Viewport }) {
  const features = useMemo(() => projectFeatures(geojson), [geojson]);

  usePickRegionLayer({ features, takenRegionIds, selectedRegionId, onRegionClick, viewport });

  return null;
}

export function PickMapView({ geojson, takenRegionIds, selectedRegionId, onRegionClick }: PickMapViewProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const app = usePixiApp(canvasRef);
  const viewport = usePixiViewport(app);

  useEffect(() => {
    if (!app || !viewport) return;
    let ocean: OceanLayer | null = null;
    let vignette: VignetteOverlay | null = null;
    try { ocean = new OceanLayer(app, viewport); }
    catch (e) { console.error('[PickMapView] OceanLayer feilet', e); }
    try { vignette = new VignetteOverlay(app); }
    catch (e) { console.error('[PickMapView] VignetteOverlay feilet', e); }
    return () => {
      try { ocean?.destroy(); } catch { /* noop */ }
      try { vignette?.destroy(); } catch { /* noop */ }
    };
  }, [app, viewport]);

  void EMPTY_FEATURES;

  return (
    <div className="relative w-full h-full">
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />
      {viewport && (
        <PickLayerBridge
          viewport={viewport}
          geojson={geojson}
          takenRegionIds={takenRegionIds}
          selectedRegionId={selectedRegionId}
          onRegionClick={onRegionClick}
        />
      )}
    </div>
  );
}
