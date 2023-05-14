import { Core } from "./core";

const { ceil, floor, min, sqrt } = Math;

class GridDetector {
  grid = new Int32Array();
  cellSize = 1;
  gridLength = 2;
  coordToIndexWeight = 1;
  coordToIndexBias = 1;
  indexToCoordWeight = 1;
  indexToCoordBias = -1;
  constructor(public cellAllocation: number, public core: Core) {
    this.resize();
  }
  reset() {
    // performance hack for filling typed arrays faster:
    // https://groups.google.com/u/1/g/v8-dev/c/TThTHiHrgFM/m/2uMq05CoAgAJ
    new Int8Array(this.grid.buffer).fill(0);
  }
  resize() {
    // 1.0001 multiplier is there to protect against floating point precision issues
    this.cellSize = this.core.particles.r * 2 * 1.0001;
    this.gridLength = ceil(2 / this.cellSize);
    // 0 -> this.gridLength/2
    //
    // [-1, 1] -> [0, gridLength]
    this.coordToIndexWeight = 1 / this.cellSize;
    this.coordToIndexBias = 1 / this.cellSize;
    // [0, gridLength] -> [-1, 1]
    this.indexToCoordWeight = this.cellSize;
    this.indexToCoordBias = -1 + this.cellSize / 2;

    const gridAllocation = this.gridLength ** 2 * this.cellAllocation;
    if (gridAllocation > this.grid.length) {
      this.grid = new Int32Array(gridAllocation);
    }
  }
}

export class BoundaryDetector extends GridDetector {
  constructor(public core: Core) {
    super(1, core);
  }
  index() {
    const sdf = this.core.boundary;
    this.reset();

    let { grid, gridLength, indexToCoordWeight, indexToCoordBias } = this;
    let { r } = this.core.particles;
    let distanceThreshold = -(sqrt(r ** 2 * 2) + r);

    for (let xi = 0; xi < gridLength; xi++) {
      for (let yi = 0; yi < gridLength; yi++) {
        let i = yi * gridLength + xi;
        let x = xi * indexToCoordWeight + indexToCoordBias;
        let y = yi * indexToCoordWeight + indexToCoordBias;
        grid[i] = +(sdf(x, y) > distanceThreshold);
      }
    }
  }
  detect(callback: (i: number, d: number, nx: number, ny: number) => void) {
    let epsilon = 1e-6;
    let { grid, gridLength, coordToIndexWeight, coordToIndexBias } = this;
    const { boundary: sdf } = this.core;
    const { n, r, x_x, x_y } = this.core.particles;
    for (let i = 0; i < n; i++) {
      let x = x_x[i];
      let y = x_y[i];
      let xi = floor(x * coordToIndexWeight + coordToIndexBias);
      let yi = floor(y * coordToIndexWeight + coordToIndexBias);
      let j = yi * gridLength + xi;
      // use index to skip expensive computations when particles are far from the boundary
      if (!grid[j]) continue;
      const d = sdf(x, y);
      if (-r > d) continue;
      const ddx = sdf(x + epsilon, y) - sdf(x - epsilon, y);
      const ddy = sdf(x, y + epsilon) - sdf(x, y - epsilon);
      const norm = 1 / sqrt(ddx * ddx + ddy * ddy);
      callback(i, d, ddx * norm, ddy * norm);
    }
  }
}

// Using the cell grid technique often used in molecular dynamics
export class ParticleDetector extends GridDetector {
  constructor(public core: Core) {
    super(8, core);
  }
  index() {
    const { n, x_x, x_y } = this.core.particles;
    let {
      grid: g,
      gridLength,
      coordToIndexWeight,
      coordToIndexBias,
      cellAllocation: ca,
    } = this;
    this.reset();

    // a typical grid cell might look like: [3, 832, 163, 387, 0, 0, 0, 0]
    // the first number of each cell counts the particles in that cell

    for (let i = 0; i < n; i++) {
      let x = floor(x_x[i] * coordToIndexWeight + coordToIndexBias);
      let y = floor(x_y[i] * coordToIndexWeight + coordToIndexBias);
      let j = y * gridLength + x;
      g[j * ca + min(++g[j * ca], ca - 1)] = i;
    }
  }
  detect(callback: (i: number, j: number) => void) {
    const { n, x_x, x_y } = this.core.particles;
    let {
      grid: g,
      gridLength: gl,
      coordToIndexWeight,
      coordToIndexBias,
      cellAllocation: ca,
    } = this;
    for (let i = 0; i < n; i++) {
      let x = floor(x_x[i] * coordToIndexWeight + coordToIndexBias);
      let y = floor(x_y[i] * coordToIndexWeight + coordToIndexBias);
      for (let yd = -1; yd <= 1; yd++) {
        let yi = ((y + yd + gl) % gl) * gl;
        for (let xd = -1; xd <= 1; xd++) {
          // this is the "hottest" loop of the simulation, these lines of code run
          // more than any other
          let xi = (x + xd + gl) % gl;
          let cell = (yi + xi) * ca;
          /**
           * here, multiple if statements are faster than another inner loop; this
           * optimisation is a variation of Duff's tool
           *
           * less-than predicate prevents:
           *
           * - duplicate collision handling for particle pairs
           * - particle self-collision (g[cell] == g[cell])
           * - handling of empty cells (g[cell] == 0)
           */
          if (i < g[cell + 1]) callback(i, g[cell + 1]);
          if (i < g[cell + 2]) callback(i, g[cell + 2]);
          if (i < g[cell + 3]) callback(i, g[cell + 3]);
          if (!g[cell + 4]) continue; // uncommon to have >3 particles in a cell
          if (i < g[cell + 4]) callback(i, g[cell + 4]);
          if (i < g[cell + 5]) callback(i, g[cell + 5]);
          if (i < g[cell + 6]) callback(i, g[cell + 6]);
          if (i < g[cell + 7]) callback(i, g[cell + 7]);
        }
      }
    }
  }
}
