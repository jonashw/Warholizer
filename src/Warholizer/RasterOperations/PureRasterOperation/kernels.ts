import { Byte } from "../../../NumberTypes";
import { Noise } from "./types";
import { RGB } from "./palette";

/**
 * The per-pixel steps of operations. Everything else in `apply` is composition that the browser
 * already accelerates; these are the loops worth porting (GPU, WASM). Kernels never mutate inputs.
 */
export type PixelKernels = {
  name: string,
  /** Black or white per pixel by luminance (alpha-weighted); output is opaque. */
  threshold: (input: OffscreenCanvas, value: Byte) => Promise<OffscreenCanvas>,
  /** Random noise composited over the input at `op.amount` percent opacity. */
  noise: (input: OffscreenCanvas, op: Noise) => Promise<OffscreenCanvas>,
  /** One image per channel (red, green, blue), each on white, keeping the input's alpha. */
  rgbChannels: (input: OffscreenCanvas) => Promise<OffscreenCanvas[]>,
  /**
   * Maps each pixel to its nearest `match` color and paints it with the corresponding `paint` color,
   * keeping alpha. With `only`, pixels matching other colors become transparent.
   */
  mapToPalette: (input: OffscreenCanvas, match: RGB[], paint: RGB[], only?: number) => Promise<OffscreenCanvas>,
  /** Per channel: `((v - black) / (white - black))` clamped, raised to `1 / gamma`. */
  levels: (input: OffscreenCanvas, black: number, white: number, gamma: number) => Promise<OffscreenCanvas>,
  /** Luminance mapped through evenly spaced color stops, dark to light; alpha kept. */
  gradientMap: (input: OffscreenCanvas, stops: RGB[]) => Promise<OffscreenCanvas>,
  /** Each channel reduced to `levels` evenly spaced values. */
  posterize: (input: OffscreenCanvas, levels: number) => Promise<OffscreenCanvas>,
  /** Bayer ordered dithering to `levels` per channel (or gray when `monochrome`), in cells of `pixelSize`. */
  orderedDither: (input: OffscreenCanvas, matrixSize: number, levels: number, monochrome: boolean, pixelSize: number) => Promise<OffscreenCanvas>,
  /** Sobel edge magnitude of alpha-weighted luminance as dark lines on white (or `invert`); `threshold` > 0 makes lines binary. */
  edges: (input: OffscreenCanvas, strength: number, threshold: number, invert: boolean) => Promise<OffscreenCanvas>,
  /** Alpha multiplied by how far each color is from `key` (RGB distance): 0 within `tolerance`, ramping to 1 over `softness`. */
  colorKey: (input: OffscreenCanvas, key: RGB, tolerance: number, softness: number) => Promise<OffscreenCanvas>,
  /** Cyan, magenta, yellow, black: as ink on white (`ink`), or as gray darkness maps (`amount`). */
  cmykChannels: (input: OffscreenCanvas, mode: 'ink' | 'amount') => Promise<OffscreenCanvas[]>,
};

/** Bayer threshold matrix of size n (a power of two), row-major, values 0..n²-1. */
export const bayerMatrix = (n: number): number[] => {
  if (n <= 1) {
    return [0];
  }
  const h = n / 2;
  const half = bayerMatrix(h);
  const offsets = [0, 2, 3, 1]; // M(2n) = [[4M, 4M+2], [4M+3, 4M+1]]
  return Array.from({ length: n * n }, (_, i) => {
    const x = i % n, y = Math.floor(i / n);
    return 4 * half[(y % h) * h + (x % h)] + offsets[(y >= h ? 2 : 0) + (x >= h ? 1 : 0)];
  });
};

const lum = (r: number, g: number, b: number) => 0.21 * r + 0.72 * g + 0.07 * b;

