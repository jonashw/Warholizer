import { operationRegistry } from "../Warholizer/RasterOperations/PureRasterOperation/registry";
import { PureRasterOperation } from "../Warholizer/RasterOperations/PureRasterOperation/types";
import { formatParamValue, paramLabel } from "./spread";
import { LayoutPreset, presetOf } from "./build";
import { CombineMethod, Member, Node, VariationsNode } from "./types";

export const operationLabel = (op: PureRasterOperation) => operationRegistry[op.type].label;

const presetLabels: Record<LayoutPreset, string> = { tile: 'Tile', line: 'Line', crosstab: 'Crosstab', sheet: 'Sheet', zine: 'Zine' };

export const combineMethodLabel = (method: CombineMethod): string =>
  method.type === 'layout' ? presetLabels[presetOf(method)]
  : method.type === 'mean' ? 'Mean' : method.type === 'median' ? 'Median' : method.type === 'animate' ? 'Animate'
  : operationLabel(method);

/** Short name of a node, for pills, members and the text view. */
export const nodeLabel = (node: Node): string => {
  switch (node.kind) {
    case 'operation': return operationLabel(node.op);
    case 'sequence': return node.children.map(nodeLabel).join(' + ') || 'Empty';
    case 'variations': return node.variants.type === 'spread'
      ? `Spread ${operationLabel(node.variants.op)}`
      : 'Variations';
    case 'combine': return combineMethodLabel(node.method);
    case 'pick': return 'Pick';
    case 'pivot': return 'Pivot';
    case 'format': return node.format.name;
  }
};

/**
 * The dimension a separating operation adds, with its members' labels for `count` parts:
 * Channel (R, G, B), Ink (C, M, Y, K), Color (1, 2, …), Part, Copy.
 */
export const separationDimension = (op: PureRasterOperation, count: number): { name: string, labels: string[] } => {
  const numbered = (name: string) => ({ name, labels: Array.from({ length: count }, (_, i) => `${i + 1}`) });
  switch (op.type) {
    case 'rgbChannels': return { name: 'Channel', labels: ['R', 'G', 'B', 'A'].slice(0, count) };
    case 'cmykChannels': return { name: 'Ink', labels: ['C', 'M', 'Y', 'K'].slice(0, count) };
    case 'separateColors': return numbered('Color');
    case 'split': return numbered('Part');
    case 'copies': return numbered('Copy');
    default: return numbered(operationLabel(op));
  }
};

/** Operations that turn one image into parts (a new dimension) rather than one image. */
export const isSeparation = (op: PureRasterOperation) =>
  operationRegistry[op.type].kind === 'cardinality' && op.type !== 'noop' && op.type !== 'void';

/**
 * Name and members of a list of variations. Variations of one operation type are named after it,
 * labeled by the parameters that differ (Gradient map: #183a65 → #ff4137, …); mixed variations
 * are named Variation and labeled by each child.
 */
export const listDimension = (node: VariationsNode & { variants: { type: 'list' } }): { name: string, members: Member[] } => {
  const children = node.variants.children;
  if (children.length > 0 && children.every(c => c.kind === 'format')) {
    return {
      name: node.bind ?? 'Format',
      members: children.map(c => ({ key: c.id, label: c.kind === 'format' ? c.format.name : '' })),
    };
  }
  const ops = children.map(c => c.kind === 'operation' ? c.op : undefined);
  const sameType = ops.length > 0 && ops.every(op => op && op.type === ops[0]!.type);
  if (sameType) {
    const typed = ops as PureRasterOperation[];
    const params = Object.keys(typed[0]).filter(k => k !== 'type'
      && typed.some(op => JSON.stringify((op as Record<string, unknown>)[k]) !== JSON.stringify((typed[0] as Record<string, unknown>)[k])));
    return {
      name: node.bind ?? operationLabel(typed[0]),
      members: children.map((c, i) => ({
        key: c.id,
        label: params.length === 0
          ? `${i + 1}`
          : params.map(p => (params.length > 1 ? `${paramLabel(p)} ` : '') + formatParamValue(p, (typed[i] as Record<string, unknown>)[p])).join(', '),
      })),
    };
  }
  return {
    name: node.bind ?? 'Variation',
    members: children.map(c => ({ key: c.id, label: nodeLabel(c) })),
  };
};
