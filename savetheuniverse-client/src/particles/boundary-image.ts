import {
  allXY,
  marchingSquares,
  getCardinalIndices,
} from "../common/grid-utils";

export type Image = {
  width: number;
  height: number;
  data: ArrayLike<number>;
};

export type Polygon = {
  x: number[];
  y: number[];
};

export type Spline = {
  x: number[];
  y: number[];
};

export type SampleLookupTable = {
  lookupTable: Int32Array;
  samples: number[];
  sz: number;
  halfSz: number;
};

const { min, max, floor, abs, sign, sqrt, random } = Math;
const INVPHI = (sqrt(5) - 1) / 2; // 1 / phi
const INVPHI2 = (3 - sqrt(5)) / 2; // 1 / phi^2

// JFA with additional steps yielded to improve accuracy
// this particular pattern of steps was the result of trial-and-error testing
function* jfaSteps(n: number) {
  for (let i = n / 2; i >= 1; i /= 2) {
    yield i;
    yield 1;
  }
  for (let i = n / 32; i >= 1; i /= 2) {
    yield i;
  }
  yield 1;
}

export function uploadFile(): Promise<File> {
  return new Promise((resolve) => {
    const fileInput = document.createElement("input");
    fileInput.type = "file";
    fileInput.accept = "image/*";

    fileInput.addEventListener("change", async () => {
      const file = fileInput.files![0];
      resolve(file);
    });

    fileInput.click();
  });
}

export async function fileToImage(file: Blob, maxSz = 1024) {
  let img = await createImageBitmap(file);

  const maxDm = max(img.width, img.height);
  if (maxDm > maxSz) {
    const scale = maxSz / maxDm;
    img = await createImageBitmap(file, {
      resizeWidth: img.width * scale,
      resizeHeight: img.height * scale,
    });
  }

  const canvas = new OffscreenCanvas(img.width, img.height);
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(img, 0, 0, img.width, img.height);
  const data = ctx.getImageData(0, 0, img.width, img.height).data;

  return {
    width: img.width,
    height: img.height,
    data,
  } as Image;
}

export function imageToMask(img: Image) {
  // convert pixel data to 1-bit mask using brightness threshold
  const mask = new Uint8Array(img.width * img.height);
  for (let i = 0; i < mask.length; i++) {
    const r = 255 - img.data[i * 4 + 0];
    const g = 255 - img.data[i * 4 + 1];
    const b = 255 - img.data[i * 4 + 2];
    const a = img.data[i * 4 + 3] / 255;
    mask[i] = +((r + g + b) * a > 192);
  }

  // maybe flip mask, to ensure pixel at 0,0 is always considered as outside the boundary
  if (mask[0] === 0) {
    for (let i = 1; i < mask.length; i++) {
      mask[i] = mask[i] === 1 ? 0 : 1;
    }
  }

  // add 1px border to mask to ensure boundaries are closed
  const bwidth = img.width + 2;
  const bheight = img.height + 2;
  const bmask = new Uint8Array(bwidth * bheight);
  for (let [x, y, i] of allXY(bwidth, bheight)) {
    const j = (y - 1) * img.width + (x - 1);
    const edge = x === 0 || y === 0 || x === bwidth - 1 || y === bheight - 1;
    bmask[i] = +edge || mask[j];
  }

  return {
    width: bwidth,
    height: bheight,
    data: bmask,
  };
}

