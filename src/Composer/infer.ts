import { operationRegistry } from "../Warholizer/RasterOperations/PureRasterOperation/registry";
import { PureRasterOperation } from "../Warholizer/RasterOperations/PureRasterOperation/types";
import { photoCube } from "./cube";
import { evaluate, EvaluateOptions, ImageOps, Trace } from "./evaluate";
import { defaultFormat } from "./formats";
import { Composition, Cube } from "./types";

/** A stand-in image: inference tracks coordinates, counts and sizes without pixels. */
export type Placeholder = { readonly placeholder: true, width: number, height: number };
const placeholder = (width: number, height: number): Placeholder => ({ placeholder: true, width, height });

const partsOf = (op: PureRasterOperation): number => {
  switch (op.type) {
    case 'void': return 0;
    case 'rgbChannels': return 3;
    case 'cmykChannels': return 4;
    case 'separateColors': return Math.max(1, Math.floor(op.colors));
    case 'split': return 2;
    case 'copies': return Math.max(0, Math.floor(op.n));
    default: return 1;
  }
};

const manyToOne = new Set<PureRasterOperation['type']>(['tile', 'line', 'stack']);

/** The size an operation gives one image (sizes are resolved to pixels by now); most keep it. */
export const outputSizeOf = (op: PureRasterOperation, [w, h]: [number, number]): [number, number] => {
  const clampScale = (s: number | undefined) => Math.min(8, Math.max(1, s ?? 1));
  switch (op.type) {
    case 'halftone': return op.style === 'classic' ? [w, h] : [w * clampScale(op.scale), h * clampScale(op.scale)];
    case 'colorHalftone': return [w * clampScale(op.scale), h * clampScale(op.scale)];
    case 'scale': return [Math.abs(op.x) * w, Math.abs(op.y) * h];
    case 'scaleToFit': {
      if (op.w > w && op.h > h) return [w, h];
      const ratio = Math.min(op.w / w, op.h / h);
      return [w * ratio, h * ratio];
    }
    case 'crop': return op.unit === 'px' ? [op.width, op.height] : [w * op.width / 100, h * op.height / 100];
    case 'printSet': return [w * op.rowLength, w * op.rowLength * 11 / 8.5];
    default: return [w, h];
  }
};

/** Image operations that only count, following each operation's cardinality; sizes pass through. */
export const placeholderOps: ImageOps<Placeholder> = {
  apply: async (op, inputs) => {
    if (manyToOne.has(op.type)) {
      return inputs.length === 0 ? [] : [inputs[0]];
    }
    if (op.type === 'noop') return inputs;
    // Each output is a new image (a new canvas when rendered), so memory estimates count it.
    if (operationRegistry[op.type].kind === 'cardinality') {
      return inputs.flatMap(input => Array.from({ length: partsOf(op) }, () => placeholder(input.width, input.height)));
    }
    return inputs.map(input => {
      const [width, height] = outputSizeOf(op, [input.width, input.height]);
      return placeholder(width, height);
    });
  },
  size: image => [image.width, image.height],
  compose: async plan => placeholder(plan.width, plan.height),
};

/** Dimensions, counts and pages at every node, without rendering. */
export const inferComposition = async (
  composition: Composition, photoSizes: [number, number][], scales?: number[], onPlaced?: EvaluateOptions['onPlaced'],
) => {
  const trace: Trace<Placeholder> = new Map();
  const output: Cube<Placeholder> = await evaluate(
    composition.root,
    photoCube(photoSizes.map(([w, h]) => placeholder(w, h)), scales),
    placeholderOps,
    trace,
    { format: composition.format ?? defaultFormat, onPlaced });
  return { output, trace };
};

/**
 * Pixels the preview holds at once: every distinct image in every step's output (the trace keeps
 * them all for peeks). Used to keep previews within a device's memory.
 */
export const totalPixels = (trace: Trace<Placeholder>): number => {
  const seen = new Set<Placeholder>();
  let total = 0;
  for (const { output } of trace.values()) {
    for (const cell of output.cells) {
      if (seen.has(cell.image)) continue;
      seen.add(cell.image);
      total += cell.image.width * cell.image.height;
    }
  }
  return total;
};
