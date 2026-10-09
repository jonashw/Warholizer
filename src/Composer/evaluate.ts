import { resolveLength, resolveLengths } from "../Warholizer/RasterOperations/PureRasterOperation/length";
import { defaultFormat, formatToPixels, pageBoxOf, pagePixels } from "./formats";
import { PageBox, PagePlan, planCrosstab, planFlow, planMiniZine, withReading } from "./layoutPlan";
import { isGroupAware } from "../Warholizer/RasterOperations/PureRasterOperation/registry";
import { PureRasterOperation } from "../Warholizer/RasterOperations/PureRasterOperation/types";
import { dealShuffled, groupCells, normalize, unionDimensions, uniqueName } from "./cube";
import { isSeparation, listDimension, operationLabel, separationDimension } from "./labels";
import { formatSpreadValue, spreadSetting, spreadValuesFor } from "./spread";
import {
  Cell, CombineNode, Cube, Dimension, DimensionId, Format, Layout, Member, MemberKey, Node, NodeId, OperationNode,
  PHOTO, PickNode, PivotNode, VariationsNode,
} from "./types";

/**
 * What evaluation needs from images. The canvas implementation runs the raster engine; the
 * symbolic one only counts, so the editor can show dimensions and counts without rendering.
 */
export type ImageOps<Img> = {
  apply: (op: PureRasterOperation, inputs: Img[]) => Promise<Img[]>,
  /** Width and height, for sizes relative to an image; absent for placeholders. */
  size?: (image: Img) => [number, number],
  /** Draws one planned page or canvas of a Layout from the group's images. */
  compose: (plan: PagePlan, images: Img[]) => Promise<Img>,
  /** Each pixel's mean or median across the images (all drawn at the first image's size). */
  average: (images: Img[], kind: 'mean' | 'median') => Promise<Img>,
  /** The images as animation frames: one common size, each image contained and centered. */
  frames: (images: Img[]) => Promise<Img[]>,
};

/** Settings that come from the composition rather than from any one step. */
export type EvaluateOptions = {
  format: Format,
  /** For previews: pages larger than this (long side, px) render smaller, at a proportionally smaller scale. */
  maxPageSize?: number,
  /**
   * Called for each image placed on a page: `photoScale` is how many pixels the placement uses per
   * pixel of the source photo (above 1 means upscaled), with the page's format. For print planning.
   */
  onPlaced?: (placement: { photo: MemberKey | undefined, photoScale: number, format: Format }) => void,
};
const defaultOptions: EvaluateOptions = { format: defaultFormat };

/** The cubes into and out of each node, by node id. */
export type Trace<Img> = Map<NodeId, { input: Cube<Img>, output: Cube<Img> }>;

export const evaluate = async <Img>(
  node: Node,
  input: Cube<Img>,
  ops: ImageOps<Img>,
  trace?: Trace<Img>,
  options: EvaluateOptions = defaultOptions,
): Promise<Cube<Img>> => {
  const output = await evaluateNode(node, input, ops, trace, options);
  trace?.set(node.id, { input, output });
  return output;
};

const evaluateNode = <Img>(node: Node, input: Cube<Img>, ops: ImageOps<Img>, trace: Trace<Img> | undefined, options: EvaluateOptions): Promise<Cube<Img>> => {
  switch (node.kind) {
    case 'operation': return evaluateOperation(node, input, ops, options);
    case 'sequence': return node.children.reduce(
      async (cube, child) => evaluate(child, await cube, ops, trace, options),
      Promise.resolve(input));
    case 'variations': return evaluateVariations(node, input, ops, trace, options);
    case 'combine': return evaluateCombine(node, input, ops, options);
    case 'format': return Promise.resolve({ ...input, cells: input.cells.map(c => ({ ...c, frame: node.format })) });
    case 'pick': return Promise.resolve(evaluatePick(node, input));
    case 'pivot': return Promise.resolve(evaluatePivot(node, input));
  }
};

