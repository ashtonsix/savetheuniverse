import Canvas from "../common/canvas";
import { allXY } from "../common/grid-utils";
import {
  imageToMask,
  maskToPolygons,
  rescalePolygons,
  Spline,
  smoothPolygon,
  polygonToBSplineCoeffcients,
  splinesToSampleLookupTable,
  Image,
  closestPointOnBoundary,
  evaluateBSpline,
} from "./boundary-image";
import { Core } from "./core";

const { max, floor, abs, sign } = Math;
type SDF = (x: number, y: number) => number;

export function collideBoundary(
  particles: Core["particles"],
  i: number,
  d: number,
  n_x: number,
  n_y: number
) {
  const vDotN = particles.v_x[i] * n_x + particles.v_y[i] * n_y;
  const D_m = -d - particles.r;
  const D_x = n_x * D_m;
  const D_y = n_y * D_m;
  particles.x_x[i] += D_x;
  particles.x_y[i] += D_y;
  if (vDotN < 0) return;
  const J_x = -vDotN * n_x * 2;
  const J_y = -vDotN * n_y * 2;
  particles.v_x[i] += J_x;
  particles.v_y[i] += J_y;
}

const approxLookupTableSz = 1024;
const approxLookupTableHalfSz = approxLookupTableSz / 2;
const approxError = (4 * 2 ** 0.5) / approxLookupTableSz;

export class Boundary {
  area = 0;
  private approxLookupTable = new Float64Array(approxLookupTableSz ** 2);
  private distanceImpl: SDF = () => 0;
  private collidesImplReg = [0, 0, 0];
  private collidesImpl: (x: number, y: number, r: number) => number[] | null =
    () => null;
  async update(imgOrSdf: Image | SDF) {
    // initialise underlying implementations for distance and collision
    if (imgOrSdf instanceof Function) {
      const sdf = imgOrSdf;
      this.distanceImpl = sdf;
      this.collidesImpl = (x, y, r) => {
        const d = sdf(x, y);
        if (d < -r) return null;
        const ddx = sdf(x + 1e-5, y) - sdf(x - 1e-5, y);
        const ddy = sdf(x, y + 1e-5) - sdf(x, y - 1e-5);
        const norm = 1 / (ddx ** 2 + ddy ** 2) ** 0.5;
        this.collidesImplReg[0] = d;
        this.collidesImplReg[1] = ddx * norm;
        this.collidesImplReg[2] = ddy * norm;
        return this.collidesImplReg;
      };
    } else {
      const img = imgOrSdf;
      const mask = imageToMask(img);
      const polygons = maskToPolygons(mask);
      rescalePolygons(polygons);
      const spl: Spline[] = [];
      for (let p of polygons) {
        smoothPolygon(p, 128);
        spl.push(polygonToBSplineCoeffcients(p));
      }
      const resolution = 64;
      const tbl = splinesToSampleLookupTable(spl, resolution);
      this.distanceImpl = (x1, y1) => {
        const [si, t, x2, y2] = closestPointOnBoundary(spl, tbl, x1, y1, 0);
        const d = ((x1 - x2) ** 2 + (y1 - y2) ** 2) ** 0.5;

        const [x3, y3] = evaluateBSpline(spl[si], t - 1e-5);
        const [x4, y4] = evaluateBSpline(spl[si], t + 1e-5);
        const ddx = x3 - x4;
        const ddy = y3 - y4;
        const norm = 1 / (ddx ** 2 + ddy ** 2) ** 0.5;
        const nx = ddy * -norm;
        const ny = ddy * norm;
        const inside = sign(nx * x1 + ny * y1);

        return d * inside;
      };
      this.collidesImpl = (x1, y1, r) => {
        const [si, t, x2, y2] = closestPointOnBoundary(spl, tbl, x1, y1, r);
        const d = ((x1 - x2) ** 2 + (y1 - y2) ** 2) ** 0.5;
        if (d < -r) return null;
        const [x3, y3] = evaluateBSpline(spl[si], t - 1e-5);
        const [x4, y4] = evaluateBSpline(spl[si], t + 1e-5);
        const ddx = x3 - x4;
        const ddy = y3 - y4;
        const norm = 1 / (ddx ** 2 + ddy ** 2) ** 0.5;
        const nx = ddy * norm;
        const ny = ddx * norm;
        const inside = sign(nx * x1 + ny * y1);
        this.collidesImplReg[0] = d * inside;
        this.collidesImplReg[1] = nx;
        this.collidesImplReg[2] = ny;
        return this.collidesImplReg;
      };
    }

    // generate approx distance lookup table
    for (let [x, y, i] of allXY(approxLookupTableSz, approxLookupTableSz)) {
      x = x / approxLookupTableHalfSz - 1;
      y = y / approxLookupTableHalfSz - 1;
      this.approxLookupTable[i] = this.distanceImpl(x, y);
    }

    // estimate area within boundary using Monte Carlo method
    let samples = 100_000;
    let inside = 0;
    for (let i = 0; i < samples; i++) {
      let x = Math.random() * 2 - 1;
      let y = Math.random() * 2 - 1;
      if (this.distance(x, y, 0) < 0) inside++;
    }
    this.area = 4 * (inside / samples);
  }
  // returns exact distance to boundary if within $r$, otherwise returns approximate distance
  distance(x: number, y: number, r: number) {
    // let xi = floor(x * approxLookupTableHalfSz + approxLookupTableHalfSz);
    // let yi = floor(y * approxLookupTableHalfSz + approxLookupTableHalfSz);
    // let d = this.approxLookupTable[yi * approxLookupTableSz + xi];
    // if (abs(d) > r + approxError) return d;
    return this.distanceImpl(x, y);
  }
  // triggers callback with distance+normal if outside or within $r$ of boundary
  collides(
    x: number,
    y: number,
    r: number,
    callbackFn: (d: number, nx: number, ny: number) => void
  ) {
    // do nothing if approx distance shows no collision
    let xi = floor(x * approxLookupTableHalfSz + approxLookupTableHalfSz);
    let yi = floor(y * approxLookupTableHalfSz + approxLookupTableHalfSz);
    let approxDistance = this.approxLookupTable[yi * approxLookupTableSz + xi];
    if (approxDistance < -(r + approxError)) return;

    // do nothing if collidesImpl shows no collision (using exact distance)
    const c = this.collidesImpl(x, y, r);
    if (c === null) return;
    let [d, nx, ny] = c;

    // check for collision with second contact point
    const x2 = x + nx * (-d - r);
    const y2 = y + ny * (-d - r);
    const c2 = this.collidesImpl(x2, y2, r);
    if (c2 === null) return callbackFn(d, nx, ny);
    const [, nx2, ny2] = c2;

    // combine contact points if there are two
    const ddx = nx + nx2;
    const ddy = ny + ny2;
    const norm = 1 / (ddx ** 2 + ddy ** 2) ** 0.5;
    callbackFn(d, ddx * norm, ddy * norm);
  }
  // generate sample within boundary
  private sampleInsideReg = [0, 0];
  sampleInside(r: number) {
    while (true) {
      let x = Math.random() * 2 - 1;
      let y = Math.random() * 2 - 1;
      if (this.distance(x, y, 0) < -r) {
        this.sampleInsideReg[0] = x;
        this.sampleInsideReg[1] = y;
        return this.sampleInsideReg;
      }
    }
  }
}

