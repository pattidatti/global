import { useEffect, useRef, useState } from 'react';
import type { RefObject } from 'react';
import { Application } from 'pixi.js';

export function usePixiApp(canvasRef: RefObject<HTMLCanvasElement | null>): Application | null {
  const [app, setApp] = useState<Application | null>(null);
  const appRef = useRef<Application | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const pixiApp = new Application();
    let cancelled = false;

    void pixiApp.init({
      canvas,
      background: 0x0e7490,
      resizeTo: canvas.parentElement ?? canvas,
      antialias: true,
      resolution: window.devicePixelRatio || 1,
      autoDensity: true,
    }).then(() => {
      if (cancelled) {
        pixiApp.destroy(false);
        return;
      }
      appRef.current = pixiApp;
      setApp(pixiApp);
    });

    return () => {
      cancelled = true;
      if (appRef.current) {
        appRef.current.destroy(false);
        appRef.current = null;
        setApp(null);
      } else {
        // Init er ikke ferdig ennå (StrictMode double-mount) — destruer via closure
        try { pixiApp.destroy(false); } catch { /* noop */ }
      }
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return app;
}