/** Shared math so the CPU reference and shaders agree. */
export const pixelMath = {
  gradient: (stops: RGB[], v: number): RGB => {
    if (stops.length === 1) {
      return stops[0];
    }
    const t = Math.min(1, Math.max(0, v / 255)) * (stops.length - 1);
    const i = Math.min(stops.length - 2, Math.floor(t));
    const f = t - i;
    return [0, 1, 2].map(c => Math.round(stops[i][c] + (stops[i + 1][c] - stops[i][c]) * f)) as RGB;
  },
  posterize: (v: number, levels: number) =>
    Math.round(Math.round(v / 255 * (levels - 1)) / (levels - 1) * 255),
  dither: (v: number, t: number, levels: number) =>
    Math.round(Math.min(levels - 1, Math.floor(v / 255 * (levels - 1) + t)) / (levels - 1) * 255),
  keyFactor: (distance: number, tolerance: number, softness: number) =>
    softness <= 0 ? (distance > tolerance ? 1 : 0) : Math.min(1, Math.max(0, (distance - tolerance) / softness)),
  cmyk: (r: number, g: number, b: number): [number, number, number, number] => {
    const [c, m, y] = [1 - r / 255, 1 - g / 255, 1 - b / 255];
    const k = Math.min(c, m, y);
    return k >= 1 ? [0, 0, 0, 1] : [(c - k) / (1 - k), (m - k) / (1 - k), (y - k) / (1 - k), k];
  },
};

export const inks: RGB[] = [[0, 255, 255], [255, 0, 255], [255, 255, 0], [0, 0, 0]];

const nearestIndex = (palette: RGB[], r: number, g: number, b: number) => {
  let best = 0, bestDistance = Infinity;
  for (let i = 0; i < palette.length; i++) {
    const [pr, pg, pb] = palette[i];
    const d = (r - pr) ** 2 + (g - pg) ** 2 + (b - pb) ** 2;
    if (d < bestDistance) {
      bestDistance = d;
      best = i;
    }
  }
  return best;
};

/** The levels transfer function on 0..255 values; shared so CPU and GPU agree on edge cases. */
export const levelsCurve = (v: number, black: number, white: number, gamma: number) => {
  const t = Math.min(1, Math.max(0, (v - black) / Math.max(1, white - black)));
  return Math.round(255 * Math.pow(t, 1 / Math.max(0.01, gamma)));
};

const canvasFrom = (data: ImageData): OffscreenCanvas => {
  const c = new OffscreenCanvas(data.width, data.height);
  c.getContext('2d')!.putImageData(data, 0, 0);
  return c;
};

const readPixels = (input: OffscreenCanvas): ImageData =>
  input.getContext('2d')!.getImageData(0, 0, input.width, input.height);

function rgbaValue(r: number, g: number, b: number, a: number) {
  //reference: https://computergraphics.stackexchange.com/a/5114
  //const [rPeakWavelength,gPeakWavelength,bPeakWavelength]=[600,540,450];
  const [rCoeff,gCoeff,bCoeff]=[0.21,0.72,0.07];
  return Math.floor((a/255) * ((r * rCoeff) + (g * gCoeff) + (b * bCoeff)));
}

const isEmpty = (c: OffscreenCanvas) => c.width === 0 || c.height === 0;

const copy = (input: OffscreenCanvas) => {
  const c = new OffscreenCanvas(input.width, input.height);
  if (!isEmpty(input)) {
    c.getContext('2d')!.drawImage(input, 0, 0);
  }
  return c;
};

