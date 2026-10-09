import { operationRegistry } from "../Warholizer/RasterOperations/PureRasterOperation/registry";
import { PureRasterOperation } from "../Warholizer/RasterOperations/PureRasterOperation/types";
import { photoCube } from "./cube";
import { evaluate, ImageOps, Trace } from "./evaluate";
import { Composition, Cube } from "./types";

/** A stand-in image: inference tracks coordinates and counts without pixels. */
export type Placeholder = { readonly placeholder: true };
const placeholder: Placeholder = { placeholder: true };

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

/** Image operations that only count, following each operation's cardinality. */
export const placeholderOps: ImageOps<Placeholder> = {
  apply: async (op, inputs) => {
    if (manyToOne.has(op.type)) {
      return inputs.length === 0 ? [] : [placeholder];
    }
    if (operationRegistry[op.type].kind === 'cardinality') {
      return inputs.flatMap(() => Array.from({ length: partsOf(op) }, () => placeholder));
    }
    return inputs.map(() => placeholder);
  },
  crosstab: async () => placeholder,
};

/** Dimensions and counts at every node for `photoCount` photos, without rendering. */
export const inferComposition = async (composition: Composition, photoCount: number) => {
  const trace: Trace<Placeholder> = new Map();
  const output: Cube<Placeholder> = await evaluate(
    composition.root,
    photoCube(Array.from({ length: photoCount }, () => placeholder)),
    placeholderOps,
    trace);
  return { output, trace };
};
