export type RGB = [number, number, number];

const luminance = ([r, g, b]: RGB) => 0.21 * r + 0.72 * g + 0.07 * b;

/** Parses `#rgb` or `#rrggbb`; undefined for anything else. */
export const parseHexColor = (hex: string | null | undefined): RGB | undefined => {
  const m = hex?.trim().match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (!m) {
    return undefined;
  }
  const h = m[1].length === 3 ? m[1].split('').map(c => c + c).join('') : m[1];
  return [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16)) as RGB;
};

export const toHexColor = (rgb: RGB) =>
  '#' + rgb.map(v => Math.round(v).toString(16).padStart(2, '0')).join('');

/**
 * Median-cut palette of up to `colors` colors, ordered darkest first (so replacement colors map
 * predictably). Repeatedly splits the bucket with the widest channel range at its median, as the
 * original Warholizer quantizer does, but stops at any count rather than only powers of two.
 * Runs on a downscaled sample: palettes are statistics, so full resolution adds cost, not quality.
 */
export const medianCutPalette = (input: OffscreenCanvas, colors: number, sampleSide = 128): RGB[] => {
  const key = `${colors}@${sampleSide}`;
  const cached = paletteCache.get(input)?.get(key);
  if (cached) {
    return cached;
  }
  const palette = computeMedianCutPalette(input, colors, sampleSide);
  if (!paletteCache.has(input)) {
    paletteCache.set(input, new Map());
  }
  paletteCache.get(input)!.set(key, palette);
  return palette;
};

/**
 * Palettes per input canvas. Engine canvases are never mutated after they are produced (kernels and
 * operations always draw into new canvases), so a canvas's palette stays valid; galleries and
 * separations then analyze each input once instead of once per preview or layer.
 */
const paletteCache = new WeakMap<OffscreenCanvas, Map<string, RGB[]>>();

const computeMedianCutPalette = (input: OffscreenCanvas, colors: number, sampleSide: number): RGB[] => {
  if (input.width === 0 || input.height === 0 || colors < 1) {
    return [];
  }
  const scale = Math.min(1, sampleSide / Math.max(input.width, input.height));
  const w = Math.max(1, Math.round(input.width * scale));
  const h = Math.max(1, Math.round(input.height * scale));
  const sample = new OffscreenCanvas(w, h);
  const ctx = sample.getContext('2d', { willReadFrequently: true })!;
  ctx.drawImage(input, 0, 0, w, h);
  const data = ctx.getImageData(0, 0, w, h).data;

  // Mostly-opaque pixels only; transparent areas are not part of the picture.
  const pixels: number[] = [];
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] >= 128) {
      pixels.push(i);
    }
  }
  if (pixels.length === 0) {
    return [];
  }

  type Bucket = { pixels: number[], channel: number, range: number };
  const describe = (px: number[]): Bucket => {
    const min = [255, 255, 255], max = [0, 0, 0];
    for (const i of px) {
      for (let c = 0; c < 3; c++) {
        const v = data[i + c];
        if (v < min[c]) min[c] = v;
        if (v > max[c]) max[c] = v;
      }
    }
    const ranges = max.map((m, c) => m - min[c]);
    const channel = ranges.indexOf(Math.max(...ranges));
    return { pixels: px, channel, range: ranges[channel] };
  };

  // Partition by the channel's median value using a 256-bin histogram: O(n), unlike sorting.
  // Pixels equal to the median value go to whichever side keeps the halves closest in size,
  // and both sides are always non-empty because the bucket's range is positive.
  const splitAtMedian = ({ pixels: px, channel }: Bucket): [number[], number[]] => {
    const histogram = new Uint32Array(256);
    for (const i of px) {
      histogram[data[i + channel]]++;
    }
    const half = px.length / 2;
    let below = 0, cut = 0;
    while (below + histogram[cut] < half) {
      below += histogram[cut++];
    }
    // Put the median value below the cut unless that leaves nothing above it, or the halves are closer without it.
    const includeCut = below + histogram[cut] < px.length && (below === 0 || Math.abs(below + histogram[cut] - half) <= Math.abs(below - half));
    const threshold = includeCut ? cut : cut - 1;
    const lower: number[] = [], upper: number[] = [];
    for (const i of px) {
      (data[i + channel] <= threshold ? lower : upper).push(i);
    }
    return [lower, upper];
  };

  const buckets: Bucket[] = [describe(pixels)];
  while (buckets.length < colors) {
    const splittable = buckets.filter(b => b.range > 0 && b.pixels.length > 1);
    if (splittable.length === 0) {
      break;
    }
    const widest = splittable.reduce((a, b) => b.range > a.range ? b : a);
    const [lower, upper] = splitAtMedian(widest);
    buckets.splice(buckets.indexOf(widest), 1, describe(lower), describe(upper));
  }

  return buckets
    .map(b => {
      const sum = [0, 0, 0];
      for (const i of b.pixels) {
        sum[0] += data[i]; sum[1] += data[i + 1]; sum[2] += data[i + 2];
      }
      return sum.map(s => Math.round(s / b.pixels.length)) as RGB;
    })
    .sort((a, b) => luminance(a) - luminance(b));
};

/** The color each palette entry is painted with: its replacement when valid, else itself. */
export const paintColors = (palette: RGB[], replacements: readonly (string | null)[]): RGB[] =>
  palette.map((c, i) => parseHexColor(replacements[i]) ?? c);
