import { RGB } from "./palette";
import { pixelMath } from "./kernels";
import { DiffusionMethod } from "./types";

// CPU algorithms where each output depends on earlier results (error diffusion, distance
// transforms, flood fills). They do not map to per-pixel shaders, so operations using them
// run in workers (execution hint 'worker') to keep the page responsive.

const readPixels = (c: OffscreenCanvas) => c.getContext('2d')!.getImageData(0, 0, c.width, c.height);
const canvasFrom = (data: ImageData) => {
  const c = new OffscreenCanvas(data.width, data.height);
  c.getContext('2d')!.putImageData(data, 0, 0);
  return c;
};
const lum = (r: number, g: number, b: number) => 0.21 * r + 0.72 * g + 0.07 * b;


/** [dx, dy, weight] neighbors receiving the quantization error. */
const diffusion: Record<DiffusionMethod, [number, number, number][]> = {
  'floyd-steinberg': [[1, 0, 7 / 16], [-1, 1, 3 / 16], [0, 1, 5 / 16], [1, 1, 1 / 16]],
  // Atkinson spreads only 6/8 of the error, which keeps highlights and shadows clean.
  'atkinson': [[1, 0, 1 / 8], [2, 0, 1 / 8], [-1, 1, 1 / 8], [0, 1, 1 / 8], [1, 1, 1 / 8], [0, 2, 1 / 8]],
};

/** Error-diffusion dithering to `levels` per channel (or gray when `monochrome`); alpha kept. */
export const errorDiffusion = (input: OffscreenCanvas, method: DiffusionMethod, levels: number, monochrome: boolean): OffscreenCanvas => {
  const out = new OffscreenCanvas(input.width, input.height);
  if (input.width === 0 || input.height === 0) {
    return out;
  }
  const { width: w, height: h } = input;
  const img = readPixels(input);
  const d = img.data;
  const channels = monochrome ? 1 : 3;
  const buffers = Array.from({ length: channels }, (_, c) => {
    const b = new Float32Array(w * h);
    for (let p = 0; p < w * h; p++) {
      b[p] = monochrome ? lum(d[p * 4], d[p * 4 + 1], d[p * 4 + 2]) : d[p * 4 + c];
    }
    return b;
  });
  // Flat typed arrays and precomputed offsets: this loop is the hot path.
  const kernel = diffusion[method];
  const kn = kernel.length;
  const kdx = Int32Array.from(kernel, k => k[0]);
  const kdy = Int32Array.from(kernel, k => k[1]);
  const koff = Int32Array.from(kernel, k => k[1] * w + k[0]);
  const kw = Float32Array.from(kernel, k => k[2]);
  const step = 255 / (levels - 1);
  const invStep = 1 / step;
  for (const b of buffers) {
    for (let y = 0, p = 0; y < h; y++) {
      for (let x = 0; x < w; x++, p++) {
        const old = b[p];
        let q = Math.round(old * invStep) * step;
        q = q < 0 ? 0 : q > 255 ? 255 : q;
        b[p] = q;
        const err = old - q;
        if (err === 0) {
          continue;
        }
        for (let k = 0; k < kn; k++) {
          const nx = x + kdx[k];
          if (nx >= 0 && nx < w && y + kdy[k] < h) {
            b[p + koff[k]] += err * kw[k];
          }
        }
      }
    }
  }
  for (let p = 0; p < w * h; p++) {
    for (let c = 0; c < 3; c++) {
      d[p * 4 + c] = Math.round(buffers[monochrome ? 0 : c][p]);
    }
  }
  return canvasFrom(img);
};

/** Exact squared Euclidean distance transform of a 1D function (Felzenszwalb and Huttenlocher). */
const edt1d = (f: Float64Array, n: number, d: Float64Array, v: Int32Array, z: Float64Array) => {
  let k = 0;
  v[0] = 0; z[0] = -Infinity; z[1] = Infinity;
  for (let q = 1; q < n; q++) {
    let s = ((f[q] + q * q) - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]);
    while (s <= z[k]) {
      k--;
      s = ((f[q] + q * q) - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]);
    }
    k++;
    v[k] = q; z[k] = s; z[k + 1] = Infinity;
  }
  k = 0;
  for (let q = 0; q < n; q++) {
    while (z[k + 1] < q) k++;
    d[q] = (q - v[k]) * (q - v[k]) + f[v[k]];
  }
};

/** Euclidean distance from each pixel to the nearest pixel where `inside` is set. */
export const distanceTransform = (inside: Uint8Array, w: number, h: number): Float32Array => {
  const INF = 1e20;
  const grid = new Float64Array(w * h);
  for (let i = 0; i < w * h; i++) grid[i] = inside[i] ? 0 : INF;
  const n = Math.max(w, h);
  const f = new Float64Array(n), d = new Float64Array(n), v = new Int32Array(n), z = new Float64Array(n + 1);
  for (let x = 0; x < w; x++) {
    for (let y = 0; y < h; y++) f[y] = grid[y * w + x];
    edt1d(f, h, d, v, z);
    for (let y = 0; y < h; y++) grid[y * w + x] = d[y];
  }
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) f[x] = grid[y * w + x];
    edt1d(f, w, d, v, z);
    for (let x = 0; x < w; x++) grid[y * w + x] = d[x];
  }
  const out = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) out[i] = Math.sqrt(grid[i]);
  return out;
};

