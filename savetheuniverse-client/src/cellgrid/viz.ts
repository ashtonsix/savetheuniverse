import * as PIXI from "pixi.js";
import { Core } from "./core";

const { floor, min, atan2 } = Math;

// 4*6
// 40*70
// const cellSz = min(40/4, 70/6)
// containerWidth = 4 * cellSz
// containerHeight = 6 * cellSz

export class Viz {
  app: PIXI.Application<PIXI.ICanvas>;
  spriteContainer: PIXI.ParticleContainer;
  sprites: PIXI.Sprite[] = [];
  container: HTMLDivElement;
  resizeObserver: ResizeObserver;
  constructor(public core: Core, public outerContainer: HTMLElement) {
    outerContainer.style.backgroundColor = "#000";
    this.container = document.createElement("div");
    outerContainer.appendChild(this.container);
    this.container.className = "mx-auto";
    this.outerContainer.appendChild(this.container);
    this.resizeContainer();
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
    this.resizeObserver = new ResizeObserver(() => {
      this.resizeContainer();
      this.draw();
    });
    this.resizeObserver.observe(this.outerContainer);
  }
  destroy() {
    this.resizeObserver.disconnect();
    this.app.destroy();
  }
  resizeContainer() {
    const { container, outerContainer, core } = this;
    const och = outerContainer.clientHeight;
    const ocw = outerContainer.clientHeight;
    const cellSz = min(och / core.height, ocw / core.width);
    container.style.width = `${core.width * cellSz}px`;
    container.style.height = `${core.height * cellSz}px`;
  }
  draw() {
    const { height, width, itr_x, val_x, itr_y, val_y } = this.core;
    const scale =
      min(this.app.screen.width, this.app.screen.height) / min(height, width);
    const bias = scale / 2;
    const n = height * width;

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
      sprite.x = (i % width) * scale + bias;
      sprite.y = floor(i / width) * scale + bias;
      const magSquared = val_x[i] ** 2 + val_y[i] ** 2;
      // r^2=a/pi
      const spriteLength = magSquared ** 0.25 * scale;
      sprite.width = spriteLength;
      sprite.height = spriteLength;
      sprite.alpha = spriteLength > 1 ? 1 : 0;
      sprite.rotation = atan2(val_y[i], val_x[i]);
    }
    PIXI.Ticker.shared.update(performance.now());
    this.app.renderer.render(this.app.stage);
  }
}
