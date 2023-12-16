const { min } = Math;

// iterator yields [x, y, i] triplets
export function* allXY(width: number, height: number) {
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
export function* marchingSquares(width: number, height: number) {
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
export function getCardinalIndices(x: number, y: number, width: number) {
  getCardinalIndicesReg[0] = (y - 1) * width + x;
  getCardinalIndicesReg[1] = y * width + x - 1;
  getCardinalIndicesReg[2] = y * width + x + 1;
  getCardinalIndicesReg[3] = (y + 1) * width + x;
  return getCardinalIndicesReg;
}

type Box = { top: number; left: number; width: number; height: number };

// returns transform matrix [scale, xbias, ybias], that when applied to
// inside will center inside box within outside, and stretch to fit
export function fitInside(outside: Box, inside: Box, invert = false) {
  let xratio = outside.width / inside.width;
  let yratio = outside.height / inside.height;
  let scale = min(xratio, yratio);
  let xb: number;
  let yb: number;
  if (invert) {
    scale = 1 / scale;
    if (xratio > yratio) {
      let padding = (inside.width - outside.width * scale) / 2;
      xb = inside.left - outside.left * scale + padding;
      yb = inside.top - outside.top * scale;
    } else {
      let padding = (inside.height - outside.height * scale) / 2;
      xb = inside.left - outside.left * scale;
      yb = inside.top - outside.top * scale + padding;
    }
  } else {
    if (xratio > yratio) {
      let padding = (outside.width - inside.width * scale) / 2;
      xb = inside.left - inside.left * scale + padding;
      yb = inside.top - inside.top * scale;
    } else {
      let padding = (outside.height - inside.height * scale) / 2;
      xb = inside.left - inside.left * scale;
      yb = inside.top - inside.top * scale + padding;
    }
  }
  return [scale, xb, yb];
}
