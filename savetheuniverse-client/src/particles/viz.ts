import * as PIXI from "pixi.js";
import Canvas from "../common/canvas";
import { Core } from "./core";

export class BoundaryViz {
  canvas: Canvas;
  container: HTMLDivElement;
  constructor(public core: Core, public outerContainer: HTMLElement) {
    this.container = document.createElement("div");
    this.container.className = "absolute inset-0";
    this.outerContainer.appendChild(this.container);
    this.canvas = new Canvas(this.container, 1);
  }
  draw() {
    const sdf = this.core.boundary;
    const { height: h, width: w } = this.canvas;

    this.canvas.draw((img: Uint8ClampedArray) => {
      for (let i = 0; i < h * w; i++) {
        const l = 1 / Math.max(w, h);
        const x = ((i % w) - w / 2) * l * 2;
        const y = (Math.floor(i / w) - h / 2) * l * 2;
        const inside =
          +(sdf(x - l, y - l) > 0) +
          +(sdf(x - l, y + l) > 0) +
          +(sdf(x + l, y - l) > 0) +
          +(sdf(x + l, y + l) > 0);
        const v = [0, 255, 255, 255, 24][inside];
        // const v = (((sdf(x, y) * 200) % 128) + 128) % 128;
        img[i * 4 + 0] = v;
        img[i * 4 + 1] = v;
        img[i * 4 + 2] = v;
        img[i * 4 + 3] = 255;
      }
    });
  }
}

export class ParticleViz {
  app: PIXI.Application<PIXI.ICanvas>;
  spriteContainer: PIXI.ParticleContainer;
  sprites: PIXI.Sprite[] = [];
  container: HTMLDivElement;
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

    this.spriteContainer = new PIXI.ParticleContainer(65536, options);

    this.app.stage.addChild(this.spriteContainer);
  }
  destroy() {
    this.app.destroy();
  }
  draw() {
    const scale = Math.max(this.app.screen.width, this.app.screen.height) / 2;
    const biasX = this.app.screen.width / 2;
    const biasY = this.app.screen.height / 2;
    const { n, r, x_x, x_y, v_y, v_x } = this.core.particles;
    const spriteLength = r * 2 * scale;
    // create sprites
    for (let i = this.sprites.length; i < n; i++) {
      const sprite = PIXI.Sprite.from("/arrow_32.png");
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
      sprite.rotation = Math.atan2(v_y[i], v_x[i]);
    }
    PIXI.Ticker.shared.update(performance.now());
    this.app.renderer.render(this.app.stage);
  }
}
