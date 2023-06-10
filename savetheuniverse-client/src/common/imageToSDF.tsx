import React, { useEffect, useState } from "react";
import Canvas from "./canvas";

type Mask = {
  width: number;
  height: number;
  data: ArrayLike<number>;
};

type Polyline = {
  x: number[];
  y: number[];
};

// iterator yields [x, y, i] triplets
function* allXY(width: number, height: number) {
  const reg = [0, 0, -1];
  for (let y = 0; y < height; y++) {
    reg[1] = y;
    for (let x = 0; x < width; x++) {
      reg[0] = x;
      reg[2]++;
      yield reg;
    }
  }
}

// iterator yields [tl, tr, bl, br, x, y, i]
function* marchingSquares(width: number, height: number) {
  const reg = [0, 0, 0, 0, 0, 0, -1];
  for (let y = 0; y < height - 1; y++) {
    const yw = y * width;
    reg[0] = yw - 1;
    reg[1] = yw;
    reg[2] = yw + width - 1;
    reg[3] = yw + width;
    reg[5] = y;
    for (let x = 0; x < width - 1; x++) {
      reg[0]++;
      reg[1]++;
      reg[2]++;
      reg[3]++;
      reg[4] = x;
      reg[6]++;
      yield reg;
    }
  }
}

const getCardinalIndicesReg = [0, 0, 0, 0];
// returns indices [t, l, r, b]
function getCardinalIndices(x: number, y: number, width: number) {
  getCardinalIndicesReg[0] = (y - 1) * width + x;
  getCardinalIndicesReg[1] = y * width + x - 1;
  getCardinalIndicesReg[2] = y * width + x + 1;
  getCardinalIndicesReg[3] = (y + 1) * width + x;
  return getCardinalIndicesReg;
}

