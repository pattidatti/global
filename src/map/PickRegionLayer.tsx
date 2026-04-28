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

export function usePickRegionLayer({
  features,
  takenRegionIds,
  selectedRegionId,
  onRegionClick,
  viewport,
}: PickRegionLayerProps): void {
  const containerRef = useRef<Container | null>(null);
  const gfxMapRef = useRef<Map<string, Graphics>>(new Map());

  // Build layer once
  useEffect(() => {
    const container = new Container();
    viewport.addChild(container);
    containerRef.current = container;

    for (const feature of features) {
      const gfx = new Graphics();
      gfx.eventMode = 'static';
      gfx.cursor = 'pointer';
      gfx.on('pointertap', () => onRegionClick(feature.regionId));
      container.addChild(gfx);
      gfxMapRef.current.set(feature.regionId, gfx);
    }

    return () => {
      container.destroy({ children: true });
      containerRef.current = null;
      gfxMapRef.current.clear();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [features, viewport, onRegionClick]);

  // Update styles when taken/selected changes
  useEffect(() => {
    for (const feature of features) {
      const gfx = gfxMapRef.current.get(feature.regionId);
      if (!gfx) continue;

      const taken = takenRegionIds.has(feature.regionId);
      const selected = feature.regionId === selectedRegionId;

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
  }, [features, takenRegionIds, selectedRegionId]);
}