export function maskToPolygons(mask: Image) {
  const coordsx: number[] = [];
  const coordsy: number[] = [];
  const adjacencyList: number[][] = [];

  // create adjacency list from boundary between white / black pixels
  for (let [tl, tr, bl, br, x, y] of marchingSquares(mask.width, mask.height)) {
    const tld = mask.data[tl];
    const trd = mask.data[tr];
    const bld = mask.data[bl];
    const brd = mask.data[br];
    const edges: number[] = [];
    const [t, l, r, b] = getCardinalIndices(x, y, mask.width - 1);
    if (tld !== trd) edges.push(t);
    if (tld !== bld) edges.push(l);
    if (trd !== brd) edges.push(r);
    if (bld !== brd) edges.push(b);
    coordsx.push(x);
    coordsy.push(y);
    adjacencyList.push(edges);
  }

  // most vertices will have 2 edges at this stage, but some may have 4
  // we split those with 4 edges to ensure all vertices have 2 edges exactly
  for (let [x, y, i] of allXY(mask.width - 1, mask.height - 1)) {
    if (adjacencyList[i].length !== 4) continue;
    const tl = y * mask.width + x;
    const tld = mask.data[tl];
    const j = adjacencyList.length;
    let t = adjacencyList[i][0];
    let l = adjacencyList[i][0];
    let r = adjacencyList[i][0];
    let b = adjacencyList[i][0];
    for (let e of adjacencyList[i]) {
      if (coordsy[e] > y) t = e;
      if (coordsx[e] > x) l = e;
      if (coordsx[e] < x) r = e;
      if (coordsy[e] < y) b = e;
    }

    coordsx.push(x);
    coordsy.push(y);
    if (tld) {
      adjacencyList[i] = [t, r];
      adjacencyList[j] = [l, b];
      const le = adjacencyList[l];
      const be = adjacencyList[b];
      le[le.indexOf(i)] = j;
      be[be.indexOf(i)] = j;
    } else {
      adjacencyList[i] = [t, l];
      adjacencyList[j] = [r, b];
      const re = adjacencyList[r];
      const be = adjacencyList[b];
      re[re.indexOf(i)] = j;
      be[be.indexOf(i)] = j;
    }
  }

  // convert adjacency list to polygons by identifying connected components using DFS
  const polygons: Polygon[] = [];
  const visited = new Array(adjacencyList.length).fill(false);
  for (let i = 0; i < adjacencyList.length; i++) {
    if (visited[i]) continue;
    if (adjacencyList[i].length === 0) continue;

    const polygonx: number[] = [];
    const polygony: number[] = [];

    const stack = [i];
    while (stack.length) {
      const node = stack.pop()!;
      if (visited[node]) continue;

      polygonx.push(coordsx[node]);
      polygony.push(coordsy[node]);

      visited[node] = true;
      for (let neighbor of adjacencyList[node]) {
        if (visited[neighbor]) continue;
        stack.push(neighbor);
      }
    }
    if (polygonx.length < 32) continue;
    polygons.push({ x: polygonx, y: polygony });
  }

  return polygons;
}

// smooth polygon with diffusion method
// mathematically equivalent to gaussian filter as # iterations approaches infinity
export function smoothPolygon(polygon: Polygon, iterations = 32) {
  let polygonx = polygon.x;
  let polygony = polygon.y;
  for (let iter = 0; iter < iterations; iter++) {
    let copyx = polygonx.slice();
    let copyy = polygony.slice();
    let movingAvgx = (copyx[0] + copyx[1]) / 2;
    let movingAvgy = (copyy[0] + copyy[1]) / 2;
    for (let i = 0; i < polygonx.length; i++) {
      polygonx[i] = movingAvgx;
      polygony[i] = movingAvgy;
      movingAvgx -= copyx[i] / 2;
      movingAvgy -= copyy[i] / 2;
      movingAvgx += copyx[(i + 2) % polygonx.length] / 2;
      movingAvgy += copyy[(i + 2) % polygony.length] / 2;
    }
  }
}

