import * as PIXI from "pixi.js";
import Canvas from "../common/canvas";
import { Core } from "./core";

const { floor, abs, min, max, atan2 } = Math;

export class BoundaryViz {
  canvas: Canvas;
  container: HTMLDivElement;
  resizeObserver: ResizeObserver;
  constructor(public core: Core, public outerContainer: HTMLElement) {
    this.container = document.createElement("div");
    this.container.className = "absolute inset-0";
    this.outerContainer.appendChild(this.container);
    this.canvas = new Canvas(this.container, 1);
    this.resizeObserver = new ResizeObserver(() => {
      this.canvas.resize();
      this.draw();
    });
    this.resizeObserver.observe(this.container);
  }
  destroy() {
    this.resizeObserver.disconnect();
  }
  draw() {
    const sdf = this.core.boundary;
    const { height: h, width: w } = this.canvas;
    const l = max(w, h);
    const linv = 1 / l;

    this.canvas.draw((img: Uint8ClampedArray) => {
      for (let yi = 0; yi < h; yi++) {
        for (let xi = 0; xi < w; xi++) {
          const x = (xi - w / 2) * linv * 2;
          const y = (yi - h / 2) * linv * 2;
          const inside =
            +(sdf(x - linv, y - linv) > 0) +
            +(sdf(x - linv, y + linv) > 0) +
            +(sdf(x + linv, y - linv) > 0) +
            +(sdf(x + linv, y + linv) > 0);
          const v = [0, 255, 255, 255, 24][inside];
          // const v = (((sdf(x, y) * 200) % 128) + 128) % 128;
          if (inside === 0 || inside === 4) {
            // optimise marching squares with inspiration from ray marching
            // no need to resample the sdf for every pixel
            const d = floor(abs(sdf(x, y) * l * 0.5) - 1);
            const n = xi + min(w - xi, d);
            for (; xi < n; xi++) {
              const i = yi * w + xi;
              img[i * 4 + 0] = v;
              img[i * 4 + 1] = v;
              img[i * 4 + 2] = v;
              img[i * 4 + 3] = 255;
            }
          }
          const i = yi * w + xi;
          img[i * 4 + 0] = v;
          img[i * 4 + 1] = v;
          img[i * 4 + 2] = v;
          img[i * 4 + 3] = 255;
        }
      }
      for (let i = 0; i < h * w; i++) {}
    });
  }
}

export class ParticleViz {
  app: PIXI.Application<PIXI.ICanvas>;
  spriteContainer: PIXI.ParticleContainer;
  sprites: PIXI.Sprite[] = [];
  container: HTMLDivElement;
  resizeObserver: ResizeObserver;
  constructor(public core: Core, public outerContainer: HTMLElement) {
    this.container = document.createElement("div");
    this.container.className = "absolute inset-0";
    this.outerContainer.appendChild(this.container);
    this.app = new PIXI.Application({
      backgroundAlpha: 0,
      resizeTo: this.container,
      preserveDrawingBuffer: true,
    });
    this.container.appendChild(this.app.view as HTMLCanvasElement);
    const options = {
      scale: true,
      position: true,
      rotation: true,
      uvs: true,
      alpha: true,
    };
    PIXI.Ticker.shared.autoStart = false;
    PIXI.Ticker.shared.stop();

    this.spriteContainer = new PIXI.ParticleContainer(262144, options);

    this.app.stage.addChild(this.spriteContainer);
    this.resizeObserver = new ResizeObserver(() => this.draw());
    this.resizeObserver.observe(this.container);
  }
  destroy() {
    this.resizeObserver.disconnect();
    this.app.destroy();
  }
  draw() {
    const scale = max(this.app.screen.width, this.app.screen.height) / 2;
    const biasX = this.app.screen.width / 2;
    const biasY = this.app.screen.height / 2;
    const { n, r, x_x, x_y, v_y, v_x } = this.core.particles;
    const spriteLength = r * 2 * scale;
    // create sprites
    for (let i = this.sprites.length; i < n; i++) {
      const sprite = PIXI.Sprite.from("/arrow.png");
      sprite.anchor.set(0.5);
      this.sprites.push(sprite);
      this.spriteContainer.addChild(sprite);
    }
    // destroy sprites
    for (let i = this.sprites.length - 1; i > n; i--) {
      const sprite = this.sprites.pop()!;
      sprite.destroy();
    }
    // update sprites
    for (let i = 0; i < n; i++) {
      const sprite = this.sprites[i];
      sprite.x = x_x[i] * scale + biasX;
      sprite.y = x_y[i] * scale + biasY;
      sprite.width = spriteLength;
      sprite.height = spriteLength;
      sprite.rotation = atan2(v_y[i], v_x[i]);
    }
    PIXI.Ticker.shared.update(performance.now());
    this.app.renderer.render(this.app.stage);
  }
}
