import { PureRasterOperation } from "./types";
import { RasterEngine } from "./engine";

export type BenchmarkResult = {
  engine: string,
  op: PureRasterOperation["type"],
  inputSize: string,
  medianMs: number,
  minMs: number,
  maxMs: number,
  runs: number
};

export type GalleryBenchmarkResult = {
  engine: string,
  op: PureRasterOperation["type"],
  inputSize: string,
  previews: number,
  wallMs: number,
  /** Longest gap between main-thread timer ticks while rendering: how long the UI froze. */
  maxStallMs: number
};

/** Copy of `source` scaled so its longest side is `longestSide` pixels. */
export const resized = (source: OffscreenCanvas, longestSide: number): OffscreenCanvas => {
  const scale = longestSide / Math.max(source.width, source.height);
  const c = new OffscreenCanvas(Math.round(source.width * scale), Math.round(source.height * scale));
  c.getContext('2d')!.drawImage(source, 0, 0, c.width, c.height);
  return c;
};

const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

// Canvas 2D work may be deferred (e.g. GPU-backed canvases); reading a pixel forces it to complete.
const flush = (outputs: OffscreenCanvas[]) => {
  for (const o of outputs) {
    if (o.width > 0 && o.height > 0) {
      o.getContext('2d')!.getImageData(0, 0, 1, 1);
    }
  }
};

export const benchmarkOperation = async (
  engine: RasterEngine,
  op: PureRasterOperation,
  input: OffscreenCanvas,
  runs: number
): Promise<BenchmarkResult> => {
  flush(await engine.apply(op, [input])); // warm-up
  const times: number[] = [];
  for (let i = 0; i < runs; i++) {
    const t0 = performance.now();
    flush(await engine.apply(op, [input]));
    times.push(performance.now() - t0);
  }
  return {
    engine: engine.name,
    op: op.type,
    inputSize: `${input.width}×${input.height}`,
    medianMs: median(times),
    minMs: Math.min(...times),
    maxMs: Math.max(...times),
    runs
  };
};

/** Renders `previews` copies of one operation concurrently, as a filter gallery would. */
export const benchmarkGallery = async (
  engine: RasterEngine,
  op: PureRasterOperation,
  input: OffscreenCanvas,
  previews: number
): Promise<GalleryBenchmarkResult> => {
  flush(await engine.apply(op, [input])); // warm-up
  let maxStallMs = 0;
  let last = performance.now();
  const ticker = setInterval(() => {
    const now = performance.now();
    maxStallMs = Math.max(maxStallMs, now - last);
    last = now;
  }, 1);
  const t0 = performance.now();
  const outputs = await Promise.all(Array.from({ length: previews }, () => engine.apply(op, [input])));
  outputs.forEach(flush);
  const wallMs = performance.now() - t0;
  clearInterval(ticker);
  maxStallMs = Math.max(maxStallMs, performance.now() - last);
  return { engine: engine.name, op: op.type, inputSize: `${input.width}×${input.height}`, previews, wallMs, maxStallMs };
};
