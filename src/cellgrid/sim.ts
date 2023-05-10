import Canvas from "../common/canvas";
import "./style.css";
import "./load";

document.querySelector<HTMLDivElement>("#app")!.innerHTML = `
  <div class="flex flex-col h-screen">
    <h1>Physics — Reference Implementation</h1>
    <code id="total-energy"></code>
    <div id="canvas-container" class="grow"></div>
  </div>
`;

const canvas = new Canvas(
  document.querySelector<HTMLDivElement>("#canvas-container")!,
  10
);

const stride = 5;
const frameDurationMs = 3000;

let regularisation = 1;

// TODO: check this works with low stride
// TODO: check conservation
// TODO: barrier field interaction
function updateRegularisation() {
  regularisation = 1;
  let sz = stride * 2 + 1;
  let state = new State(sz, sz);
  state.val_x[stride + stride * sz] = 1;
  state.val_y[stride + stride * sz] = 0;
  state.step();
  let total = 0;
  for (let i = 0; i < sz * sz; i++) {
    total += state.buf_m[i];
  }
  regularisation = 1 / total;
}

const { floor, max } = Math;
const mod = (x: number, n: number) => ((x % n) + n) % n;
// domain = [0, 1]
const distribute = (x: number) => max(0, x - x ** 2);

class State {
  val_x;
  val_y;
  itr_x;
  itr_y;
  buf_x;
  buf_y;
  buf_m;
  constructor(public height: number, public width: number) {
    this.val_x = new Float64Array(height * width);
    this.val_y = new Float64Array(height * width);
    this.itr_x = new Float64Array(height * width);
    this.itr_y = new Float64Array(height * width);
    this.buf_x = new Float64Array(height * width);
    this.buf_y = new Float64Array(height * width);
    this.buf_m = new Float64Array(height * width);
  }

  step(target = this) {
    const { height, width } = this;
    const A = this;
    const B = target;
    B.buf_x.fill(0);
    B.buf_y.fill(0);
    B.buf_m.fill(0);
    for (let xi = 0; xi < width; xi++) {
      for (let yi = 0; yi < height; yi++) {
        for (let xj = xi - stride; xj <= xi + stride; xj++) {
          for (let yj = yi - stride; yj <= yi + stride; yj++) {
            const i = xi + yi * width;
            const j = mod(xj, width) + mod(yj, height) * width;
            const xd = xi - xj;
            const yd = yi - yj;
            const norm = 1 / (xd ** 2 + yd ** 2) ** 0.5;
            const ival = 1 / (A.val_x[j] ** 2 + A.val_y[j] ** 2) ** 0.5;

            const cos =
              (xd * norm * A.val_x[j] + yd * norm * A.val_y[j]) * ival;
            const cosweight = -0.25 * cos ** 2 + 0.5 * cos + 0.75;
            const mag =
              (distribute(1 / (norm * stride)) / ival) *
              cosweight *
              regularisation;

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
}

let angle = Math.random() * 2 * Math.PI;
updateRegularisation();
const { height: h, width: w } = canvas;
const state = new State(h, w);
state.val_x[floor(w / 2) + floor(h / 2) * w] = Math.cos(angle);
state.val_y[floor(w / 2) + floor(h / 2) * w] = Math.sin(angle);
for (let i = 0; i < h * w; i++) {
  let xd = (i % w) - w / 2;
  let yd = floor(i / w) - h / 2;
  state.itr_x[i] = -xd / 35;
  state.itr_y[i] = -yd / 35;
}

function loop(): void {
  state.step();
  canvas.draw((img: Uint8ClampedArray) => {
    let min = state.buf_m[0];
    let max = state.buf_m[0];
    for (let i = 1; i < state.buf_m.length; i++) {
      min = min < state.buf_m[i] ? min : state.buf_m[i];
      max = max > state.buf_m[i] ? max : state.buf_m[i];
    }
    document.querySelector<HTMLParagraphElement>("#total-energy")!.innerText =
      min.toFixed(6) + " - " + max.toFixed(6) + " = " + (max - min).toFixed(6);
    for (let i = 0; i < h * w; i++) {
      let v = (state.buf_m[i] - min) / (max - min);
      // let d = (state.itr_x[i] ** 2 + state.itr_y[i] ** 2) ** 0.5 / 20;
      img[i * 4 + 0] = 256 - v * 256;
      img[i * 4 + 1] = 256 - v * 256;
      img[i * 4 + 2] = 256 - v * 256;
      img[i * 4 + 3] = 256;
    }
  });
  if (frameDurationMs > 16) setTimeout(loop, frameDurationMs);
  else requestAnimationFrame(loop);
}

loop();
