import { useEffect, useState } from 'react';
import type { Application } from 'pixi.js';
import { Viewport } from 'pixi-viewport';
import { WORLD_WIDTH, WORLD_HEIGHT, project } from './projection';

export function usePixiViewport(app: Application | null): Viewport | null {
  const [viewport, setViewport] = useState<Viewport | null>(null);

  useEffect(() => {
    if (!app) return;

    const vp = new Viewport({
      worldWidth: WORLD_WIDTH,
      worldHeight: WORLD_HEIGHT,
      events: app.renderer.events,
    });

    app.stage.addChild(vp);
    vp.drag().pinch().wheel().decelerate();
    vp.clampZoom({ minScale: 0.18, maxScale: 12 });

    const center = project(0, 20);
    const w = app.renderer.width;
    const h = app.renderer.height;
    const initScale = (w > 0 && h > 0)
      ? Math.min(w / WORLD_WIDTH, h / WORLD_HEIGHT) * 1.1
      : 1.0;
    vp.setZoom(initScale, true);
    vp.moveCenter(center.x, center.y);

    if (import.meta.env.DEV) {
      (window as Window & { __pixiViewport?: Viewport }).__pixiViewport = vp;
    }

    setViewport(vp);

    return () => {
      if (import.meta.env.DEV) {
        delete (window as Window & { __pixiViewport?: Viewport }).__pixiViewport;
      }
      app.stage.removeChild(vp);
      vp.destroy();
      setViewport(null);
    };
  }, [app]);

  return viewport;
}
