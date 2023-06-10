import { Ticker } from "../common/ticker";
import { Viz } from "./viz";

const { min, max } = Math;
const mod = (x: number, n: number) => ((x % n) + n) % n;

export class Core {
  val_x: Float64Array;
  val_y: Float64Array;
  itr_x: Float64Array;
  itr_y: Float64Array;
  buf_x: Float64Array;
  buf_y: Float64Array;
  buf_m: Float64Array;
  ticker: Ticker;
  viz?: Viz;
  neighbourhoodRadius = 8;
  scalingFactor = 1;
  distance = (x: number) => {
    return max(0, x - x ** 2);
  };
  dispersion = (x: number) => {
    const d = -0.25;
    return -d * x ** 2 + 0.5 * x + d + 0.5;
  };
  constructor(
    public height: number,
    public width: number,
    public container?: HTMLElement
  ) {
    this.val_x = new Float64Array(height * width);
    this.val_y = new Float64Array(height * width);
    this.itr_x = new Float64Array(height * width);
    this.itr_y = new Float64Array(height * width);
    this.buf_x = new Float64Array(height * width);
    this.buf_y = new Float64Array(height * width);
    this.buf_m = new Float64Array(height * width);
    this.ticker = new Ticker(this.frame.bind(this), 1);
    if (container) this.viz = new Viz(this, container);
  }
  destroy() {
    this.ticker.destroy();
    if (this.viz) this.viz.destroy();
    if (this.container) this.container.innerHTML = "";
  }
  updateScalingFactor() {
    let sz = this.neighbourhoodRadius * 2 + 1;
    let state = new Core(sz, sz);
    state.neighbourhoodRadius = this.neighbourhoodRadius;
    state.distance = this.distance;
    state.dispersion = this.dispersion;
    state.val_x[this.neighbourhoodRadius + this.neighbourhoodRadius * sz] = 1;
    state.val_y[this.neighbourhoodRadius + this.neighbourhoodRadius * sz] = 0;
    state.step();
    let total = 0;
    for (let i = 0; i < sz * sz; i++) {
      total += state.buf_m[i];
    }
    this.scalingFactor = 1 / total;
  }
  step(target = this) {
    const { neighbourhoodRadius: r, height, width } = this;
    const A = this;
    const B = target;
    B.buf_x.fill(0);
    B.buf_y.fill(0);
    B.buf_m.fill(0);
    for (let xi = 0; xi < width; xi++) {
      for (let yi = 0; yi < height; yi++) {
        for (let xj = xi - r; xj <= xi + r; xj++) {
          for (let yj = yi - r; yj <= yi + r; yj++) {
            const i = xi + yi * width;
            const j = mod(xj, width) + mod(yj, height) * width;
            const xd = xi - xj;
            const yd = yi - yj;
            const norm = 1 / (xd ** 2 + yd ** 2) ** 0.5;
            const ival = 1 / (A.val_x[j] ** 2 + A.val_y[j] ** 2) ** 0.5;

            const cos =
              (xd * norm * A.val_x[j] + yd * norm * A.val_y[j]) * ival;
            const cosweight = this.dispersion(cos);
            const mag =
              (this.distance(1 / (norm * (this.neighbourhoodRadius + 1))) /
                ival) *
              cosweight *
              this.scalingFactor;

            B.buf_x[i] += mag * xd * norm || 0;
            B.buf_y[i] += mag * yd * norm || 0;
            B.buf_m[i] += mag || 0;
          }
        }
      }
    }
    for (let i = 0; i < height * width; i++) {
      let x = B.buf_x[i];
      let y = B.buf_y[i];
      let norm = 1 / (x ** 2 + y ** 2) ** 0.5;

      x = x * norm + A.itr_x[i];
      y = y * norm + A.itr_y[i];
      norm = 1 / (x ** 2 + y ** 2) ** 0.5;

      B.val_x[i] = x * norm * B.buf_m[i] || 0;
      B.val_y[i] = y * norm * B.buf_m[i] || 0;
    }
  }
  frame() {
    this.updateScalingFactor();
    this.step();
    this.viz?.draw();
  }
}

// function loop(): void {
//   state.step();
//   canvas.draw((img: Uint8ClampedArray) => {
//     let min = state.buf_m[0];
//     let max = state.buf_m[0];
//     for (let i = 1; i < state.buf_m.length; i++) {
//       min = min < state.buf_m[i] ? min : state.buf_m[i];
//       max = max > state.buf_m[i] ? max : state.buf_m[i];
//     }
//     document.querySelector<HTMLParagraphElement>("#total-energy")!.innerText =
//       min.toFixed(6) + " - " + max.toFixed(6) + " = " + (max - min).toFixed(6);
//     for (let i = 0; i < h * w; i++) {
//       let v = (state.buf_m[i] - min) / (max - min);
//       // let d = (state.itr_x[i] ** 2 + state.itr_y[i] ** 2) ** 0.5 / 20;
//       img[i * 4 + 0] = 256 - v * 256;
//       img[i * 4 + 1] = 256 - v * 256;
//       img[i * 4 + 2] = 256 - v * 256;
//       img[i * 4 + 3] = 256;
//     }
//   });
//   if (frameDurationMs > 16) setTimeout(loop, frameDurationMs);
//   else requestAnimationFrame(loop);
// }

// loop();
