/**
 * Construct a distance field using Constructive Structural Geometry (CSG),
 * Circles are the only supported primitive. Support for other primitives can
 * be added by following this guide: https://iquilezles.org/articles/distfunctions2d.
 *
 * We compile the code at runtime to improve performance through optimisations
 * such as loop unrolling.
 */

export enum ShapeType {
  SOLID,
  HOLE,
}

const distance = (cx: number, cy: number, r: number) =>
  `(((x - ${cx}) ** 2 + (y - ${cy}) ** 2) ** 0.5 - ${r})`;
const union = (distances: string[], k: number) => {
  if (distances.length === 0) return "";
  if (distances.length === 1) return distances[0];
  const d = distances.map((d) => `2 ** (-${d} / ${k})`).join(" + ");
  return `(-log2(${d}) * ${k})`;
};
const subtraction = (a: string, b: string, k: number) => {
  if (!a && !b) return "";
  if (!b) return a;
  if (!a) return "-" + b;
  return `log2(2 ** (${a} / ${k}) + 2 ** (-${b} / ${k}))`;
};

export function distanceFunctionFactory(
  shapes: { type: ShapeType; params: number[] }[],
  smoothness: number
) {
  const solid: number[][] = [];
  const hole: number[][] = [];
  for (const shape of shapes) {
    if (shape.type === ShapeType.SOLID) solid.push(shape.params);
    if (shape.type === ShapeType.HOLE) hole.push(shape.params);
  }
  return new Function(
    "x",
    "y",
    "const log2 = Math.log2; return " +
      subtraction(
        union(
          solid.map(([cx, cy, r]) => distance(cx, cy, r)),
          smoothness
        ),
        union(
          hole.map(([cx, cy, r]) => distance(cx, cy, r)),
          smoothness
        ),
        smoothness
      ) || "0"
  ) as (x: number, y: number) => number;
}

// Using Monte Carlo method, estimate area contained by surface defined by |sdf(x, y)| = 0
export function estimateArea(
  sdf: (x: number, y: number) => number,
  samples = 100_000
) {
  let inside = 0;
  for (let i = 0; i < samples; i++) {
    let x = Math.random() * 2 - 1;
    let y = Math.random() * 2 - 1;
    if (sdf(x, y) < 0) inside++;
  }
  return 4 * (inside / samples);
}

// Generate samples within the surface defined by |sdf(x, y)| = 0
export function sampleInside(
  sdf: (x: number, y: number) => number,
  samples: number,
  distanceBuffer: number,
  callback: (x: number, y: number, i: number) => void
) {
  let i = 0;
  while (i < samples) {
    let x = Math.random() * 2 - 1;
    let y = Math.random() * 2 - 1;
    if (sdf(x, y) < -distanceBuffer) {
      i++;
      callback(x, y, i);
    }
  }
}