function uploadMask(callbackFn: (mask: Mask) => void) {
  const fileInput = document.createElement("input");
  fileInput.type = "file";
  fileInput.accept = "image/*";

  fileInput.addEventListener("change", async () => {
    // get pixel data from file input
    const file = fileInput.files![0];
    const img = await createImageBitmap(file);
    const canvas = new OffscreenCanvas(img.width, img.height);
    const ctx = canvas.getContext("2d")!;
    ctx.drawImage(img, 0, 0, img.width, img.height);
    const data = ctx.getImageData(0, 0, img.width, img.height).data;

    // convert pixel data to 1-bit mask using brightness threshold
    const mask = new Uint8Array(img.width * img.height);
    for (let i = 0; i < mask.length; i++) {
      const r = 255 - data[i * 4 + 0];
      const g = 255 - data[i * 4 + 1];
      const b = 255 - data[i * 4 + 2];
      const a = data[i * 4 + 3] / 255;
      mask[i] = +((r + g + b) * a > 128);
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

    callbackFn({
      width: bwidth,
      height: bheight,
      data: bmask,
    });
  });

  fileInput.click();
}

function maskToPolylines(mask: Mask) {
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
    const [t, l, r, b] = getCardinalIndices(x, y, mask.width - 1);

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

  // convert adjacency list to polylines by identifying connected components using DFS
  const polylinesx: number[][] = [];
  const polylinesy: number[][] = [];
  const visited = new Array(adjacencyList.length).fill(false);
  for (let i = 0; i < adjacencyList.length; i++) {
    if (visited[i]) continue;
    if (adjacencyList[i].length === 0) continue;

    const polylinex = [];
    const polyliney = [];

    const stack = [i];
    while (stack.length) {
      const node = stack.pop()!;
      if (visited[node]) continue;

      polylinex.push(coordsx[node]);
      polyliney.push(coordsy[node]);

      visited[node] = true;
      for (let neighbor of adjacencyList[node]) {
        if (visited[neighbor]) continue;
        stack.push(neighbor);
      }
    }
    if (polylinex.length < 12) continue;
    polylinesx.push(polylinex);
    polylinesy.push(polyliney);
  }

  // smooth polyines with moving average
  for (let p = 0; p < polylinesx.length; p++) {
    let polylinex = polylinesx[p];
    let polyliney = polylinesy[p];
    let copyx = polylinex.slice();
    let copyy = polyliney.slice();
    let window = 4;
    let avgx = 0;
    let avgy = 0;
    for (let i = 0; i < window; i++) {
      avgx += copyx[i % polylinex.length];
      avgy += copyy[i % polyliney.length];
    }
    avgx /= window;
    avgy /= window;
    for (let i = 0; i < polylinex.length; i++) {
      polylinex[i] = avgx;
      polyliney[i] = avgy;
      avgx -= copyx[i] / window;
      avgy -= copyy[i] / window;
      avgx += copyx[(i + window) % polylinex.length] / window;
      avgy += copyy[(i + window) % polyliney.length] / window;
    }
  }

  // refine polyline smoothing with spring-based algorithm
  for (let p = 0; p < polylinesx.length; p++) {
    let polylinex = polylinesx[p];
    let polyliney = polylinesy[p];
    let copyx = polylinex.slice();
    let copyy = polyliney.slice();
    let origx = polylinex.slice();
    let origy = polyliney.slice();
    let t = 0.1;
    let ko = 0.1;
    let kn = 1;
    let iters = 1000;
    for (let iter = 0; iter < iters; iter++) {
      for (let ia = 0; ia < polylinex.length; ia++) {
        let io = (ia + 1) % polylinex.length;
        let ib = (ia + 2) % polylinex.length;

        let x = polylinex[io];
        polylinex[io] = copyx[io];
        polylinex[io] -= (x - origx[io]) * ko * t;
        polylinex[io] -= (x - copyx[ia]) * kn * t;
        polylinex[io] -= (x - copyx[ib]) * kn * t;

        let y = polyliney[io];
        polyliney[io] = copyy[io];
        polyliney[io] -= (y - origy[io]) * ko * t;
        polyliney[io] -= (y - copyy[ia]) * kn * t;
        polyliney[io] -= (y - copyy[ib]) * kn * t;
      }
      polylinesx[p] = polylinex;
      polylinesy[p] = polyliney;
      polylinex = copyx;
      polyliney = copyy;
      copyx = polylinesx[p];
      copyy = polylinesy[p];
    }
  }

  // restructure polylines
  const polylines: Polyline[] = [];
  for (let p = 0; p < polylinesx.length; p++) {
    polylines.push({ x: polylinesx[p], y: polylinesy[p] });
  }

  return polylines;
}

function polylinesToBSplineCoeffcients(
  polylinesx: number[][],
  polylinesy: number[][]
) {}

export const ImageToSDFReactBridge = () => {
  const ref = React.useRef<HTMLDivElement>(null);
  const [polylines, setPolylines] = useState<{
    polylinesx: number[][];
    polylinesy: number[][];
  }>({ polylinesx: [], polylinesy: [] });
  const [canvas, setCanvas] = useState<Canvas | null>(null);
  useEffect(() => {
    if (!ref.current) return;
    const canvas = new Canvas(ref.current, 10);
    setCanvas(canvas);
    return () => {
      ref.current!.innerHTML = "";
    };
  }, []);

  return (
    <div>
      For best results, use a 1024 x 1024 pixel image and avoid fine detail
      (features measuring less than 10px across).
      <div ref={ref} className="aspect-video"></div>
      <button
        className="border h-10 my-auto px-2 py-1 bg-slate-200 border-slate-800 cursor-pointer"
        onClick={() => {
          uploadMask((mask) => {
            if (!canvas) return;
            const polylines = maskToPolylines(mask);
            setPolylines(polylines);
            canvas.draw((dst) => {
              for (let [x, y, i] of allXY(canvas.width, canvas.height)) {
                if (x >= mask.width || y >= mask.height) {
                  dst[i * 4 + 0] = 0;
                  dst[i * 4 + 1] = 0;
                  dst[i * 4 + 2] = 0;
                  dst[i * 4 + 3] = 255;
                } else {
                  let j = y * mask.width + x;
                  dst[i * 4 + 0] = mask.data[j] ? 0 : 255;
                  dst[i * 4 + 1] = mask.data[j] ? 0 : 255;
                  dst[i * 4 + 2] = mask.data[j] ? 0 : 255;
                  dst[i * 4 + 3] = 255;
                }
              }
            });
          });
          // ref.current.getContext("2d").drawImage(ref.current, 0, 0);
        }}
      >
        Upload Image
      </button>
      <svg width={1040} height={1040} viewBox={`0 0 ${1040} ${640}`}>
        {polylines.polylinesx.map((polylinex, i) => {
          let polyliney = polylines.polylinesy[i];
          let path = "";
          for (let i = 0; i <= polylinex.length; i++) {
            const instruction = i === 0 ? "M" : "L"; // move or line
            const x = polylinex[i % polylinex.length];
            const y = polyliney[i % polyliney.length];
            path += `${instruction}${x},${y}`;
          }

          return (
            <path
              key={i}
              fill="none"
              stroke="blue"
              strokeWidth="2"
              d={path}
            ></path>
          );
        })}
      </svg>
    </div>
  );
};
