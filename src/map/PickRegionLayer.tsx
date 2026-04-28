import { useEffect, useRef } from 'react';
import { Graphics, Container } from 'pixi.js';
import type { Viewport } from 'pixi-viewport';
import type { ProjectedFeature } from './geoProjector';

const COLOR_AVAILABLE = 0x3da9fc;
const COLOR_TAKEN     = 0x3a3f2e;
const COLOR_SELECTED  = 0x4caf7d;

interface PickRegionLayerProps {
  features: ProjectedFeature[];
  takenRegionIds: Set<string>;
  selectedRegionId: string | null;
  onRegionClick: (regionId: string) => void;
  viewport: Viewport;
}

function drawRegion(
  gfx: Graphics,
  feature: ProjectedFeature,
  taken: boolean,
  selected: boolean,
): void {
  gfx.clear();
  for (const ring of feature.rings) {
    const color = selected ? COLOR_SELECTED : taken ? COLOR_TAKEN : COLOR_AVAILABLE;
    const alpha = selected ? 0.65 : taken ? 0.4 : 0.35;
    const borderColor = selected ? COLOR_SELECTED : taken ? 0x5a6050 : 0x2a8fd0;
    gfx.poly(ring)
      .fill({ color, alpha })
      .stroke({ color: borderColor, width: selected ? 2 : 1 });
  }
  gfx.eventMode = taken ? 'none' : 'static';
  gfx.cursor = taken ? 'default' : 'pointer';
}

export function usePickRegionLayer({
  features,
  takenRegionIds,
  selectedRegionId,
  onRegionClick,
  viewport,
}: PickRegionLayerProps): void {
  const gfxMapRef = useRef<Map<string, Graphics>>(new Map());

  // Keep latest callback + style data in refs so effects always see fresh values
  const onRegionClickRef = useRef(onRegionClick);
  onRegionClickRef.current = onRegionClick;
  const takenRef = useRef(takenRegionIds);
  takenRef.current = takenRegionIds;
  const selectedRef = useRef(selectedRegionId);
  selectedRef.current = selectedRegionId;

  // Rebuild Graphics when features or viewport change; apply current styles immediately
  useEffect(() => {
    const container = new Container();
    viewport.addChild(container);

    for (const feature of features) {
      const gfx = new Graphics();
      gfx.eventMode = 'static';
      gfx.cursor = 'pointer';
      gfx.on('pointertap', () => onRegionClickRef.current(feature.regionId));
      container.addChild(gfx);
      gfxMapRef.current.set(feature.regionId, gfx);
      drawRegion(gfx, feature, takenRef.current.has(feature.regionId), feature.regionId === selectedRef.current);
    }

    return () => {
      container.destroy({ children: true });
      gfxMapRef.current.clear();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [features, viewport]);

  // Redraw styles when taken/selected changes (no rebuild needed)
  useEffect(() => {
    for (const feature of features) {
      const gfx = gfxMapRef.current.get(feature.regionId);
      if (!gfx) continue;
      drawRegion(gfx, feature, takenRegionIds.has(feature.regionId), feature.regionId === selectedRegionId);
    }
  }, [features, takenRegionIds, selectedRegionId]);
}
