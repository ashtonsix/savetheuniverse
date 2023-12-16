import * as PIXI from "pixi.js";
import { Core } from "./core";

const { floor, abs, min, max, atan2 } = Math;

export class Viz {
  app: PIXI.Application<PIXI.ICanvas>;
  spriteContainerVal: PIXI.ParticleContainer;
  spriteContainerItr: PIXI.ParticleContainer;
  spritesVal: PIXI.Sprite[] = [];
  spritesItr: PIXI.Sprite[] = [];
  container: HTMLDivElement;
  resizeObserver: ResizeObserver;
  bounds = { top: 0, bottom: 0, left: 0, right: 0 };
  motionAmplification = false;
  constructor(public core: Core, public outerContainer: HTMLElement) {
    outerContainer.style.backgroundColor = "#000";
    this.container = document.createElement("div");
    outerContainer.appendChild(this.container);
    this.container.className = "mx-auto";
    this.outerContainer.appendChild(this.container);
    this.resize();
    this.app = new PIXI.Application({
      backgroundAlpha: 0,
      resizeTo: this.container,
      preserveDrawingBuffer: true,
      sharedTicker: true,
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

    this.spriteContainerVal = new PIXI.ParticleContainer(65536, options);
    this.spriteContainerItr = new PIXI.ParticleContainer(65536, options);

    this.app.stage.addChild(this.spriteContainerVal);
    this.app.stage.addChild(this.spriteContainerItr);
    this.resizeObserver = new ResizeObserver(() => {
      this.resize();
      this.draw();
    });
    this.resizeObserver.observe(this.outerContainer);
    const initDrawLoop = setInterval(() => this.draw(), 32);
    setTimeout(() => clearInterval(initDrawLoop), 500);
  }
  destroy() {
    this.resizeObserver.disconnect();
    this.app.destroy();
  }
  resize() {
    const { container, outerContainer, core, app } = this;
    const och = outerContainer.clientHeight;
    const ocw = outerContainer.clientWidth;
    const innerHeight = core.height - this.bounds.top - this.bounds.bottom;
    const innerWidth = core.width - this.bounds.left - this.bounds.right;
    const cellSz = min(och / innerHeight, ocw / innerWidth);
    container.style.width = `${innerWidth * cellSz}px`;
    container.style.height = `${innerHeight * cellSz}px`;
    if (app) app.resize();
  }
  draw() {
    if (!this.app.renderer) return;
    const { itr_x, val_x, itr_y, val_y, prev_x, prev_y, width, height } =
      this.core;
    const scale =
      min(this.app.screen.width, this.app.screen.height) /
      min(
        width - this.bounds.left - this.bounds.right,
        height - this.bounds.top - this.bounds.bottom
      );
    const bias = scale / 2;
    const n = height * width;

    // create sprites
    for (let i = this.spritesVal.length; i < n; i++) {
      const spriteVal = PIXI.Sprite.from("/arrow.png");
      const spriteItr = PIXI.Sprite.from("/arrow_grey.png");
      spriteVal.anchor.set(0.5);
      spriteItr.anchor.set(0.5);
      this.spritesVal.push(spriteVal);
      this.spritesItr.push(spriteItr);
      this.spriteContainerVal.addChild(spriteVal);
      this.spriteContainerItr.addChild(spriteItr);
    }
    // destroy sprites
    for (let i = this.spritesVal.length - 1; i > n; i--) {
      const spriteVal = this.spritesVal.pop()!;
      const spriteItr = this.spritesItr.pop()!;
      spriteVal.destroy();
      spriteItr.destroy();
    }
    // get bounds for contrast
    let minVal = Infinity;
    let maxVal = -Infinity;
    for (let i = 0; i < n; i++) {
      if (itr_x[i] !== 0 || itr_y[i] !== 0) continue;
      let magSquared = val_x[i] ** 2 + val_y[i] ** 2;
      if (this.motionAmplification) {
        magSquared = abs(prev_x[i] ** 2 + prev_y[i] ** 2 - magSquared);
      }
      minVal = min(minVal, magSquared);
      maxVal = max(maxVal, magSquared);
    }
    // update sprites
    for (let i = 0; i < n; i++) {
      const spriteVal = this.spritesVal[i];
      const spriteItr = this.spritesItr[i];
      spriteVal.x = ((i % width) - this.bounds.left) * scale + bias;
      spriteVal.y = (floor(i / width) - this.bounds.top) * scale + bias;
      spriteItr.x = ((i % width) - this.bounds.left) * scale + bias;
      spriteItr.y = (floor(i / width) - this.bounds.top) * scale + bias;
      if (itr_x[i] === 0 && itr_y[i] === 0) {
        let magSquared = val_x[i] ** 2 + val_y[i] ** 2;
        if (this.motionAmplification) {
          magSquared = abs(prev_x[i] ** 2 + prev_y[i] ** 2 - magSquared);
        }
        const magCorrected = (magSquared - minVal) / (maxVal - minVal);
        const spriteLength = magCorrected ** 0.25 * scale;
        spriteVal.width = spriteLength;
        spriteVal.height = spriteLength;
        spriteVal.alpha = spriteLength > 1 ? 1 : 0;
        spriteVal.rotation = atan2(val_y[i], val_x[i]);
        spriteItr.alpha = 0;
      } else {
        const magSquared = itr_x[i] ** 2 + itr_y[i] ** 2;
        const spriteLength = Math.min(magSquared ** 0.25, 1) * scale;
        spriteItr.width = spriteLength;
        spriteItr.height = spriteLength;
        spriteItr.alpha = spriteLength > 1 ? 1 : 0;
        spriteItr.rotation = atan2(itr_y[i], itr_x[i]);
        spriteVal.alpha = 0;
      }
    }
    PIXI.Ticker.shared.update(performance.now());
    this.app.renderer.render(this.app.stage);
  }
}
