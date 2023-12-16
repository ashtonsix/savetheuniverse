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
  cx: number[];
  cy: number[];
};

const { min, max, floor, sqrt } = Math;
const INVPHI = (sqrt(5) - 1) / 2; // 1 / phi
const INVPHI2 = (3 - sqrt(5)) / 2; // 1 / phi^2

let LOOKUP_SZ1 = 1024;
let LOOKUP_SZ0 = 512;
let LOOKUP_SPLINE_MASK = 4095;
let LOOKUP_TIME_SHIFT = 12;

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

  // maybe flip polygons, to ensure normals always point outwards
  for (let p of polygons) {
    let mx = (p.x[0] + p.x[1]) * 0.5;
    let my = (p.y[0] + p.y[1]) * 0.5;
    let nx = (p.y[1] - p.y[0]) * 0.5;
    let ny = (p.x[0] - p.x[1]) * 0.5;
    let x = floor(mx + nx);
    let y = floor(my + ny);
    if (mask.data[y * mask.width + x] === 1) {
      p.x.reverse();
      p.y.reverse();
    }
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
  const biasx = -1.0 * min(dx / dy, 1);
  const biasy = -1.0 * min(dy / dx, 1);
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

  const cachex = new Array(n).fill(0);
  const cachey = new Array(n).fill(0);

  const spline = { x: coefsx, y: coefsy, cx: cachex, cy: cachey };
  for (let t = 0; t < n; t++) {
    const [x, y] = evaluateBSpline(spline, t);
    spline.cx[t] = x;
    spline.cy[t] = y;
  }

  return spline;
}

const evaluateBSplineReg = [0, 0];
export function evaluateBSpline(spline: Spline, t: number) {
  t = (t + spline.cx.length) % spline.cx.length;
  let coefsx = spline.x;
  let coefsy = spline.y;
  let i = floor(t) * 4;

  let t1 = t % 1;
  let t2 = t1 * t1;
  let t3 = t2 * t1;
  evaluateBSplineReg[0] =
    coefsx[i] * t3 + coefsx[i + 1] * t2 + coefsx[i + 2] * t1 + coefsx[i + 3];
  evaluateBSplineReg[1] =
    coefsy[i] * t3 + coefsy[i + 1] * t2 + coefsy[i + 2] * t1 + coefsy[i + 3];

  return evaluateBSplineReg;
}

// one iteration of JFA (Jump Flood Algorithm)
function refineLookupTableJump(
  splines: Spline[],
  readTable: Uint32Array,
  writeTable: Uint32Array,
  step: number
) {
  let sz1 = readTable.length ** 0.5;
  let sz0 = sz1 * 0.5;
  for (let [xi1, yi1, i1] of allXY(sz1, sz1)) {
    let x1 = xi1 / sz0 - 1;
    let y1 = yi1 / sz0 - 1;

    let best = readTable[i1];
    let distSquared = Infinity;

    if (best !== LOOKUP_SPLINE_MASK) {
      let si = best & LOOKUP_SPLINE_MASK;
      let t = best >> LOOKUP_TIME_SHIFT;
      let dx1 = splines[si].cx[t] - x1;
      let dy1 = splines[si].cy[t] - y1;

      distSquared = dx1 ** 2 + dy1 ** 2;
    }

    for (let dir = 0; dir < 4; dir++) {
      // dir&1 = orientation, (dir&2)-1 = sign
      let xi2 = xi1 + (dir & 1) * ((dir & 2) - 1) * step;
      let yi2 = yi1 + +!(dir & 1) * ((dir & 2) - 1) * step;
      if (xi2 < 0 || xi2 >= sz1 || yi2 < 0 || yi2 >= sz1) continue;
      let i2 = yi2 * sz1 + xi2;
      let compare = readTable[i2];
      if (compare === LOOKUP_SPLINE_MASK) continue;
      let si = compare & LOOKUP_SPLINE_MASK;
      let t = compare >> LOOKUP_TIME_SHIFT;
      let dx2 = splines[si].cx[t] - x1;
      let dy2 = splines[si].cy[t] - y1;

      let test = dx2 ** 2 + dy2 ** 2;
      if (test < distSquared) {
        best = compare;
        distSquared = test;
      }
    }

    writeTable[i1] = best;
  }

  return [writeTable, readTable];
}

