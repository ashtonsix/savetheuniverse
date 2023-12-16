import * as PIXI from "pixi.js";
import { fitInside } from "../common/grid-utils";

const { ceil, floor, min, max, sqrt, log2, atan2 } = Math;

/**
 * \mathbf{J} = \frac{(1 + E)(\mathbf{x}_1 - \mathbf{x}_2)}{2} \frac{\langle \mathbf{v}_1 - \mathbf{v}_2, \mathbf{x}_1 - \mathbf{x}_2\rangle}{\langle \mathbf{x}_1 - \mathbf{x}_2, \mathbf{x}_1 - \mathbf{x}_2\rangle}, \\
 * S = \frac{\|\mathbf{v}_1\| + \|\mathbf{v}_2\|}{\|\mathbf{v}_1 - \mathbf{J}\| + \|\mathbf{v}_2 + \mathbf{J}\|}, \\
 * \mathbf{v}'_1 = S(\mathbf{v}_1 - \mathbf{J}), \\
 * \mathbf{v}'_2 = S(\mathbf{v}_2 + \mathbf{J})
 */
export function collideParticles(
  particles: ParticleCollection,
  i: number,
  j: number
) {
  // Get particle radius and positions
  const r = particles.r;
  const x_1x = particles.x_x[i];
  const x_1y = particles.x_y[i];
  const x_2x = particles.x_x[j];
  const x_2y = particles.x_y[j];

  // Check if particles are colliding
  const dx_x = x_1x - x_2x;
  const dx_y = x_1y - x_2y;
  const dxDotDx = dx_x * dx_x + dx_y * dx_y;
  if (dxDotDx > (r * 2) ** 2) {
    return false;
  }

  // Increment collision count
  particles.C++;

  // Calculate displacement required to remove particle overlap
  const dx_m = sqrt(dxDotDx);
  const overlap = r * 2 - dx_m;
  const D_s = (overlap / dx_m) * (0.5 + 1e-5);
  const D_x = D_s * dx_x;
  const D_y = D_s * dx_y;

  // Store updated displacement in temporary buffer
  // It is not applied until all particle-particle collisions have been detected, to improve simulation accuracy
  particles.D_x[i] += D_x;
  particles.D_y[i] += D_y;
  particles.D_x[j] -= D_x;
  particles.D_y[j] -= D_y;

  // Get elasticity coefficient and particle velocities
  // Using overlap to boost elasticity improves numerical stability
  const E = particles.E + min((8 * overlap) / r, max(1 - particles.E, 0));
  const v_1x = particles.v_x[i];
  const v_1y = particles.v_y[i];
  const v_2x = particles.v_x[j];
  const v_2y = particles.v_y[j];

  // Calculate the difference in velocities
  const dv_x = v_1x - v_2x;
  const dv_y = v_1y - v_2y;

  // Calculate impulse vector
  const dvDotDx = dv_x * dx_x + dv_y * dx_y;
  const J_s = ((1 + E) * dvDotDx) / (dxDotDx * 2);
  const J_x = J_s * dx_x;
  const J_y = J_s * dx_y;

  // Calculate updated velocities
  let u_1x = v_1x - J_x;
  let u_1y = v_1y - J_y;
  let u_2x = v_2x + J_x;
  let u_2y = v_2y + J_y;

  // Calculate the magnitude of the velocities
  const v1_mag = sqrt(v_1x * v_1x + v_1y * v_1y);
  const v2_mag = sqrt(v_2x * v_2x + v_2y * v_2y);
  const u1_mag = sqrt(u_1x * u_1x + u_1y * u_1y);
  const u2_mag = sqrt(u_2x * u_2x + u_2y * u_2y);

  // Calculate scaling factor
  const S = (v1_mag + v2_mag) / (u1_mag + u2_mag);

  // Finalise and store updated velocities
  particles.v_x[i] = u_1x * S;
  particles.v_y[i] = u_1y * S;
  particles.v_x[j] = u_2x * S;
  particles.v_y[j] = u_2y * S;

  return true;
}

export class ParticleCollection {
  #n = 0; // count
  r = 1; // radius
  E = 1; // elasticity
  C = 0; // collision count
  x_x = new Float64Array(); // position
  x_y = new Float64Array();
  v_x = new Float64Array(); // velocity
  v_y = new Float64Array();
  D_x = new Float64Array(); // displacement
  D_y = new Float64Array();
  get n() {
    return this.#n;
  }
  set n(n: number) {
    this.#n = floor(n);
    const bufferAllocation = 2 ** ceil(log2(n ?? 0));
    if (bufferAllocation > this.x_x.length) {
      const { x_x, x_y, v_x, v_y } = this;
      this.x_x = new Float64Array(bufferAllocation);
      this.x_y = new Float64Array(bufferAllocation);
      this.v_x = new Float64Array(bufferAllocation);
      this.v_y = new Float64Array(bufferAllocation);
      this.D_x = new Float64Array(bufferAllocation);
      this.D_y = new Float64Array(bufferAllocation);
      this.x_x.set(x_x);
      this.x_y.set(x_y);
      this.v_x.set(v_x);
      this.v_y.set(v_y);
    }
  }
  copy(particles: ParticleCollection) {
    this.n = particles.x_x.length;
    this.n = particles.n;
    this.r = particles.r;
    this.E = particles.E;
    this.C = particles.C;
    this.x_x.set(particles.x_x);
    this.x_y.set(particles.x_y);
    this.v_x.set(particles.v_x);
    this.v_y.set(particles.v_y);
    this.D_x.set(particles.D_x);
    this.D_y.set(particles.D_y);
  }
}

