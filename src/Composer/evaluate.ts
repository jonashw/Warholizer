import { PureRasterOperation } from "../Warholizer/RasterOperations/PureRasterOperation/types";
import { dealShuffled, groupCells, normalize, unionDimensions, uniqueName } from "./cube";
import { isSeparation, listDimension, operationLabel, separationDimension } from "./labels";
import { formatParamValue, spreadValuesFor } from "./spread";
import {
  Cell, CombineNode, Cube, Dimension, DimensionId, MemberKey, Node, NodeId, OperationNode,
  PickNode, PivotNode, VariationsNode,
} from "./types";

/**
 * What evaluation needs from images. The canvas implementation runs the raster engine; the
 * symbolic one only counts, so the editor can show dimensions and counts without rendering.
 */
export type ImageOps<Img> = {
  apply: (op: PureRasterOperation, inputs: Img[]) => Promise<Img[]>,
  /** A labeled grid; `grid[row][column]` is undefined where no image has those coordinates. */
  crosstab: (grid: (Img | undefined)[][], rowLabels: string[], columnLabels: string[], labels: boolean) => Promise<Img>,
};

/** The cube after each node, by node id. */
export type Trace<Img> = Map<NodeId, Cube<Img>>;

export const evaluate = async <Img>(
  node: Node,
  input: Cube<Img>,
  ops: ImageOps<Img>,
  trace?: Trace<Img>,
): Promise<Cube<Img>> => {
  const output = await evaluateNode(node, input, ops, trace);
  trace?.set(node.id, output);
  return output;
};

const evaluateNode = <Img>(node: Node, input: Cube<Img>, ops: ImageOps<Img>, trace?: Trace<Img>): Promise<Cube<Img>> => {
  switch (node.kind) {
    case 'operation': return evaluateOperation(node, input, ops);
    case 'sequence': return node.children.reduce(
      async (cube, child) => evaluate(child, await cube, ops, trace),
      Promise.resolve(input));
    case 'variations': return evaluateVariations(node, input, ops, trace);
    case 'combine': return evaluateCombine(node, input, ops);
    case 'pick': return Promise.resolve(evaluatePick(node, input));
    case 'pivot': return Promise.resolve(evaluatePivot(node, input));
  }
};

const evaluateOperation = async <Img>(node: OperationNode, input: Cube<Img>, ops: ImageOps<Img>): Promise<Cube<Img>> => {
  const { op } = node;
  const outputs = await Promise.all(input.cells.map(cell => ops.apply(op, [cell.image])));
  if (!isSeparation(op)) {
    // Effects: one image per cell, coordinates unchanged. (Void leaves none.)
    const cells = input.cells.flatMap((cell, i) => outputs[i].slice(0, 1).map(image => ({ ...cell, image })));
    return normalize(input.dimensions, cells);
  }
  // Separate: each part gets a member of a new dimension.
  const count = Math.max(0, ...outputs.map(o => o.length));
  const { name, labels } = separationDimension(op, count);
  const dimension: Dimension = {
    id: node.id,
    name: uniqueName(name, input.dimensions),
    members: labels.map((label, i) => ({ key: `${i}`, label })),
  };
  const cells = input.cells.flatMap((cell, i) => outputs[i].map((image, part) => ({
    coords: { ...cell.coords, [node.id]: `${part}` },
    image,
  })));
  return normalize([...input.dimensions, dimension], cells);
};

type Variant = { node: Node, coords: Record<DimensionId, MemberKey> };

/** The variants of a Variations node, with the coordinates each one's images get. */
export const variantsOf = (node: VariationsNode, existing: Dimension[]): { variants: Variant[], dimensions: Dimension[] } => {
  if (node.variants.type === 'list') {
    const { name, members } = listDimension(node as VariationsNode & { variants: { type: 'list' } });
    return {
      variants: node.variants.children.map(child => ({ node: child, coords: { [node.id]: child.id } })),
      dimensions: [{ id: node.id, name: uniqueName(name, existing), members }],
    };
  }
  // A spread: one dimension per parameter, variants are their cross product.
  const { op, params } = node.variants;
  const axes = params.map(spread => ({
    id: `${node.id}:${spread.param}`,
    param: spread.param,
    bind: spread.bind,
    values: spreadValuesFor(op, spread),
  }));
  const dimensions: Dimension[] = [];
  for (const axis of axes) {
    dimensions.push({
      id: axis.id,
      name: uniqueName(axis.bind ?? `${operationLabel(op)} ${axis.param}`, [...existing, ...dimensions]),
      members: axis.values.map(v => ({ key: `${v}`, label: formatParamValue(axis.param, v) })),
    });
  }
  let combos: { op: PureRasterOperation, coords: Record<DimensionId, MemberKey> }[] = [{ op, coords: {} }];
  for (const axis of axes) {
    combos = combos.flatMap(c => axis.values.map(v => ({
      op: { ...c.op, [axis.param]: v } as PureRasterOperation,
      coords: { ...c.coords, [axis.id]: `${v}` },
    })));
  }
  return {
    variants: combos.map((c, i) => ({ node: { kind: 'operation', id: `${node.id}#${i}`, op: c.op }, coords: c.coords })),
    dimensions,
  };
};