// for each lookup table entry, each referencing a point on a spline, look at other
// points surrounding the currently stored point to see if there's a better match
function refineLookupTableSearch(splines: Spline[], table: Uint32Array) {
  let sz1 = table.length ** 0.5;
  let sz0 = sz1 * 0.5;
  for (let [xi, yi, i] of allXY(sz1, sz1)) {
    let x1 = xi / sz0 - 1;
    let y1 = yi / sz0 - 1;

    let s = splines[table[i] & LOOKUP_SPLINE_MASK];
    let t = table[i] >> LOOKUP_TIME_SHIFT;
    let lo = t - 1;
    let hi = t + 1;

    let x2 = s.cx[t];
    let y2 = s.cy[t];
    let best = (x2 - x1) ** 2 + (y2 - y1) ** 2;

    // maybe extend bounds, to include local minima in search
    for (let i = 0; i < 8; i++) {
      let x3 = s.cx[hi % s.cx.length];
      let y3 = s.cy[hi % s.cy.length];
      if ((x3 - x1) ** 2 + (y3 - y1) ** 2 > best) break;
      hi += hi - t;
    }
    for (let i = 0; i < 8; i++) {
      let x3 = s.cx[(lo + s.cx.length) % s.cx.length];
      let y3 = s.cy[(lo + s.cy.length) % s.cy.length];
      if ((x3 - x1) ** 2 + (y3 - y1) ** 2 > best) break;
      lo += lo - t;
    }
    lo = lo % s.cx.length; // range = [-maxT, maxT]

    // bisection search (for integer value)
    while (lo < hi) {
      const c3 = Math.floor((lo + hi) / 2);
      const x3 = s.cx[(c3 + s.cx.length) % s.cx.length];
      const y3 = s.cy[(c3 + s.cy.length) % s.cy.length];
      const c4 = c3 + 1;
      const x4 = s.cx[(c4 + s.cx.length) % s.cx.length];
      const y4 = s.cy[(c4 + s.cy.length) % s.cy.length];
      if ((x3 - x1) ** 2 + (y3 - y1) ** 2 < (x4 - x1) ** 2 + (y4 - y1) ** 2) {
        hi = c3;
      } else {
        lo = c4;
      }
    }
    lo = (lo + s.cx.length) % s.cx.length;

    table[i] = (table[i] & LOOKUP_SPLINE_MASK) | (lo << LOOKUP_TIME_SHIFT);
  }
}

// each lookup table entry is 32 bits, with the first 12 being the
// spline index, and next 20 being the position on the spline
export function splinesToSampleLookupTable(splines: Spline[]) {
  splines = splines.slice(0, LOOKUP_SPLINE_MASK);

  let sz2 = LOOKUP_SZ1;
  let sz1 = LOOKUP_SZ0;
  let sz0 = sz1 * 0.5;

  let table1 = new Uint32Array(sz1 ** 2).fill(LOOKUP_SPLINE_MASK);

  // add seeds to lookup table
  for (let si = 0; si < splines.length; si++) {
    let spline = splines[si];
    let maxT = spline.cx.length;
    for (let t = 0; t < maxT; t++) {
      let xi = floor(spline.cx[t] * sz0 + sz0);
      let yi = floor(spline.cy[t] * sz0 + sz0);
      table1[yi * sz1 + xi] = (t << LOOKUP_TIME_SHIFT) + si;
    }
  }

  // fill lookup table using jump flood algorithm
  let buf1 = table1.slice();
  [table1, buf1] = refineLookupTableJump(splines, table1, buf1, 1);
  for (let step = sz1 / 2; step >= 1; step /= 2) {
    [table1, buf1] = refineLookupTableJump(splines, table1, buf1, step);
  }
  refineLookupTableSearch(splines, table1);

  // scale-up table and refine
  let table2 = new Uint32Array(sz2 ** 2);
  for (let [xi, yi, i] of allXY(sz2, sz2)) {
    let j = floor(yi * 0.5) * sz1 + floor(xi * 0.5);
    table2[i] = table1[j];
  }
  let buf2 = table2.slice();
  [table2, buf2] = refineLookupTableJump(splines, table2, buf2, 1);
  [table2, buf2] = refineLookupTableJump(splines, table2, buf2, 1);
  refineLookupTableSearch(splines, table2);

  return table2;
}