/** Reference kernels: JavaScript loops over ImageData. Zero-area inputs yield zero-area outputs. */
export const cpuKernels: PixelKernels = {
  name: 'cpu',

  threshold: async (input, value) => {
    if (isEmpty(input)) {
      return new OffscreenCanvas(input.width, input.height);
    }
    const imgData = readPixels(input);
    for (let i=0; i<imgData.data.length; i+=4) { // 4 is for RGBA channels
      const currentPixelValue = rgbaValue(
        imgData.data[i+0],
        imgData.data[i+1],
        imgData.data[i+2],
        imgData.data[i+3]);
      const thresholdValue = currentPixelValue < value ? 0 : 255;
      imgData.data[i+0] = thresholdValue;//R
      imgData.data[i+1] = thresholdValue;//G
      imgData.data[i+2] = thresholdValue;//B
      imgData.data[i+3] = 255;//A
    }
    return canvasFrom(imgData);
  },

  noise: async (input, op) => {
    if (isEmpty(input)) {
      return new OffscreenCanvas(input.width, input.height);
    }
    const outputData = new ImageData(input.width, input.height);
    const randomByte = () => Math.floor(Math.random() * 255);
    for (let i = 0; i < outputData.data.length; i += 4) { // 4 is for RGBA channels
      if(op.monochromatic){
        const rand = randomByte();
        outputData.data[i + 0] = rand;
        outputData.data[i + 1] = rand;
        outputData.data[i + 2] = rand;
      } else {
        outputData.data[i + 0] = randomByte();
        outputData.data[i + 1] = randomByte();
        outputData.data[i + 2] = randomByte();
      }
      outputData.data[i + 3] = 255;
    }
    const noiseImg = canvasFrom(outputData);
    const c = new OffscreenCanvas(input.width, input.height);
    const ctx = c.getContext('2d')!;
    ctx.drawImage(input,0,0);
    ctx.globalAlpha = op.amount / 100;
    ctx.drawImage(noiseImg,0,0);
    return c;
  },

  rgbChannels: async (input) => {
    if (isEmpty(input)) {
      return [0, 1, 2].map(() => new OffscreenCanvas(input.width, input.height));
    }
    const inputData = readPixels(input);
    const empty = 255;
    const channels = [0, 1, 2].map(() => new ImageData(input.width, input.height));
    for (let i = 0; i < inputData.data.length; i += 4) { // 4 is for RGBA channels
      const a = inputData.data[i+3];
      channels.forEach((out, channel) => {
        for (let j = 0; j < 3; j++) {
          out.data[i+j] = j === channel ? inputData.data[i+j] : empty;
        }
        out.data[i+3] = a;
      });
    }
    return channels.map(canvasFrom);
  },

  mapToPalette: async (input, match, paint, only) => {
    if (isEmpty(input) || match.length === 0) {
      return copy(input);
    }
    const imgData = readPixels(input);
    const d = imgData.data;
    for (let i = 0; i < d.length; i += 4) {
      const index = nearestIndex(match, d[i], d[i + 1], d[i + 2]);
      if (only !== undefined && index !== only) {
        d[i] = d[i + 1] = d[i + 2] = d[i + 3] = 0;
        continue;
      }
      [d[i], d[i + 1], d[i + 2]] = paint[index];
    }
    return canvasFrom(imgData);
  },

  levels: async (input, black, white, gamma) => {
    if (isEmpty(input)) {
      return copy(input);
    }
    const curve = Array.from({ length: 256 }, (_, v) => levelsCurve(v, black, white, gamma));
    const imgData = readPixels(input);
    const d = imgData.data;
    for (let i = 0; i < d.length; i += 4) {
      d[i] = curve[d[i]];
      d[i + 1] = curve[d[i + 1]];
      d[i + 2] = curve[d[i + 2]];
    }
    return canvasFrom(imgData);
  },

  gradientMap: async (input, stops) => {
    if (isEmpty(input) || stops.length === 0) {
      return copy(input);
    }
    const imgData = readPixels(input);
    const d = imgData.data;
    for (let i = 0; i < d.length; i += 4) {
      [d[i], d[i + 1], d[i + 2]] = pixelMath.gradient(stops, lum(d[i], d[i + 1], d[i + 2]));
    }
    return canvasFrom(imgData);
  },

  posterize: async (input, levels) => {
    if (isEmpty(input)) {
      return copy(input);
    }
    const curve = Array.from({ length: 256 }, (_, v) => pixelMath.posterize(v, levels));
    const imgData = readPixels(input);
    const d = imgData.data;
    for (let i = 0; i < d.length; i += 4) {
      d[i] = curve[d[i]]; d[i + 1] = curve[d[i + 1]]; d[i + 2] = curve[d[i + 2]];
    }
    return canvasFrom(imgData);
  },

  orderedDither: async (input, matrixSize, levels, monochrome, pixelSize) => {
    if (isEmpty(input)) {
      return copy(input);
    }
    const m = bayerMatrix(matrixSize);
    const imgData = readPixels(input);
    const d = imgData.data;
    const w = input.width;
    for (let i = 0; i < d.length; i += 4) {
      const p = i / 4, x = Math.floor((p % w) / pixelSize), y = Math.floor(Math.floor(p / w) / pixelSize);
      const t = (m[(y % matrixSize) * matrixSize + (x % matrixSize)] + 0.5) / (matrixSize * matrixSize);
      if (monochrome) {
        d[i] = d[i + 1] = d[i + 2] = pixelMath.dither(lum(d[i], d[i + 1], d[i + 2]), t, levels);
      } else {
        for (let c = 0; c < 3; c++) {
          d[i + c] = pixelMath.dither(d[i + c], t, levels);
        }
      }
    }
    return canvasFrom(imgData);
  },

  edges: async (input, strength, threshold, invert) => {
    if (isEmpty(input)) {
      return copy(input);
    }
    const { width: w, height: h } = input;
    const src = readPixels(input).data;
    const l = new Float32Array(w * h);
    for (let p = 0; p < w * h; p++) {
      l[p] = lum(src[p * 4], src[p * 4 + 1], src[p * 4 + 2]) * src[p * 4 + 3] / 255;
    }
    const at = (x: number, y: number) => l[Math.min(h - 1, Math.max(0, y)) * w + Math.min(w - 1, Math.max(0, x))];
    const out = new ImageData(w, h);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const gx = at(x + 1, y - 1) + 2 * at(x + 1, y) + at(x + 1, y + 1) - at(x - 1, y - 1) - 2 * at(x - 1, y) - at(x - 1, y + 1);
        const gy = at(x - 1, y + 1) + 2 * at(x, y + 1) + at(x + 1, y + 1) - at(x - 1, y - 1) - 2 * at(x, y - 1) - at(x + 1, y - 1);
        let line = Math.min(1, Math.sqrt(gx * gx + gy * gy) / (4 * 255) * strength);
        if (threshold > 0) {
          line = line * 255 >= threshold ? 1 : 0;
        }
        const v = Math.round(255 * (invert ? line : 1 - line));
        const i = (y * w + x) * 4;
        out.data[i] = out.data[i + 1] = out.data[i + 2] = v;
        out.data[i + 3] = 255;
      }
    }
    return canvasFrom(out);
  },

  colorKey: async (input, key, tolerance, softness) => {
    if (isEmpty(input)) {
      return copy(input);
    }
    const imgData = readPixels(input);
    const d = imgData.data;
    for (let i = 0; i < d.length; i += 4) {
      const dist = Math.hypot(d[i] - key[0], d[i + 1] - key[1], d[i + 2] - key[2]);
      d[i + 3] = Math.round(d[i + 3] * pixelMath.keyFactor(dist, tolerance, softness));
    }
    return canvasFrom(imgData);
  },

  cmykChannels: async (input, mode) => {
    if (isEmpty(input)) {
      return [0, 1, 2, 3].map(() => new OffscreenCanvas(input.width, input.height));
    }
    const src = readPixels(input).data;
    const layers = [0, 1, 2, 3].map(() => new ImageData(input.width, input.height));
    for (let i = 0; i < src.length; i += 4) {
      const amounts = pixelMath.cmyk(src[i], src[i + 1], src[i + 2]);
      layers.forEach((layer, k) => {
        const t = amounts[k];
        for (let c = 0; c < 3; c++) {
          layer.data[i + c] = mode === 'ink'
            ? Math.round(255 - t * (255 - inks[k][c]))
            : Math.round(255 * (1 - t));
        }
        layer.data[i + 3] = src[i + 3];
      });
    }
    return layers.map(canvasFrom);
  },
};
