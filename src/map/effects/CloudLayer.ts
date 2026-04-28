import { Container, Graphics, BlurFilter } from 'pixi.js';
import type { Application, Ticker } from 'pixi.js';
import type { Viewport } from 'pixi-viewport';
import { WORLD_WIDTH, WORLD_HEIGHT } from '../projection';

interface Cloud {
  gfx: Graphics;
  x: number;
  y: number;
  w: number;
  h: number;
  speed: number;
}

export class CloudLayer {
  private container: Container;
  private clouds: Cloud[] = [];
  private readonly tickFn: (ticker: Ticker) => void;

  constructor(app: Application, viewport: Viewport) {
    this.container = new Container();
    viewport.addChild(this.container);

    for (let i = 0; i < 10; i++) {
      this.addCloud(i / 10);
    }

    this.tickFn = (ticker) => {
      if (viewport.scaled > 1.5) {
        this.container.visible = false;
        return;
      }
      this.container.visible = true;
      const dt = ticker.deltaTime;
      for (const cloud of this.clouds) {
        cloud.x += cloud.speed * dt;
        if (cloud.x > WORLD_WIDTH + cloud.w) {
          cloud.x = -cloud.w;
          cloud.y = Math.random() * WORLD_HEIGHT;
        }
        cloud.gfx.x = cloud.x;
        cloud.gfx.y = cloud.y;
      }
    };
    app.ticker.add(this.tickFn);
  }

  private addCloud(progress: number): void {
    const gfx = new Graphics();
    const w = 80 + Math.random() * 160;
    const h = 30 + Math.random() * 50;

    // Build cloud from overlapping ellipses
    gfx.ellipse(0, 0, w * 0.5, h * 0.5).fill({ color: 0xffffff, alpha: 0.06 });
    gfx.ellipse(w * 0.25, -h * 0.15, w * 0.35, h * 0.4).fill({ color: 0xffffff, alpha: 0.05 });
    gfx.ellipse(-w * 0.2, -h * 0.1, w * 0.3, h * 0.35).fill({ color: 0xffffff, alpha: 0.04 });

    gfx.filters = [new BlurFilter({ strength: 12 })];

    const cloud: Cloud = {
      gfx,
      x: progress * WORLD_WIDTH,
      y: Math.random() * WORLD_HEIGHT,
      w,
      h,
      speed: 0.05 + Math.random() * 0.08,
    };
    gfx.x = cloud.x;
    gfx.y = cloud.y;

    this.container.addChild(gfx);
    this.clouds.push(cloud);
  }

  destroy(): void {
    this.container.destroy({ children: true });
  }
}