// returns [s, t, x, y], approx if not within r
let closestPointOnBoundaryReg = [0, 0, 0, 0];
export function closestPointOnBoundary(
  splines: Spline[],
  lookupTable: Uint32Array,
  x: number,
  y: number,
  r: number
) {
  let yi = max(min(floor(y * LOOKUP_SZ0 + LOOKUP_SZ0), LOOKUP_SZ1 - 2), 0);
  let xi = max(min(floor(x * LOOKUP_SZ0 + LOOKUP_SZ0), LOOKUP_SZ1 - 2), 0);

  // get closest lookup from 4 lookup table entries
  let lookup = lookupTable[yi * LOOKUP_SZ1 + xi];
  let si = lookup & LOOKUP_SPLINE_MASK;
  let t = lookup >> LOOKUP_TIME_SHIFT;
  let test = (splines[si].cx[t] - x) ** 2 + (splines[si].cy[t] - y) ** 2;
  let minval = test;
  let minsi = si;
  let mint = t;
  lookup = lookupTable[yi * LOOKUP_SZ1 + (xi + 1)];
  si = lookup & LOOKUP_SPLINE_MASK;
  t = lookup >> LOOKUP_TIME_SHIFT;
  test = (splines[si].cx[t] - x) ** 2 + (splines[si].cy[t] - y) ** 2;
  if (test < minval) (minsi = si), (mint = t), (minval = test);
  lookup = lookupTable[(yi + 1) * LOOKUP_SZ1 + xi];
  si = lookup & LOOKUP_SPLINE_MASK;
  t = lookup >> LOOKUP_TIME_SHIFT;
  test = (splines[si].cx[t] - x) ** 2 + (splines[si].cy[t] - y) ** 2;
  if (test < minval) (minsi = si), (mint = t), (minval = test);
  lookup = lookupTable[(yi + 1) * LOOKUP_SZ1 + (xi + 1)];
  si = lookup & LOOKUP_SPLINE_MASK;
  t = lookup >> LOOKUP_TIME_SHIFT;
  test = (splines[si].cx[t] - x) ** 2 + (splines[si].cy[t] - y) ** 2;
  if (test < minval) (minsi = si), (mint = t), (minval = test);

  closestPointOnBoundaryReg[0] = si;
  closestPointOnBoundaryReg[1] = t;
  closestPointOnBoundaryReg[2] = splines[si].cx[t];
  closestPointOnBoundaryReg[3] = splines[si].cy[t];
  return closestPointOnBoundaryReg;

  // // TODO: return early if outside r

  // let splinedex = minsi;
  // let spline = splines[splinedex];
  // t = mint;
  // let a = t - 1;
  // let b = t + 1;

  // let h = b - a;

  // let c = a + INVPHI2 * h;
  // let d = a + INVPHI * h;
  // let ev = evaluateBSpline(spline, c);
  // let yc = (ev[0] - x) ** 2 + (ev[1] - y) ** 2;
  // ev = evaluateBSpline(spline, d);
  // let yd = (ev[0] - x) ** 2 + (ev[1] - y) ** 2;

  // // golden section search
  // for (let k = 0; k < 28; k++) {
  //   if (yc < yd) {
  //     b = d;
  //     d = c;
  //     yd = yc;
  //     h = INVPHI * h;
  //     c = a + INVPHI2 * h;
  //     ev = evaluateBSpline(spline, c);
  //     yc = (ev[0] - x) ** 2 + (ev[1] - y) ** 2;
  //     // if yc < (r + error), break
  //   } else {
  //     a = c;
  //     c = d;
  //     yc = yd;
  //     h = INVPHI * h;
  //     d = a + INVPHI * h;
  //     ev = evaluateBSpline(spline, d);
  //     yd = (ev[0] - x) ** 2 + (ev[1] - y) ** 2;
  //     // if yd < (r + error), break
  //   }
  // }

  // t = yc < yd ? (a + d) / 2 : (c + b) / 2;
  // ev = evaluateBSpline(spline, t);
  // closestPointOnBoundaryReg[0] = splinedex;
  // closestPointOnBoundaryReg[1] = t;
  // closestPointOnBoundaryReg[2] = ev[0];
  // closestPointOnBoundaryReg[3] = ev[1];

  // return closestPointOnBoundaryReg;
}