/** `op` with its sizes in this cell's pixels: preview scale, DPI and the image's short side. */
const resolvedFor = <Img>(op: PureRasterOperation, cell: Cell<Img> | undefined, ops: ImageOps<Img>, options: EvaluateOptions): PureRasterOperation => {
  const [w, h] = cell && ops.size ? ops.size(cell.image) : [0, 0];
  const dpi = cell?.frame?.dpi ?? options.format.dpi;
  return resolveLengths(op, { dpi, scale: cell?.scale ?? 1, shortSide: Math.min(w, h) }) as PureRasterOperation;
};

/** The group-aware operation with "Photo n" resolved: the reference image goes first, then the group. */
const withReference = <Img>(op: PureRasterOperation, input: Cube<Img>): { op: PureRasterOperation, reference?: Img } => {
  if (op.type !== 'tone' || op.method.type !== 'match' || typeof op.method.reference !== 'object') return { op };
  const key = `${op.method.reference.photo}`;
  const cell = input.cells.find(c => c.coords[PHOTO] === key);
  return { op: { ...op, method: { ...op.method, reference: 'first' } }, reference: cell?.image };
};

/** Group-aware effects: one call per group of the `by` dimensions, so statistics stay within a group. */
const evaluateGroupAware = async <Img>(node: OperationNode, input: Cube<Img>, ops: ImageOps<Img>, options: EvaluateOptions): Promise<Cube<Img>> => {
  const by = (node.by ?? []).filter(id => input.dimensions.some(d => d.id === id));
  const { op: unresolved, reference } = withReference(node.op, input);
  const groups = groupCells(input, by);
  const results = await Promise.all(groups.map(async group => {
    const op = resolvedFor(unresolved, group.cells[0], ops, options);
    const images = group.cells.map(c => c.image);
    const out = reference === undefined ? await ops.apply(op, images) : (await ops.apply(op, [reference, ...images])).slice(1);
    return group.cells.map((cell, i) => ({ ...cell, image: out[i] }));
  }));
  return normalize(input.dimensions, results.flat().filter(c => c.image !== undefined));
};

const evaluateOperation = async <Img>(node: OperationNode, input: Cube<Img>, ops: ImageOps<Img>, options: EvaluateOptions): Promise<Cube<Img>> => {
  const { op } = node;
  if (isGroupAware(op)) {
    return evaluateGroupAware(node, input, ops, options);
  }
  const outputs = await Promise.all(input.cells.map(cell => ops.apply(resolvedFor(op, cell, ops, options), [cell.image])));
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
    scale: cell.scale,
    frame: cell.frame,
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
    spread,
    param: spread.param,
    bind: spread.bind,
    values: spreadValuesFor(op, spread),
  }));
  const dimensions: Dimension[] = [];
  for (const axis of axes) {
    dimensions.push({
      id: axis.id,
      name: uniqueName(axis.bind ?? `${operationLabel(op)} ${axis.param}`, [...existing, ...dimensions]),
      members: axis.values.map(v => ({ key: `${v}`, label: formatSpreadValue(axis.spread, v) })),
    });
  }
  let combos: { op: PureRasterOperation, coords: Record<DimensionId, MemberKey> }[] = [{ op, coords: {} }];
  for (const axis of axes) {
    combos = combos.flatMap(c => axis.values.map(v => ({
      op: { ...c.op, [axis.param]: spreadSetting(axis.spread, v) } as PureRasterOperation,
      coords: { ...c.coords, [axis.id]: `${v}` },
    })));
  }
  return {
    variants: combos.map((c, i) => ({ node: { kind: 'operation', id: `${node.id}#${i}`, op: c.op }, coords: c.coords })),
    dimensions,
  };
};

type Assignment = {
  /** Input cells (by index, in cube order) each variant receives. */
  cells: number[][],
  /** One image per variant, spilling: each input cell's round (0-based). */
  rounds?: number[],
  /** Input cells that pass through unchanged. */
  kept: number[],
};