export class BoundaryViz {
  canvas: Canvas;
  container: HTMLDivElement;
  resizeObserver: ResizeObserver;
  constructor(public boundary: Boundary, public outerContainer: HTMLElement) {
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
    const boundary = this.boundary;
    const { height: h, width: w } = this.canvas;
    const l = max(w, h);
    const linv = 1 / l;

    this.canvas.draw((img: Uint8ClampedArray) => {
      for (let yi = 0; yi < h; yi++) {
        for (let xi = 0; xi < w; xi++) {
          const x = (xi - w / 2) * linv * 2;
          const y = (yi - h / 2) * linv * 2;
          const inside =
            +(boundary.distance(x - linv, y - linv, 0) < 0) +
            +(boundary.distance(x - linv, y + linv, 0) < 0) +
            +(boundary.distance(x + linv, y - linv, 0) < 0) +
            +(boundary.distance(x + linv, y + linv, 0) < 0);
          const v = [0, 255, 255, 255, 24][inside];
          // const v = (((sdf(x, y) * 200) % 128) + 128) % 128;
          // if (inside === 0 || inside === 4) {
          //   // use ray marching optimisation to draw many pixels per boundary measurement
          //   const d = floor(abs(boundary.distance(x, y, 0) * l * 0.5) - 1);
          //   const n = xi + min(w - xi, d);
          //   for (; xi < n; xi++) {
          //     const i = yi * w + xi;
          //     img[i * 4 + 0] = v;
          //     img[i * 4 + 1] = v;
          //     img[i * 4 + 2] = v;
          //     img[i * 4 + 3] = 255;
          //   }
          // }
          const i = yi * w + xi;
          img[i * 4 + 0] = v;
          img[i * 4 + 1] = v;
          img[i * 4 + 2] = v;
          img[i * 4 + 3] = 255;
        }
      }
    });
  }
}
