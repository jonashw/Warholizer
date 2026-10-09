import { DotShape } from "./types";

// Amplitude-modulated (AM) halftone screen, as in print and Photoshop: a rotated grid of cells,
// one dot per cell, dot area proportional to the darkness averaged over the cell, with
// anti-aliased edges. Shared by the CPU reference and the WebGL2 kernel.

export type HalftoneScreen = {
  /** Screen cell size (dot pitch), in input pixels. */
  cell: number,
  /** Screen angle, degrees. */
  angle: number,
  shape: DotShape,
  /** Dots represent light instead of dark: white dots on black. */
  invert: boolean,
  /** Output pixels per input pixel; dots are computed analytically, so upscaling stays crisp. */
  scale: number
};

export const dotShapes: DotShape[] = ['round', 'ellipse', 'line', 'diamond'];
export const dotShapeIndex = (shape: DotShape) => Math.max(0, dotShapes.indexOf(shape));

/**
 * Spot function: for a position (x, y) in [-1, 1]² within a cell, a value in [0, 1]; positions
 * with lower values are inked first as darkness increases. Kept in sync with the shader.
 */
export const spot = (shape: DotShape, x: number, y: number): number => {
  switch (shape) {
    case 'ellipse': return (x * x + 1.7 * y * y) / 2.7;
    case 'line': return Math.abs(y);
    case 'diamond': return (Math.abs(x) + Math.abs(y)) / 2;
    case 'round':
    default: return (x * x + y * y) / 2;
  }
};

export const toneTableSize = 65;

/**
 * Spot value thresholds by coverage: inking positions with spot value below `table[i]` covers
 * i / (size - 1) of the cell. Makes printed coverage match darkness for every shape (round dots
 * grow past touching into the corners, so their area is not proportional to the raw spot value).
 */
const toneTables = new Map<DotShape, Float32Array>();
export const toneTable = (shape: DotShape): Float32Array => {
  let table = toneTables.get(shape);
  if (!table) {
    const n = 256;
    const values = new Float32Array(n * n);
    for (let j = 0; j < n; j++) {
      for (let i = 0; i < n; i++) {
        values[j * n + i] = spot(shape, ((i + 0.5) / n) * 2 - 1, ((j + 0.5) / n) * 2 - 1);
      }
    }
    values.sort();
    table = Float32Array.from({ length: toneTableSize }, (_, k) =>
      k === 0 ? -1 : k === toneTableSize - 1 ? 2 : values[Math.round((k / (toneTableSize - 1)) * (values.length - 1))]);
    toneTables.set(shape, table);
  }
  return table;
};

/** The spot threshold for darkness d in [0, 1]. */
export const thresholdFor = (table: Float32Array, d: number) => {
  const t = Math.min(1, Math.max(0, d)) * (table.length - 1);
  const i = Math.min(table.length - 2, Math.floor(t));
  return table[i] + (table[i + 1] - table[i]) * (t - i);
};

/** Samples per cell side when averaging a cell's tone (a 4 × 4 grid, clamped to the image edges). */
export const cellSamples = 4;

/** CPU reference: renders the screen over the input (transparent counts as white). */
export const renderHalftone = (blurred: OffscreenCanvas, screen: HalftoneScreen): OffscreenCanvas => {
  const { width: w, height: h } = blurred;
  const W = Math.max(1, Math.round(w * screen.scale)), H = Math.max(1, Math.round(h * screen.scale));
  const out = new OffscreenCanvas(W, H);
  if (w === 0 || h === 0) {
    return out;
  }
  const src = blurred.getContext('2d')!.getImageData(0, 0, w, h).data;
  // Darkness per input pixel, transparent as white.
  const dark = new Float32Array(w * h);
  for (let p = 0; p < w * h; p++) {
    const a = src[p * 4 + 3] / 255;
    const lum = 0.21 * src[p * 4] + 0.72 * src[p * 4 + 1] + 0.07 * src[p * 4 + 2];
    dark[p] = 1 - (lum * a + 255 * (1 - a)) / 255;
  }
  // Bilinear sample with pixel centers at +0.5, clamped to edges (like texture LINEAR + CLAMP).
  const darknessAt = (x: number, y: number) => {
    const fx = Math.min(w - 1, Math.max(0, x - 0.5)), fy = Math.min(h - 1, Math.max(0, y - 0.5));
    const x0 = Math.floor(fx), y0 = Math.floor(fy), x1 = Math.min(w - 1, x0 + 1), y1 = Math.min(h - 1, y0 + 1);
    const tx = fx - x0, ty = fy - y0;
    const top = dark[y0 * w + x0] * (1 - tx) + dark[y0 * w + x1] * tx;
    const bottom = dark[y1 * w + x0] * (1 - tx) + dark[y1 * w + x1] * tx;
    return top * (1 - ty) + bottom * ty;
  };
  const table = toneTable(screen.shape);
  const rad = screen.angle * Math.PI / 180, cos = Math.cos(rad), sin = Math.sin(rad);
  const { cell, scale } = screen;
  // Spot value and the cell's threshold at an output position (in output pixels).
  const sample = (X: number, Y: number): [number, number] => {
    const px = X / scale, py = Y / scale;
    const qx = cos * px + sin * py, qy = -sin * px + cos * py;
    const ku = Math.floor(qx / cell), kv = Math.floor(qy / cell);
    const fu = (qx / cell - ku - 0.5) * 2, fv = (qy / cell - kv - 0.5) * 2;
    // Mean darkness over the cell: a grid of samples in screen space, rotated back to the image.
    let d = 0;
    for (let j = 0; j < cellSamples; j++) {
      for (let i = 0; i < cellSamples; i++) {
        const cqx = (ku + (i + 0.5) / cellSamples) * cell, cqy = (kv + (j + 0.5) / cellSamples) * cell;
        d += darknessAt(cos * cqx - sin * cqy, sin * cqx + cos * cqy);
      }
    }
    d /= cellSamples * cellSamples;
    if (screen.invert) {
      d = 1 - d;
    }
    return [spot(screen.shape, fu, fv), thresholdFor(table, d)];
  };
  const img = new ImageData(W, H);
  const o = img.data;
  const [ink, paper] = screen.invert ? [255, 0] : [0, 255];
  for (let Y = 0; Y < H; Y++) {
    for (let X = 0; X < W; X++) {
      const [v, t] = sample(X + 0.5, Y + 0.5);
      // Screen-space derivative estimate (like fwidth) for one-pixel anti-aliasing.
      const fw = Math.abs(spot(screen.shape, ...unitPosition(X + 1.5, Y + 0.5)) - v) + Math.abs(spot(screen.shape, ...unitPosition(X + 0.5, Y + 1.5)) - v);
      const coverage = Math.min(1, Math.max(0, (t - v) / Math.max(fw, 1e-4) + 0.5));
      const c = Math.round(paper + (ink - paper) * coverage);
      const i = (Y * W + X) * 4;
      o[i] = o[i + 1] = o[i + 2] = c;
      o[i + 3] = 255;
    }
  }
  out.getContext('2d')!.putImageData(img, 0, 0);
  return out;

  function unitPosition(X: number, Y: number): [number, number] {
    const px = X / scale, py = Y / scale;
    const qx = cos * px + sin * py, qy = -sin * px + cos * py;
    return [(qx / cell - Math.floor(qx / cell) - 0.5) * 2, (qy / cell - Math.floor(qy / cell) - 0.5) * 2];
  }
};