// rescale polygons to domain [-0.99, 0.99]
export function rescalePolygons(polygons: Polygon[]) {
  let minx = polygons[0].x[0];
  let maxx = polygons[0].x[0];
  let miny = polygons[0].y[0];
  let maxy = polygons[0].y[0];
  for (let polygon of polygons) {
    for (let i = 0; i < polygon.x.length; i++) {
      minx = min(minx, polygon.x[i]);
      maxx = max(maxx, polygon.x[i]);
      miny = min(miny, polygon.y[i]);
      maxy = max(maxy, polygon.y[i]);
    }
  }
  const dx = maxx - minx;
  const dy = maxy - miny;
  const scale = 1.98 / max(dx, dy);
  const biasx = -0.99 * min(dx / dy, 1);
  const biasy = -0.99 * min(dy / dx, 1);
  for (let polygon of polygons) {
    for (let i = 0; i < polygon.x.length; i++) {
      polygon.x[i] = (polygon.x[i] - minx) * scale + biasx;
      polygon.y[i] = (polygon.y[i] - miny) * scale + biasy;
    }
  }
  return polygons;
}

// create B-Spline by multiplying geometry matrices by basis matrix
export function polygonToBSplineCoeffcients(polygon: Polygon) {
  let polygonx = polygon.x;
  let polygony = polygon.y;
  let n = polygonx.length;

  let coefsx = new Array(n * 4).fill(0);
  let coefsy = new Array(n * 4).fill(0);

  for (let i = 0; i < n; i++) {
    let ax = polygonx[i];
    let bx = polygonx[(i + 1) % polygonx.length];
    let cx = polygonx[(i + 2) % polygonx.length];
    let dx = polygonx[(i + 3) % polygonx.length];

    coefsx[i * 4] = ax * -(1 / 6) + bx * 0.5 + cx * -0.5 + dx * (1 / 6);
    coefsx[i * 4 + 1] = ax * 0.5 - bx + cx * 0.5;
    coefsx[i * 4 + 2] = ax * -0.5 + cx * 0.5;
    coefsx[i * 4 + 3] = ax * (1 / 6) + bx * (2 / 3) + cx * (1 / 6);

    let ay = polygony[i];
    let by = polygony[(i + 1) % polygony.length];
    let cy = polygony[(i + 2) % polygony.length];
    let dy = polygony[(i + 3) % polygony.length];
    coefsy[i * 4] = ay * -(1 / 6) + by * 0.5 + cy * -0.5 + dy * (1 / 6);
    coefsy[i * 4 + 1] = ay * 0.5 - by + cy * 0.5;
    coefsy[i * 4 + 2] = ay * -0.5 + cy * 0.5;
    coefsy[i * 4 + 3] = ay * (1 / 6) + by * (2 / 3) + cy * (1 / 6);
  }

  return { x: coefsx, y: coefsy };
}

const evaluateBSplineReg = [0, 0];
export function evaluateBSpline(
  bSplineCoeffcients: { x: number[]; y: number[] },
  t: number
) {
  let coefsx = bSplineCoeffcients.x;
  let coefsy = bSplineCoeffcients.y;
  let i = (floor(t) * 4 + coefsx.length) % coefsx.length;

  let t1 = t % 1;
  let t2 = t1 * t1;
  let t3 = t2 * t1;
  evaluateBSplineReg[0] =
    coefsx[i] * t3 + coefsx[i + 1] * t2 + coefsx[i + 2] * t1 + coefsx[i + 3];
  evaluateBSplineReg[1] =
    coefsy[i] * t3 + coefsy[i + 1] * t2 + coefsy[i + 2] * t1 + coefsy[i + 3];

  return evaluateBSplineReg;
}