/**
 * Die-cut sticker look: a solid border of `width` px around the image's opaque shape (alpha >= 128),
 * with antialiased rounded edges, optionally a thin cut line at its outer edge. The canvas grows by
 * the border on every side so nothing is clipped.
 */
export const stickerBorder = (input: OffscreenCanvas, width: number, color: RGB, cutLine: boolean): OffscreenCanvas => {
  const pad = Math.ceil(width) + (cutLine ? 2 : 1);
  const w = input.width + 2 * pad, h = input.height + 2 * pad;
  const out = new OffscreenCanvas(w, h);
  if (input.width === 0 || input.height === 0) {
    return out;
  }
  const src = readPixels(input).data;
  const inside = new Uint8Array(w * h);
  for (let y = 0; y < input.height; y++) {
    for (let x = 0; x < input.width; x++) {
      inside[(y + pad) * w + (x + pad)] = src[(y * input.width + x) * 4 + 3] >= 128 ? 1 : 0;
    }
  }
  const dist = distanceTransform(inside, w, h);
  const border = new ImageData(w, h);
  const bd = border.data;
  const [cr, cg, cb] = color;
  for (let i = 0, j = 0; i < w * h; i++, j += 4) {
    const di = dist[i];
    if (di > width + 1) {
      continue; // transparent; ImageData starts zeroed
    }
    if (cutLine && Math.abs(di - width) < 0.75) {
      bd[j] = 40; bd[j + 1] = 40; bd[j + 2] = 40; bd[j + 3] = 255;
      continue;
    }
    const a = width - di + 0.5;
    bd[j] = cr; bd[j + 1] = cg; bd[j + 2] = cb;
    bd[j + 3] = a >= 1 ? 255 : a <= 0 ? 0 : Math.round(255 * a);
  }
  const ctx = out.getContext('2d')!;
  ctx.putImageData(border, 0, 0);
  ctx.drawImage(input, pad, pad);
  return out;
};

/** Average color of the image's outermost pixels: a good guess for a background to key out. */
export const borderColor = (input: OffscreenCanvas): RGB => {
  const { width: w, height: h } = input;
  const d = readPixels(input).data;
  const sum = [0, 0, 0];
  let n = 0;
  const add = (x: number, y: number) => {
    const i = (y * w + x) * 4;
    sum[0] += d[i]; sum[1] += d[i + 1]; sum[2] += d[i + 2]; n++;
  };
  for (let x = 0; x < w; x++) { add(x, 0); add(x, h - 1); }
  for (let y = 1; y < h - 1; y++) { add(0, y); add(w - 1, y); }
  return n === 0 ? [255, 255, 255] : sum.map(s => Math.round(s / n)) as RGB;
};

/**
 * Like the colorKey kernel, but only removes key-colored regions connected to the image's edges
 * (flood fill), so matching colors inside the subject survive.
 */
export const connectedColorKey = (input: OffscreenCanvas, key: RGB, tolerance: number, softness: number): OffscreenCanvas => {
  const { width: w, height: h } = input;
  if (w === 0 || h === 0) {
    return new OffscreenCanvas(w, h);
  }
  const img = readPixels(input);
  const d = img.data;
  const factor = new Float32Array(w * h);
  const [kr, kg, kb] = key;
  for (let p = 0, j = 0; p < w * h; p++, j += 4) {
    const dr = d[j] - kr, dg = d[j + 1] - kg, db = d[j + 2] - kb;
    factor[p] = pixelMath.keyFactor(Math.sqrt(dr * dr + dg * dg + db * db), tolerance, softness);
  }
  const visited = new Uint8Array(w * h);
  // Each pixel is pushed at most once, so a fixed-size typed stack suffices.
  const stack = new Int32Array(w * h);
  let top = 0;
  const push = (p: number) => {
    if (!visited[p] && factor[p] < 1) {
      visited[p] = 1;
      stack[top++] = p;
    }
  };
  for (let x = 0; x < w; x++) { push(x); push((h - 1) * w + x); }
  for (let y = 0; y < h; y++) { push(y * w); push(y * w + w - 1); }
  while (top > 0) {
    const p = stack[--top];
    const x = p % w, y = (p - x) / w;
    if (x > 0) push(p - 1);
    if (x < w - 1) push(p + 1);
    if (y > 0) push(p - w);
    if (y < h - 1) push(p + w);
  }
  for (let p = 0; p < w * h; p++) {
    if (visited[p]) {
      d[p * 4 + 3] = Math.round(d[p * 4 + 3] * factor[p]);
    }
  }
  return canvasFrom(img);
};
