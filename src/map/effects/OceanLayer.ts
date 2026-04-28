import { Graphics } from 'pixi.js';
import type { Application, Ticker } from 'pixi.js';
import type { Viewport } from 'pixi-viewport';
import { WORLD_WIDTH, WORLD_HEIGHT } from '../projection';

export class OceanLayer {
  private gfx: Graphics;
  private phase = 0;
  private readonly tickFn: (ticker: Ticker) => void;

  constructor(app: Application, viewport: Viewport) {
    this.gfx = new Graphics();
    viewport.addChildAt(this.gfx, 0); // below everything else

    this.tickFn = (ticker) => {
      this.phase += ticker.deltaTime * 0.006;
      this.draw();
    };
    app.ticker.add(this.tickFn);
    this.draw();
  }

  private draw(): void {
    const { gfx, phase } = this;
    gfx.clear();

    for (let n = 0; n < 6; n++) {
      const baseY = (WORLD_HEIGHT / 7) * (n + 1);
      gfx.moveTo(0, baseY);
      for (let x = 0; x <= WORLD_WIDTH; x += 32) {
        const y = baseY + Math.sin(x * 0.008 + phase + n * 1.1) * 14;
        gfx.lineTo(x, y);
      }
      gfx.stroke({ color: 0xffffff, width: 1.5, alpha: 0.04 });
    }
  }

  destroy(): void {
    this.gfx.destroy();
  }
}