// Using the cell grid technique often used in molecular dynamics
export class ParticleDetector {
  grid = new Int32Array();
  occupancy = new Int8Array();
  gridLength = 1;
  indexWeight = 1;
  indexBias = 0;
  detectWeight = 1;
  detectBias = 0;
  constructor(public particles: ParticleCollection) {
    this.resize();
  }
  index() {
    const { n, x_x, x_y } = this.particles;
    let { grid, occupancy, gridLength, indexWeight, indexBias } = this;
    grid.fill(-1);
    occupancy.fill(0);

    for (let i = 0; i < n; i++) {
      let x = floor(x_x[i] * indexWeight + indexBias);
      let y = floor(x_y[i] * indexWeight + indexBias);
      let j = y * gridLength + x;
      grid[j * 4 + min(occupancy[j]++, 3)] = i;
    }
  }
  detect(callback: (i: number, j: number) => void) {
    const { n, x_x, x_y } = this.particles;
    let { grid, gridLength, detectWeight, detectBias } = this;
    for (let i = 0; i < n; i++) {
      let x = floor(x_x[i] * detectWeight + detectBias);
      let y = floor(x_y[i] * detectWeight + detectBias);
      /**
       * these lines of code use more runtime than any other in the particle toy
       * the partial loop unrolling leads to faster execution (Duff's tool)
       *
       * less-than predicate prevents:
       *
       * - duplicate collision handling for particle pairs
       * - particle self-collision (g[cell] == g[cell])
       * - handling of empty cells (g[cell] == -1)
       */
      let start = (y * gridLength + x) * 4;
      let inc = gridLength * 4;
      let end = start + inc * 3;
      for (let cell = start; cell < end; cell += inc) {
        if (i < grid[cell]) callback(i, grid[cell]);
        if (i < grid[cell + 1]) callback(i, grid[cell + 1]);
        if (i < grid[cell + 2]) callback(i, grid[cell + 2]);
        if (i < grid[cell + 3]) callback(i, grid[cell + 3]);
        if (i < grid[cell + 4]) callback(i, grid[cell + 4]);
        if (i < grid[cell + 5]) callback(i, grid[cell + 5]);
        if (i < grid[cell + 6]) callback(i, grid[cell + 6]);
        if (i < grid[cell + 7]) callback(i, grid[cell + 7]);
        if (i < grid[cell + 8]) callback(i, grid[cell + 8]);
        if (i < grid[cell + 9]) callback(i, grid[cell + 9]);
        if (i < grid[cell + 10]) callback(i, grid[cell + 10]);
        if (i < grid[cell + 11]) callback(i, grid[cell + 11]);
      }
    }
  }
  resize() {
    let cellSize = this.particles.r * 2 * (1 + 1e-5);
    this.gridLength = ceil(2 / cellSize) + 2;
    this.indexWeight = 1 / cellSize;
    this.indexBias = 1 / cellSize + 1;
    this.detectWeight = 1 / cellSize;
    this.detectBias = 1 / cellSize;
    let allocation = 2 ** ceil(log2(this.gridLength ** 2));
    if (allocation > this.occupancy.length) {
      this.grid = new Int32Array(allocation * 4);
      this.occupancy = new Int8Array(allocation);
    }
  }
}

export class ParticleViz {
  app: PIXI.Application<PIXI.ICanvas>;
  spriteContainer: PIXI.ParticleContainer;
  sprites: PIXI.Sprite[] = [];
  container: HTMLDivElement;
  resizeObserver: ResizeObserver;
  bounds = { top: -1, left: -1, width: 2, height: 2 };
  constructor(
    public particles: ParticleCollection,
    public outerContainer: HTMLElement
  ) {
    this.container = document.createElement("div");
    this.container.className = "absolute inset-0";
    this.outerContainer.appendChild(this.container);
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

    this.spriteContainer = new PIXI.ParticleContainer(262144, options);

    this.app.stage.addChild(this.spriteContainer);
    this.resizeObserver = new ResizeObserver(() => this.draw());
    this.resizeObserver.observe(this.container);
    const initDrawLoop = setInterval(() => this.draw(), 32);
    setTimeout(() => clearInterval(initDrawLoop), 500);
  }
  destroy() {
    this.resizeObserver.disconnect();
    this.app.destroy();
  }
  draw() {
    if (!this.app.renderer) return;
    const [scale, biasX, biasY] = fitInside(
      {
        top: 0,
        left: 0,
        width: this.app.screen.width,
        height: this.app.screen.height,
      },
      this.bounds
    );
    const { n, r, x_x, x_y, v_y, v_x } = this.particles;
    const spriteLength = r * 2 * scale;
    // create sprites
    while (this.sprites.length < n) {
      const sprite = PIXI.Sprite.from("/arrow.png");
      sprite.anchor.set(0.5);
      this.sprites.push(sprite);
      this.spriteContainer.addChild(sprite);
    }
    // destroy sprites
    while (this.sprites.length > n) {
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