/** Which variant each cell (in cube order) goes through. */
const assignments = (node: VariationsNode, cellCount: number, variantCount: number): Assignment => {
  const d = node.distribution;
  const byVariant = (dealt: (number | undefined)[]) => Array.from({ length: variantCount }, (_, v) =>
    dealt.flatMap((assigned, cell) => assigned === v ? [cell] : []));
  if (d.type === 'all-variants-per-image') {
    return { cells: Array.from({ length: variantCount }, () => Array.from({ length: cellCount }, (_, i) => i)), kept: [] };
  }
  if (d.type === 'one-variant-per-image') {
    const dealt = d.order.type === 'in-turn'
      ? Array.from({ length: cellCount }, (_, i) => i % variantCount)
      : dealShuffled(cellCount, variantCount, d.order.seed);
    return { cells: byVariant(dealt), kept: [] };
  }
  // One image per variant: round r pairs images r·k … r·k + k − 1 with the k variants.
  const order = d.order;
  const dealt = Array.from({ length: cellCount }, (_, i) => {
    const round = Math.floor(i / variantCount);
    if (round > 0 && d.overflow !== 'spill') return undefined;
    const position = i % variantCount;
    return order.type === 'in-turn' ? position : dealShuffled(variantCount, variantCount, order.seed + round)[position];
  });
  return {
    cells: byVariant(dealt),
    rounds: d.overflow === 'spill' ? dealt.map((_, i) => Math.floor(i / variantCount)) : undefined,
    kept: d.overflow === 'keep' ? dealt.flatMap((v, i) => v === undefined ? [i] : []) : [],
  };
};

const evaluateVariations = async <Img>(node: VariationsNode, input: Cube<Img>, ops: ImageOps<Img>, trace: Trace<Img> | undefined, options: EvaluateOptions): Promise<Cube<Img>> => {
  const { variants, dimensions: variationDimensions } = variantsOf(node, input.dimensions);
  if (variants.length === 0) {
    return normalize(input.dimensions, []);
  }
  const assigned = assignments(node, input.cells.length, variants.length);
  // Spilling rounds: each image is tagged with its round before going through its variant.
  const roundId = `${node.id}:round`;
  const roundCount = assigned.rounds ? Math.max(0, ...assigned.rounds) + 1 : 0;
  const inputDimensions: Dimension[] = assigned.rounds
    ? [...input.dimensions, { id: roundId, name: uniqueName('Round', input.dimensions), members: Array.from({ length: roundCount }, (_, r) => ({ key: `${r + 1}`, label: `${r + 1}` })) }]
    : input.dimensions;
  const tagged = (i: number): Cell<Img> => assigned.rounds
    ? { ...input.cells[i], coords: { ...input.cells[i].coords, [roundId]: `${assigned.rounds[i] + 1}` } }
    : input.cells[i];
  const outputs = await Promise.all(variants.map((variant, v) => {
    const cells = assigned.cells[v].map(tagged);
    return evaluate(variant.node, { dimensions: inputDimensions, cells }, ops, trace, options);
  }));
  // Dimensions: the input's (that survive), then this node's, then any the variants created.
  // Member order comes from the input where a dimension already existed (variants see subsets of it).
  const present = new Set(outputs.flatMap(o => o.dimensions.map(d => d.id)));
  const childDimensions = unionDimensions([inputDimensions, ...outputs.map(o => o.dimensions)]).filter(d => present.has(d.id));
  const inputIds = new Set(input.dimensions.map(d => d.id));
  const dimensions = [
    ...childDimensions.filter(d => inputIds.has(d.id)),
    ...variationDimensions,
    ...childDimensions.filter(d => !inputIds.has(d.id)),
  ];
  const cells: Cell<Img>[] = [
    ...outputs.flatMap((output, v) =>
      output.cells.map(cell => ({ ...cell, coords: { ...cell.coords, ...variants[v].coords } }))),
    // Kept images have no member in this node's dimension.
    ...assigned.kept.map(i => input.cells[i]),
  ];
  return normalize(dimensions, cells);
};