/** Which variant each cell (in cube order) goes through; every variant for all-per-image. */
const assignments = (node: VariationsNode, cellCount: number, variantCount: number): number[][] => {
  if (node.distribution.type === 'all-per-image') {
    return Array.from({ length: variantCount }, () => Array.from({ length: cellCount }, (_, i) => i));
  }
  const dealt = node.distribution.order.type === 'in-turn'
    ? Array.from({ length: cellCount }, (_, i) => i % variantCount)
    : dealShuffled(cellCount, variantCount, node.distribution.order.seed);
  return Array.from({ length: variantCount }, (_, v) =>
    dealt.flatMap((assigned, cell) => assigned === v ? [cell] : []));
};

const evaluateVariations = async <Img>(node: VariationsNode, input: Cube<Img>, ops: ImageOps<Img>, trace?: Trace<Img>): Promise<Cube<Img>> => {
  const { variants, dimensions: variationDimensions } = variantsOf(node, input.dimensions);
  if (variants.length === 0) {
    return normalize(input.dimensions, []);
  }
  const assigned = assignments(node, input.cells.length, variants.length);
  const outputs = await Promise.all(variants.map((variant, v) => {
    const cells = assigned[v].map(i => input.cells[i]);
    return evaluate(variant.node, { dimensions: input.dimensions, cells }, ops, trace);
  }));
  // Dimensions: the input's (that survive), then this node's, then any the variants created.
  const childDimensions = unionDimensions(outputs.map(o => o.dimensions));
  const inputIds = new Set(input.dimensions.map(d => d.id));
  const dimensions = [
    ...childDimensions.filter(d => inputIds.has(d.id)),
    ...variationDimensions,
    ...childDimensions.filter(d => !inputIds.has(d.id)),
  ];
  const cells: Cell<Img>[] = outputs.flatMap((output, v) =>
    output.cells.map(cell => ({ coords: { ...cell.coords, ...variants[v].coords }, image: cell.image })));
  return normalize(dimensions, cells);
};

/** The dimensions a Combine groups by: as written, or all but the newest (all but rows and columns for a crosstab). */
export const combineBy = (node: CombineNode, dimensions: Dimension[]): DimensionId[] => {
  const ids = dimensions.map(d => d.id);
  if (node.by) {
    return node.by.filter(id => ids.includes(id));
  }
  if (node.method.type === 'crosstab') {
    const { rows, columns } = node.method;
    return ids.filter(id => id !== rows && id !== columns);
  }
  return ids.slice(0, -1);
};

const evaluateCombine = async <Img>(node: CombineNode, input: Cube<Img>, ops: ImageOps<Img>): Promise<Cube<Img>> => {
  const by = combineBy(node, input.dimensions);
  const groups = groupCells(input, by);
  const { method } = node;
  const images = await Promise.all(groups.map(async group => {
    if (method.type !== 'crosstab') {
      const [image] = await ops.apply(method, group.cells.map(c => c.image));
      return image;
    }
    const rowDimension = input.dimensions.find(d => d.id === method.rows);
    const columnDimension = input.dimensions.find(d => d.id === method.columns);
    const rowMembers = rowDimension?.members ?? [{ key: '', label: '' }];
    const columnMembers = columnDimension?.members ?? [{ key: '', label: '' }];
    const at = (row: MemberKey, column: MemberKey) => group.cells.find(c =>
      (!rowDimension || c.coords[method.rows] === row) && (!columnDimension || c.coords[method.columns] === column))?.image;
    const grid = rowMembers.map(r => columnMembers.map(c => at(r.key, c.key)));
    return ops.crosstab(grid, rowMembers.map(m => m.label), columnMembers.map(m => m.label), method.labels);
  }));
  const cells = groups.flatMap((group, i) => images[i] === undefined ? [] : [{ coords: group.coords, image: images[i] }]);
  return normalize(input.dimensions.filter(d => by.includes(d.id)), cells);
};

const evaluatePick = <Img>(node: PickNode, input: Cube<Img>): Cube<Img> => {
  const { dimension, members } = node;
  if (!input.dimensions.some(d => d.id === dimension)) {
    return input;
  }
  if (!Array.isArray(members)) {
    // Slice: keep one member and remove the dimension.
    const cells = input.cells
      .filter(c => c.coords[dimension] === members)
      .map(c => {
        const coords = { ...c.coords };
        delete coords[dimension];
        return { ...c, coords };
      });
    return normalize(input.dimensions.filter(d => d.id !== dimension), cells);
  }
  // Dice: keep the listed members, in the listed order.
  const keep = new Set(members);
  const dimensions = input.dimensions.map(d => d.id !== dimension ? d : {
    ...d,
    members: members.flatMap(key => d.members.filter(m => m.key === key)),
  });
  return normalize(dimensions, input.cells.filter(c => keep.has(c.coords[dimension])));
};

const evaluatePivot = <Img>(node: PivotNode, input: Cube<Img>): Cube<Img> => {
  const first = node.order.flatMap(id => input.dimensions.filter(d => d.id === id));
  const rest = input.dimensions.filter(d => !node.order.includes(d.id));
  return normalize([...first, ...rest], input.cells);
};
