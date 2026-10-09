import { levelsCurve } from "./kernels";
import { Tone, ToneReference } from "./types";

/**
 * Tone (ADR 0003): which tone curve should each image use? One operation, three methods. All
 * compile to a per-channel 256-entry curve. Auto-levels and Match histogram are group-aware:
 * their statistics come from all the images passed together (Composer passes one group).
 */

type Histogram = [Float64Array, Float64Array, Float64Array];
type Curve = [Uint8Array, Uint8Array, Uint8Array];

/** Pixels sampled per image for statistics; enough for stable curves at any resolution. */
const sampleBudget = 1_000_000;

const pixels = (input: OffscreenCanvas): ImageData =>
  input.getContext('2d')!.getImageData(0, 0, input.width, input.height);

/** Per-channel histograms, weighted by alpha, normalized to sum 1 per channel. */
export const histogramOf = (input: OffscreenCanvas): Histogram => {
  const h: Histogram = [new Float64Array(256), new Float64Array(256), new Float64Array(256)];
  if (input.width === 0 || input.height === 0) return h;
  const d = pixels(input).data;
  const count = d.length / 4;
  const stride = Math.max(1, Math.floor(count / sampleBudget));
  let total = 0;
  for (let p = 0; p < count; p += stride) {
    const i = p * 4;
    const a = d[i + 3] / 255;
    if (a === 0) continue;
    h[0][d[i]] += a;
    h[1][d[i + 1]] += a;
    h[2][d[i + 2]] += a;
    total += a;
  }
  if (total > 0) h.forEach(c => c.forEach((v, j) => { c[j] = v / total; }));
  return h;
};

const meanHistogram = (hs: Histogram[]): Histogram => {
  const m: Histogram = [new Float64Array(256), new Float64Array(256), new Float64Array(256)];
  hs.forEach(h => h.forEach((c, ch) => c.forEach((v, j) => { m[ch][j] += v / hs.length; })));
  return m;
};

const cdf = (c: Float64Array): Float64Array => {
  const out = new Float64Array(256);
  let sum = 0;
  c.forEach((v, j) => { sum += v; out[j] = sum; });
  return out;
};

const curveOf = (f: (v: number, channel: number) => number): Curve =>
  [0, 1, 2].map(ch => Uint8Array.from({ length: 256 }, (_, v) => Math.max(0, Math.min(255, Math.round(f(v, ch)))))) as Curve;

/**
 * Histogram matching: keeps each value's rank (its CDF) and takes the reference's value at that
 * rank, per channel.
 */
export const matchCurve = (source: Histogram, reference: Histogram): Curve => {
  const s = source.map(cdf);
  const r = reference.map(cdf);
  return curveOf((v, ch) => {
    const target = s[ch][v];
    let u = 0;
    while (u < 255 && r[ch][u] < target - 1e-9) u++;
    return u;
  });
};

/**
 * Auto-levels: the darkest and lightest values (ignoring `clip` percent at each end) stretched to
 * black and white. One range for all channels, so colors keep their balance.
 */
export const autoLevelsCurve = (histogram: Histogram, clip: number): Curve => {
  const fraction = Math.max(0, Math.min(20, clip)) / 100;
  const lows: number[] = [];
  const highs: number[] = [];
  histogram.map(cdf).forEach(c => {
    let lo = 0;
    while (lo < 255 && c[lo] <= fraction) lo++;
    let hi = 255;
    while (hi > 0 && c[hi - 1] >= 1 - fraction) hi--;
    lows.push(lo);
    highs.push(hi);
  });
  const black = Math.min(...lows);
  const white = Math.max(black + 1, Math.max(...highs));
  return curveOf(v => levelsCurve(v, black, white, 1));
};

const applyCurve = (input: OffscreenCanvas, curve: Curve): OffscreenCanvas => {
  const out = new OffscreenCanvas(input.width, input.height);
  if (input.width === 0 || input.height === 0) return out;
  const data = pixels(input);
  const d = data.data;
  for (let i = 0; i < d.length; i += 4) {
    d[i] = curve[0][d[i]];
    d[i + 1] = curve[1][d[i + 1]];
    d[i + 2] = curve[2][d[i + 2]];
  }
  out.getContext('2d')!.putImageData(data, 0, 0);
  return out;
};

const referenceHistogram = (reference: ToneReference, histograms: Histogram[]): Histogram =>
  reference === 'mean' ? meanHistogram(histograms) : histograms[0];

/** The curves Tone applies to each input (one group). */
export const toneCurves = (op: Tone, inputs: OffscreenCanvas[]): Curve[] => {
  const { method } = op;
  switch (method.type) {
    case 'manual': {
      const curve = curveOf(v => levelsCurve(v, method.black, method.white, method.gamma));
      return inputs.map(() => curve);
    }
    case 'auto': {
      const pooled = meanHistogram(inputs.map(histogramOf));
      const curve = autoLevelsCurve(pooled, method.clip);
      return inputs.map(() => curve);
    }
    case 'match': {
      const histograms = inputs.map(histogramOf);
      const reference = referenceHistogram(method.reference, histograms);
      return histograms.map(h => matchCurve(h, reference));
    }
  }
};

export const applyTone = async (op: Tone, inputs: OffscreenCanvas[]): Promise<OffscreenCanvas[]> => {
  if (inputs.length === 0) return [];
  const curves = toneCurves(op, inputs);
  return inputs.map((input, i) => applyCurve(input, curves[i]));
};