// each entry in the lookup table shall have 8 samples, where each sample has format [spline, t, x, y]
// x & y are the result of precomputing evaluateBSpline(splines[spline], t)
export function splinesToSampleLookupTable(splines: Spline[], sz = 1024) {
  const halfSz = sz / 2;
  const samples: number[] = [];

  // segment splines using bisection search
  for (let s = 0; s < splines.length; s++) {
    let spline = splines[s];
    let maxT = spline.x.length / 4;
    let junctions: number[] = [];
    let lo = 0;
    let hi = 1;

    while (true) {
      let [x1, y1] = evaluateBSpline(spline, lo);
      x1 = floor(x1 * halfSz + halfSz);
      y1 = floor(y1 * halfSz + halfSz);

      // maybe extend hi, to ensure junction is included in search space
      while (true) {
        let [x2, y2] = evaluateBSpline(spline, hi);
        x2 = floor(x2 * halfSz + halfSz);
        y2 = floor(y2 * halfSz + halfSz);
        if (x1 !== x2 || y1 !== y2) break;
        hi += hi - lo;
      }

      for (let i = 0; i <= 20; i++) {
        let mid = lo + (hi - lo) / 2;
        let [x2, y2] = evaluateBSpline(spline, mid);
        x2 = floor(x2 * halfSz + halfSz);
        y2 = floor(y2 * halfSz + halfSz);
        // looking for exact point where we cross from one cell in lookup table to the next
        if (x1 !== x2 || y1 !== y2) {
          hi = mid;
        } else {
          lo = mid;
        }
      }

      if (hi > maxT) break;
      junctions.push(hi);
      lo = hi;
      hi = lo + 1;
    }

    // pick points for multi-start optimisation using junction midpoints
    for (let i = 0; i < junctions.length; i++) {
      let j0 = junctions[i];
      let j1 = junctions[(i + 1) % junctions.length];
      let t = (j0 + j1) * 0.5;
      if (i + 1 === junctions.length) t += maxT * 0.5; // edge case for average of modular numbers
      let [x, y] = evaluateBSpline(spline, t);

      // make space for the eight samples that will eventually be stored in each lookup table entry
      samples.push(s, t, x, y, -1, -1, -1, -1);
      samples.push(-1, -1, -1, -1, -1, -1, -1, -1);
      samples.push(-1, -1, -1, -1, -1, -1, -1, -1);
      samples.push(-1, -1, -1, -1, -1, -1, -1, -1);
    }
  }

  // add seeds to lookup table
  let lookupTable = new Int32Array(sz ** 2).fill(-1);
  for (let s = 0; s < samples.length; s += 32) {
    let x = samples[s + 2];
    let y = samples[s + 3];
    x = floor(x * halfSz + halfSz);
    y = floor(y * halfSz + halfSz);
    lookupTable[y * sz + x] = s;
  }

  // fill lookup table using jump flood algorithm
  let buffer = lookupTable.slice();
  for (let step of jfaSteps(sz)) {
    for (let [x1, y1, i1] of allXY(sz, sz)) {
      let best = lookupTable[i1];
      let dx = samples[best + 2] - (x1 / halfSz - 1);
      let dy = samples[best + 3] - (y1 / halfSz - 1);
      let distSquared = best === -1 ? Infinity : dx ** 2 + dy ** 2;

      for (let dir = 0; dir < 4; dir++) {
        // dir&1 = orientation, (dir&2)-1 = sign
        let x2 = x1 + (dir & 1) * ((dir & 2) - 1) * step;
        let y2 = y1 + +!(dir & 1) * ((dir & 2) - 1) * step;
        if (x2 < 0 || x2 >= sz || y2 < 0 || y2 >= sz) continue;
        let i2 = y2 * sz + x2;
        let c = lookupTable[i2];
        if (c === -1) continue;
        let dx2 = samples[c + 2] - (x1 / halfSz - 1);
        let dy2 = samples[c + 3] - (y1 / halfSz - 1);
        let test = dx2 ** 2 + dy2 ** 2;
        if (test < distSquared) {
          best = c;
          distSquared = test;
        }
      }

      buffer[i1] = best;
    }

    let tmp = lookupTable;
    lookupTable = buffer;
    buffer = tmp;
  }

  // expand number of samples per lookup table entry from 1 to 8, using samples from
  // surrounding lookup table entries and then duplicating the samples
  const combinations: Record<string, number> = {};
  const combinationReg = new Int32Array(4);
  // copy from surrounding lookup table entries
  for (let [tl, tr, bl, br] of marchingSquares(sz, sz)) {
    // the last row / column of the lookup table will have a slightly worse selection of
    // samples as an artifact of the marching squares algorithm, but it's not a big deal
    combinationReg[0] = lookupTable[tl];
    combinationReg[1] = lookupTable[tr];
    combinationReg[2] = lookupTable[bl];
    combinationReg[3] = lookupTable[br];
    // in the v8 JavaScript engine, calling .sort() on a typed array is 10x faster
    // than calling .sort() on a regular array so long as the array is small and a
    // comparison function is not provided. it will use C++ std::sort, which includes
    // specific optimisations for small arrays: https://reviews.llvm.org/D118029
    combinationReg.sort();
    if (combinationReg[0] === combinationReg[3]) {
      buffer[tl] = lookupTable[tl];
      continue;
    }
    const key = combinationReg.join(".");
    if (combinations[key]) {
      buffer[tl] = combinations[key];
      continue;
    }
    combinations[key] = samples.length;
    buffer[tl] = combinations[key];
    let s0 = samples[lookupTable[tl]];
    let t0 = samples[lookupTable[tl] + 1];
    let s1 = samples[lookupTable[tr]];
    let t1 = samples[lookupTable[tr] + 1];
    let s2 = samples[lookupTable[bl]];
    let t2 = samples[lookupTable[bl] + 1];
    let s3 = samples[lookupTable[br]];
    let t3 = samples[lookupTable[br] + 1];
    samples.push(s0, t0, -1, -1, s1, t1, -1, -1);
    samples.push(s2, t2, -1, -1, s3, t3, -1, -1);
    samples.push(-1, -1, -1, -1, -1, -1, -1, -1);
    samples.push(-1, -1, -1, -1, -1, -1, -1, -1);
  }

  lookupTable = buffer;
  // duplicate samples
  for (let i = 0; i < samples.length; i += 32) {
    if (samples[i + 4] === -1) {
      samples[i + 4] = samples[i];
      samples[i + 5] = samples[i + 1];
      samples[i + 8] = samples[i];
      samples[i + 9] = samples[i + 1];
      samples[i + 12] = samples[i];
      samples[i + 13] = samples[i + 1];
    }
    samples[i + 16] = samples[i];
    samples[i + 17] = samples[i + 1];
    samples[i + 20] = samples[i + 4];
    samples[i + 21] = samples[i + 5];
    samples[i + 24] = samples[i + 8];
    samples[i + 25] = samples[i + 9];
    samples[i + 28] = samples[i + 12];
    samples[i + 29] = samples[i + 13];
  }
  // add random deltas to $t$ preventing overlaps
  for (let i = 1; i < samples.length; i += 4) {
    samples[i] += random() * 0.0002 - 0.0001;
  }

  // space samples within each lookup table entry so they are t>=2 apart
  for (let iter = 0; iter < 32; iter++) {
    let deltas = new Float64Array(8);
    let step = 0.5;
    let minD = 2;
    for (let first = 0; first < samples.length; first += 32) {
      deltas.fill(0);
      for (let a = 0; a < 8; a++) {
        for (let b = 0; b < 8; b++) {
          if (a <= b) continue;
          let d = samples[first + a * 4 + 1] - samples[first + b * 4 + 1];
          const delta = max(minD - abs(d), 0) * sign(d) * step;
          deltas[a] += delta;
          deltas[b] -= delta;
        }
      }
      for (let i = 0; i < 8; i++) {
        samples[first + i * 4 + 1] += deltas[i];
      }
    }
  }
  // spacing adjustment breaks space modularity for some samples. fix it here
  for (let i = 0; i < samples.length; i += 4) {
    const spline = splines[samples[i]];
    samples[i + 1] = (samples[i + 1] + spline.x.length) % spline.x.length;
  }

  // precompute coordinates for each sample
  for (let i = 0; i < samples.length; i += 4) {
    const spline = splines[samples[i]];
    const t = samples[i + 1];
    let [x, y] = evaluateBSpline(spline, t);
    if (isNaN(x) || isNaN(y)) {
      debugger;
    }
    samples[i + 2] = x;
    samples[i + 3] = y;
  }

  return { lookupTable, sz, halfSz, samples } as SampleLookupTable;
}