/**
 * The dimensions a Combine groups by: as written, or all but the newest (all but the rows and
 * columns for a crosstab-style layout).
 */
export const combineBy = <Img>(node: CombineNode, dimensions: Dimension[], cells: Cell<Img>[] = []): DimensionId[] => {
  const ids = dimensions.map(d => d.id);
  if (node.by) {
    return node.by.filter(id => ids.includes(id));
  }
  const { method } = node;
  const by = method.type === 'layout' && method.placement.type === 'by-dimensions'
    ? ids.filter(id => !(method.placement.type === 'by-dimensions' && [...method.placement.rows, ...method.placement.columns].includes(id)))
    : ids.slice(0, -1);
  if (method.type !== 'layout' || method.frame.type !== 'page') return by;
  // Images with different formats cannot share a page: keep any dimension that decides the format.
  const decidesFormat = (d: DimensionId) => {
    const formatOf = new Map<string, string>();
    for (const cell of cells) {
      const key = cell.coords[d];
      const name = cell.frame?.name ?? '';
      if (key === undefined) continue;
      if (formatOf.has(key) && formatOf.get(key) !== name) return false;
      formatOf.set(key, name);
    }
    return new Set(formatOf.values()).size > 1;
  };
  return ids.filter(id => by.includes(id) || decidesFormat(id));
};

const evaluateCombine = async <Img>(node: CombineNode, input: Cube<Img>, ops: ImageOps<Img>, options: EvaluateOptions): Promise<Cube<Img>> => {
  const { method } = node;
  if (method.type === 'layout') {
    return evaluateLayout(node, method, input, ops, options);
  }
  const by = combineBy(node, input.dimensions);
  const groups = groupCells(input, by);
  const cells = (await Promise.all(groups.map(async (group): Promise<Cell<Img>[]> => {
    const images = group.cells.map(c => c.image);
    const base = { coords: group.coords, scale: group.cells[0]?.scale, frame: group.cells[0]?.frame };
    if (images.length === 0) return [];
    switch (method.type) {
      case 'stack': {
        const [image] = await ops.apply(method, images);
        return image === undefined ? [] : [{ ...base, image }];
      }
      case 'mean':
      case 'median':
        return [{ ...base, image: await ops.average(images, method.type) }];
      case 'animate': {
        const frames = await ops.frames(images);
        return [{ ...base, image: frames[0], animation: { frames, frameMs: method.frameMs, bounce: method.bounce } }];
      }
    }
  }))).flat();
  return normalize(input.dimensions.filter(d => by.includes(d.id)), cells);
};

/** All combinations of the members of `dimensions` (outer first) that some cell has. */
const combinations = <Img>(dimensions: Dimension[], cells: Cell<Img>[]): Member[][] => {
  let combos: Member[][] = [[]];
  for (const d of dimensions) {
    combos = combos.flatMap(c => d.members.map(m => [...c, m]));
  }
  return combos.filter(combo => cells.some(cell => combo.every((m, i) => cell.coords[dimensions[i].id] === m.key)));
};

const pageDimensionName = 'Page';

