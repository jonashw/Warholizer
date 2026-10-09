import { apply } from "./apply";
import { PureRasterOperation } from "./types";

export type BenchmarkResult = {
  op: PureRasterOperation["type"],
  inputSize: string,
  medianMs: number,
  minMs: number,
  maxMs: number,
  runs: number
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
  op: PureRasterOperation,
  input: OffscreenCanvas,
  runs: number
): Promise<BenchmarkResult> => {
  flush(await apply(op, [input])); // warm-up
  const times: number[] = [];
  for (let i = 0; i < runs; i++) {
    const t0 = performance.now();
    flush(await apply(op, [input]));
    times.push(performance.now() - t0);
  }
  return {
    op: op.type,
    inputSize: `${input.width}×${input.height}`,
    medianMs: median(times),
    minMs: Math.min(...times),
    maxMs: Math.max(...times),
    runs
  };
};
