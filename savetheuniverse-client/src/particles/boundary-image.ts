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

const { min, max, abs, floor } = Math;

// 2+JFA+2, which has fewer innacurracies than plain JFA
function* jfaSteps(n: number) {
  yield 1;
  for (let i = n / 2; i >= 1; n /= 2) {
    yield i;
  }
  yield 1;
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
// should be equivalent to gaussian filter
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
  let i = (floor(t) * 4) % coefsx.length;

  let t1 = t % 1;
  let t2 = t1 * t1;
  let t3 = t2 * t1;
  evaluateBSplineReg[0] =
    coefsx[i] * t3 + coefsx[i + 1] * t2 + coefsx[i + 2] * t1 + coefsx[i + 3];
  evaluateBSplineReg[1] =
    coefsy[i] * t3 + coefsy[i + 1] * t2 + coefsy[i + 2] * t1 + coefsy[i + 3];

  return evaluateBSplineReg;
}

export function splinesToSegmentLookupTable(splines: Spline[], sz = 4096) {
  const halfSz = sz / 2;
  const segments: number[] = [];

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

    // pick junctions such that segments of distance <= 3 from each other overlap
    for (let i = 0; i < junctions.length; i++) {
      let j0 = junctions[(i + junctions.length - 1) % junctions.length];
      let j3 = junctions[(i + 2) % junctions.length];
      let d = abs(j3 - j0) * 0.001;
      let a = j0 - d;
      let b = j3 + d;
      segments.push(s, a, b, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1);
    }
  }

  // add seeds to lookup table
  let lookupTable = new Int32Array(sz ** 2).fill(-1);
  let midpointsx: number[] = [];
  let midpointsy: number[] = [];
  for (let s = 0; s < segments.length; s += 13) {
    let t = (segments[s + 1] + segments[s + 2]) / 2;
    let [x, y] = evaluateBSpline(splines[segments[s]], t);
    midpointsx.push(x);
    midpointsy.push(y);
    x = floor(x * halfSz + halfSz);
    y = floor(y * halfSz + halfSz);
    lookupTable[y * sz + sz] = s;
  }

  // fill lookup table using jump flood algorithm
  let buffer = lookupTable.slice();
  for (let step of jfaSteps(sz)) {
    for (let [x1, y1, i1] of allXY(sz, sz)) {
      let best = lookupTable[i1];
      let dx = midpointsx[best] - (x1 / halfSz - 1);
      let dy = midpointsx[best] - (y1 / halfSz - 1);
      let dist = best === -1 ? Infinity : dx ** 2 + dy ** 2;

      for (let dir = 0; dir < 4; dir++) {
        let x2 = x1 + (dir & 1 ? step : -step);
        let y2 = y1 + (dir & 2 ? step : -step);
        if (x2 < 0 || x2 >= sz || y2 < 0 || y2 >= sz) continue;
        let i2 = y2 * sz + x2;
        let c = lookupTable[i2];
        if (c === -1) continue;
        let dx = midpointsx[c] - (x2 / halfSz - 1);
        let dy = midpointsx[c] - (y2 / halfSz - 1);
        let test = dx ** 2 + dy ** 2;
        if (test < dist) {
          best = c;
          dist = test;
        }
      }

      buffer[i1] = best;
    }

    let tmp = lookupTable;
    lookupTable = buffer;
    buffer = tmp;
  }

  // create banks of 4 segments from neighbouring cells in lookup table

  // deduplicate overlapping segments in segment banks

  return { lookupTable, segments };
}

// export function getDistanceToBoundary(arr: number[]) {
//   // get 4 ranges and deduplicate

//   let tmp;

//   tmp = arr[0] < arr[1] ? arr[0] : arr[1];
//   arr[1] = arr[0] < arr[1] ? arr[1] : arr[0];
//   arr[0] = tmp;

//   tmp = arr[2] < arr[3] ? arr[2] : arr[3];
//   arr[3] = arr[2] < arr[3] ? arr[3] : arr[2];
//   arr[2] = tmp;

//   tmp = arr[0] < arr[2] ? arr[0] : arr[2];
//   arr[2] = arr[0] < arr[2] ? arr[2] : arr[0];
//   arr[0] = tmp;

//   tmp = arr[1] < arr[3] ? arr[1] : arr[3];
//   arr[3] = arr[1] < arr[3] ? arr[3] : arr[1];
//   arr[1] = tmp;

//   tmp = arr[1] < arr[2] ? arr[1] : arr[2];
//   arr[2] = arr[1] < arr[2] ? arr[2] : arr[1];
//   arr[1] = tmp;

//   const ranges: number[][] = [];

//   // ranges.sort((a, b) => a[0] - b[0]);

//   const result = [ranges[0]];

//   for (let i = 1; i < ranges.length; i++) {
//     const lastRange = result[result.length - 1];
//     const currentRange = ranges[i];

//     // If the current range overlaps with the last range in the result
//     if (currentRange[0] <= lastRange[1]) {
//       // Update the end of the last range in the result
//       lastRange[1] = max(lastRange[1], currentRange[1]);
//     } else {
//       // Add the current range to the result
//       result.push(currentRange);
//     }
//   }

//   return result;
// }
