import { Core } from "./core";

const { ceil, floor, min, sqrt } = Math;

/**
 * \mathbf{J} = \frac{(1 + E)(\mathbf{x}_1 - \mathbf{x}_2)}{2} \frac{\langle \mathbf{v}_1 - \mathbf{v}_2, \mathbf{x}_1 - \mathbf{x}_2\rangle}{\langle \mathbf{x}_1 - \mathbf{x}_2, \mathbf{x}_1 - \mathbf{x}_2\rangle}, \\
 * S = \frac{\|\mathbf{v}_1\| + \|\mathbf{v}_2\|}{\|\mathbf{v}_1 - \mathbf{J}\| + \|\mathbf{v}_2 + \mathbf{J}\|}, \\
 * \mathbf{v}'_1 = S(\mathbf{v}_1 - \mathbf{J}), \\
 * \mathbf{v}'_2 = S(\mathbf{v}_2 + \mathbf{J})
 */
export function collideParticles(
  particles: Core["particles"],
  displacement: Core["particleDisplacementBuffer"],
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

  // Calculate displacement required to remove particle overlap
  const dx_m = sqrt(dxDotDx);
  const D_s = ((r * 2 - dx_m) / dx_m) * 0.5001;
  const D_x = D_s * dx_x;
  const D_y = D_s * dx_y;

  // Store updated displacement in temporary buffer
  // It is not applied until all particle-particle collisions have been detected, to improve simulation accuracy
  displacement.D_x[i] += D_x;
  displacement.D_y[i] += D_y;
  displacement.D_x[j] -= D_x;
  displacement.D_y[j] -= D_y;

  // Get elasticity coefficient and particle velocities
  const E = particles.E;
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

// Using the cell grid technique often used in molecular dynamics
export class ParticleDetector {
  grid = new Int32Array();
  cellSize = 1;
  gridLength = 2;
  coordToIndexWeight = 1;
  coordToIndexBias = 1;
  indexToCoordWeight = 1;
  indexToCoordBias = -1;
  cellAllocation = 8;
  constructor(public core: Core) {
    this.resize();
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

    // a typical grid cell might look like: [3, 832, 163, 387, -1, -1, -1, -1]
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
    coordToIndexBias += gl - 1;
    for (let i = 0; i < n; i++) {
      let x = floor(x_x[i] * coordToIndexWeight + coordToIndexBias);
      let y = floor(x_y[i] * coordToIndexWeight + coordToIndexBias);
      let yn = y + 2;
      let xn = x + 2;
      for (; y <= yn; y++) {
        let yi = (y % gl) * gl;
        for (x = xn - 2; x <= xn; x++) {
          // these lines of code run more than any other in the particle toy
          let xi = x % gl;
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
          if (g[cell + 4]) continue; // uncommon to have >3 particles in a cell
          if (i < g[cell + 4]) callback(i, g[cell + 4]);
          if (i < g[cell + 5]) callback(i, g[cell + 5]);
          if (i < g[cell + 6]) callback(i, g[cell + 6]);
          if (i < g[cell + 7]) callback(i, g[cell + 7]);
        }
      }
    }
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