const evaluateLayout = async <Img>(node: CombineNode, layout: Layout, input: Cube<Img>, ops: ImageOps<Img>, options: EvaluateOptions): Promise<Cube<Img>> => {
  const by = combineBy(node, input.dimensions, input.cells);
  const groups = groupCells(input, by);
  const { frame, placement } = layout;
  const distribution = frame.type === 'page' ? frame.distribution : undefined;
  const spills = (distribution?.type === 'one-cell-per-image' && distribution.overflow === 'spill') || placement.type === 'imposition';
  const pageId = `${node.id}:page`;
  const unplaced = input.dimensions.filter(d => !by.includes(d.id));
  const label = (cell: Cell<Img>, d: Dimension) => d.members.find(m => m.key === cell.coords[d.id])?.label ?? '–';

  const results = await Promise.all(groups.map(async group => {
    const first = group.cells[0];
    const format = first?.frame ?? options.format;
    const full = pagePixels(format, first?.scale ?? 1).map(v => v + 2 * formatToPixels(format, format.bleed, first?.scale ?? 1));
    const scale = (first?.scale ?? 1) * (frame.type === 'page' && options.maxPageSize ? Math.min(1, options.maxPageSize / Math.max(...full)) : 1);
    const sizes = group.cells.map(c => ops.size ? ops.size(c.image) : [1, 1] as [number, number]);
    const context = { dpi: format.dpi, scale, shortSide: Math.min(...(sizes[0] ?? [0, 0])) };
    const gutter = resolveLength(layout.gutter, context);
    const cellLength = layout.size.type === 'width' || layout.size.type === 'height' ? resolveLength(layout.size.size, context) : undefined;
    const page: PageBox | undefined = frame.type === 'page' ? pageBoxOf(format, scale) : undefined;
    let plans: PagePlan[];
    if (placement.type === 'flow') {
      const captions = group.cells.map(c => unplaced.map(d => label(c, d)).join(' · '));
      plans = planFlow({ sizes, captions, layout, gutter, cellLength, page });
    } else if (placement.type === 'imposition') {
      // Imposition is for paper: the page is the format's, turned landscape.
      const box = page ?? pageBoxOf(format, scale);
      const landscape = box.width >= box.height ? box : { ...box, width: box.height, height: box.width };
      plans = planMiniZine({ sizes, fit: layout.fit, align: layout.align, gutter, page: landscape });
    } else {
      const rowDims = placement.rows.flatMap(id => input.dimensions.filter(d => d.id === id));
      const columnDims = placement.columns.flatMap(id => input.dimensions.filter(d => d.id === id));
      const rows = combinations(rowDims, group.cells);
      const columns = combinations(columnDims, group.cells);
      const matches = (cell: Cell<Img>, dims: Dimension[], combo: Member[]) => combo.every((m, i) => cell.coords[dims[i].id] === m.key);
      plans = planCrosstab({
        rows: rows.map(r => r.map(m => m.label)),
        columns: columns.map(c => c.map(m => m.label)),
        at: (r, c) => {
          const index = group.cells.findIndex(cell => matches(cell, rowDims, rows[r]) && matches(cell, columnDims, columns[c]));
          return index < 0 ? undefined : index;
        },
        sizes, fit: layout.fit, align: layout.align, headers: layout.labels === 'headers', gutter, page,
        overflow: distribution?.type === 'one-cell-per-image' ? distribution.overflow : 'spill',
      }).map(p => withReading(p, layout.reading));
    }
    if (options.onPlaced && page) {
      for (const plan of plans) {
        for (const placed of plan.images) {
          const cell = group.cells[placed.index];
          const [w, h] = sizes[placed.index] ?? [1, 1];
          const drawn = placed.fit === 'cover' ? Math.max(placed.w / w, placed.h / h) : Math.min(placed.w / w, placed.h / h);
          // Back to photo pixels: the cell's image has `scale` pixels per photo pixel; the page was drawn at `scale` too.
          options.onPlaced({ photo: cell.coords[PHOTO], photoScale: drawn * (cell.scale ?? 1) / scale, format });
        }
      }
    }
    const images = await Promise.all(plans.map(plan => ops.compose(plan, group.cells.map(c => c.image))));
    return images.map((image, k): Cell<Img> => ({
      coords: { ...group.coords, ...(spills ? { [pageId]: `${k + 1}` } : {}) },
      image,
      scale,
      frame: page || placement.type === 'imposition' ? format : undefined,
    }));
  }));
  const cells = results.flat();
  const byDimensions = input.dimensions.filter(d => by.includes(d.id));
  const pages = Math.max(0, ...results.map(r => r.length));
  const dimensions = spills
    ? [...byDimensions, {
      id: pageId,
      name: uniqueName(pageDimensionName, byDimensions),
      members: Array.from({ length: pages }, (_, k) => ({ key: `${k + 1}`, label: `${k + 1}` })),
    }]
    : byDimensions;
  return normalize(dimensions, cells);
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
