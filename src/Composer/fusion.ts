import { levelsCurve, pixelMath } from "../Warholizer/RasterOperations/PureRasterOperation/kernels";
import { PureRasterOperation } from "../Warholizer/RasterOperations/PureRasterOperation/types";
import { Node } from "./types";

/** A per-channel tone curve: the same 256-entry table for red, green and blue (alpha untouched). */
export type Curve = Uint8Array;

/** The curve an operation applies, when it is exactly a per-channel curve. */
export const curveOf = (op: PureRasterOperation): ((v: number) => number) | undefined => {
  switch (op.type) {
    case 'invert': return v => 255 - v;
    case 'levels': return v => levelsCurve(v, op.black, op.white, op.gamma);
    case 'posterize': return v => pixelMath.posterize(v, Math.max(2, op.levels));
    case 'tone': return op.method.type === 'manual'
      ? (m => (v: number) => levelsCurve(v, m.black, m.white, m.gamma))(op.method)
      : undefined;
    default: return undefined;
  }
};

/** A step that can join a fused run: a per-channel curve, not grouped. */
export const fusible = (node: Node): node is Node & { kind: 'operation' } =>
  node.kind === 'operation' && node.by === undefined && curveOf(node.op) !== undefined;

/** Consecutive curves composed into one table: a single pass instead of one per step. */
export const composeCurves = (ops: PureRasterOperation[]): Curve => {
  const table = Uint8Array.from({ length: 256 }, (_, v) => v);
  for (const op of ops) {
    const f = curveOf(op)!;
    for (let v = 0; v < 256; v++) table[v] = Math.max(0, Math.min(255, Math.round(f(table[v]))));
  }
  return table;
};