// returns [s, t, x, y], approx if not within r
let closestPointOnBoundaryReg = [0, 0, 0, 0];
export function closestPointOnBoundary(
  splines: Spline[],
  sampleLookupTable: SampleLookupTable,
  x: number,
  y: number,
  r: number
) {
  let { lookupTable, samples, sz, halfSz } = sampleLookupTable;
  let yi = max(min(floor(y * halfSz + halfSz), sz - 1), 0);
  let xi = max(min(floor(x * halfSz + halfSz), sz - 1), 0);
  let offset = lookupTable[yi * sz + xi];

  // get closest sample from lookup table entry
  let mindex = 0;
  let minval = (samples[offset + 2] - x) ** 2 + (samples[offset + 3] - y) ** 2;
  let test = (samples[offset + 6] - x) ** 2 + (samples[offset + 7] - y) ** 2;
  if (test < minval) (mindex = 4), (minval = test);
  test = (samples[offset + 10] - x) ** 2 + (samples[offset + 11] - y) ** 2;
  if (test < minval) (mindex = 8), (minval = test);
  test = (samples[offset + 14] - x) ** 2 + (samples[offset + 15] - y) ** 2;
  if (test < minval) (mindex = 12), (minval = test);
  test = (samples[offset + 18] - x) ** 2 + (samples[offset + 19] - y) ** 2;
  if (test < minval) (mindex = 16), (minval = test);
  test = (samples[offset + 22] - x) ** 2 + (samples[offset + 23] - y) ** 2;
  if (test < minval) (mindex = 20), (minval = test);
  test = (samples[offset + 26] - x) ** 2 + (samples[offset + 27] - y) ** 2;
  if (test < minval) (mindex = 24), (minval = test);
  test = (samples[offset + 30] - x) ** 2 + (samples[offset + 31] - y) ** 2;
  if (test < minval) (mindex = 28), (minval = test);
  offset += mindex;

  // if (1 > 0) {
  //   closestPointOnBoundaryReg[0] = samples[offset + 0];
  //   closestPointOnBoundaryReg[1] = samples[offset + 1];
  //   closestPointOnBoundaryReg[2] = samples[offset + 2];
  //   closestPointOnBoundaryReg[3] = samples[offset + 3];
  //   return closestPointOnBoundaryReg;
  // }

  let splinedex = samples[offset];
  let spline = splines[splinedex];
  let t = samples[offset + 1];
  let a = t - 1;
  let b = t + 1;

  let h = b - a;

  let c = a + INVPHI2 * h;
  let d = a + INVPHI * h;
  let ev = evaluateBSpline(spline, c);
  let yc = (ev[0] - x) ** 2 + (ev[1] - y) ** 2;
  ev = evaluateBSpline(spline, d);
  let yd = (ev[0] - x) ** 2 + (ev[1] - y) ** 2;

  for (let k = 0; k < 20; k++) {
    if (yc < yd) {
      b = d;
      d = c;
      yd = yc;
      h = INVPHI * h;
      c = a + INVPHI2 * h;
      ev = evaluateBSpline(spline, c);
      yc = (ev[0] - x) ** 2 + (ev[1] - y) ** 2;
    } else {
      a = c;
      c = d;
      yc = yd;
      h = INVPHI * h;
      d = a + INVPHI * h;
      ev = evaluateBSpline(spline, d);
      yd = (ev[0] - x) ** 2 + (ev[1] - y) ** 2;
    }
  }

  t = yc < yd ? (a + d) / 2 : (c + b) / 2;
  ev = evaluateBSpline(spline, t);
  closestPointOnBoundaryReg[0] = splinedex;
  closestPointOnBoundaryReg[1] = t;
  closestPointOnBoundaryReg[2] = ev[0];
  closestPointOnBoundaryReg[3] = ev[1];

  return closestPointOnBoundaryReg;
}
