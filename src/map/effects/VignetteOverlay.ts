import { Sprite, Texture } from 'pixi.js';
import type { Application } from 'pixi.js';

export class VignetteOverlay {
  private sprite: Sprite;
  private app: Application;

  constructor(app: Application) {
    this.app = app;
    this.sprite = new Sprite();
    this.sprite.eventMode = 'none';
    app.stage.addChild(this.sprite);
    this.rebuild();

    app.renderer.on('resize', this.rebuild, this);
  }

  private rebuild = (): void => {
    const w = this.app.renderer.width;
    const h = this.app.renderer.height;

    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d')!;

    const cx = w / 2;
    const cy = h / 2;
    const r = Math.sqrt(cx * cx + cy * cy);

    const grad = ctx.createRadialGradient(cx, cy, r * 0.45, cx, cy, r);
    grad.addColorStop(0, 'rgba(0,0,0,0)');
    grad.addColorStop(1, 'rgba(0,0,0,0.32)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    if (this.sprite.texture && this.sprite.texture !== Texture.EMPTY) {
      this.sprite.texture.destroy(true);
    }
    this.sprite.texture = Texture.from(canvas);
    this.sprite.x = 0;
    this.sprite.y = 0;
  };

  destroy(): void {
    this.app.renderer.off('resize', this.rebuild, this);
    this.sprite.destroy({ texture: true });
  }
}
