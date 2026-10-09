import { operationRegistry } from "../Warholizer/RasterOperations/PureRasterOperation/registry";
import { PureRasterOperation } from "../Warholizer/RasterOperations/PureRasterOperation/types";
import { photoCube } from "./cube";
import { evaluate, ImageOps, Trace } from "./evaluate";
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

/** Image operations that only count, following each operation's cardinality; sizes pass through. */
export const placeholderOps: ImageOps<Placeholder> = {
  apply: async (op, inputs) => {
    if (manyToOne.has(op.type)) {
      return inputs.length === 0 ? [] : [inputs[0]];
    }
    if (operationRegistry[op.type].kind === 'cardinality') {
      return inputs.flatMap(input => Array.from({ length: partsOf(op) }, () => input));
    }
    return inputs;
  },
  size: image => [image.width, image.height],
  compose: async plan => placeholder(plan.width, plan.height),
};

/** Dimensions, counts and pages at every node, without rendering. */
export const inferComposition = async (composition: Composition, photoSizes: [number, number][], scales?: number[]) => {
  const trace: Trace<Placeholder> = new Map();
  const output: Cube<Placeholder> = await evaluate(
    composition.root,
    photoCube(photoSizes.map(([w, h]) => placeholder(w, h)), scales),
    placeholderOps,
    trace,
    { format: composition.format ?? defaultFormat });
  return { output, trace };
};
