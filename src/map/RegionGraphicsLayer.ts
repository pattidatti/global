import { Container, Graphics, BlurFilter } from 'pixi.js';
import type { Viewport } from 'pixi-viewport';
import type { ProjectedFeature } from './geoProjector';

export interface RegionStyle {
  fillColor: number;
  fillAlpha: number;
  borderColor: number;
  borderWidth: number;
  isSelected: boolean;
  isNeighbor: boolean;
  isContested: boolean;
}

export class RegionGraphicsLayer {
  readonly container: Container;
  private gfxMap = new Map<string, Graphics>();
  private glowMap = new Map<string, Graphics>();
  private featuresMap = new Map<string, ProjectedFeature>();

  constructor(
    viewport: Viewport,
    private onClick: (id: string) => void,
    private onHover: (id: string | null) => void,
  ) {
    this.container = new Container();
    viewport.addChild(this.container);
  }

  buildAll(features: ProjectedFeature[]): void {
    for (const feature of features) {
      this.featuresMap.set(feature.regionId, feature);
      const gfx = new Graphics();
      gfx.eventMode = 'static';
      gfx.cursor = 'pointer';
      gfx.on('pointertap', () => this.onClick(feature.regionId));
      gfx.on('pointerover', () => this.onHover(feature.regionId));
      gfx.on('pointerout', () => this.onHover(null));
      this.container.addChild(gfx);
      this.gfxMap.set(feature.regionId, gfx);
    }
  }

  updateRegion(regionId: string, style: RegionStyle): void {
    const gfx = this.gfxMap.get(regionId);
    const feature = this.featuresMap.get(regionId);
    if (!gfx || !feature) return;

    this.drawRegion(gfx, feature, style);

    const existingGlow = this.glowMap.get(regionId);
    if (style.isContested) {
      if (!existingGlow) {
        const glowGfx = new Graphics();
        glowGfx.filters = [new BlurFilter({ strength: 8 })];
        this.container.addChildAt(glowGfx, 0);
        this.glowMap.set(regionId, glowGfx);
      }
      const glowGfx = this.glowMap.get(regionId)!;
      glowGfx.clear();
      for (const ring of feature.rings) {
        glowGfx.poly(ring).fill({ color: 0x9a2a2a, alpha: 0.6 });
      }
    } else if (existingGlow) {
      existingGlow.destroy();
      this.glowMap.delete(regionId);
    }
  }

  private drawRegion(gfx: Graphics, feature: ProjectedFeature, style: RegionStyle): void {
    gfx.clear();

    for (const ring of feature.rings) {
      // Outer soft stroke for painted/organic border feel
      gfx.poly(ring).stroke({
        color: style.borderColor,
        width: style.borderWidth + 2,
        alpha: 0.13,
        join: 'round',
        cap: 'round',
      });
      // Fill + main stroke
      gfx.poly(ring)
        .fill({ color: style.fillColor, alpha: style.fillAlpha })
        .stroke({
          color: style.borderColor,
          width: style.borderWidth,
          alpha: 1,
          join: 'round',
          cap: 'round',
        });
    }

    if (style.isSelected) {
      for (const ring of feature.rings) {
        gfx.poly(ring).stroke({ color: 0xffffff, width: 5, alpha: 0.22 });
      }
    }
  }

  getFeatureName(regionId: string): string | undefined {
    return this.featuresMap.get(regionId)?.name;
  }

  destroy(): void {
    this.container.destroy({ children: true });
  }
}
