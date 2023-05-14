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

class State {
  x_x;
  x_y;
  v_x;
  v_y;
  constructor(public height: number, public width: number) {
    this.x_x = new Float64Array(height * width);
    this.x_y = new Float64Array(height * width);
    this.v_x = new Float64Array(height * width);
    this.v_y = new Float64Array(height * width);
  }

  step() {}
}

const { height: h, width: w } = canvas;
const state = new State(h, w);

for (let i = 0; i < h * w; i++) {
  state.x_x[i] = 0;
  state.x_y[i] = 0;
}

function loop(): void {
  state.step();
  canvas.draw((img: Uint8ClampedArray) => {
    for (let i = 0; i < h * w; i++) {
      let v = (state.buf_m[i] - min) / (max - min);
      // let d = (state.con_x[i] ** 2 + state.con_y[i] ** 2) ** 0.5 / 20;
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
