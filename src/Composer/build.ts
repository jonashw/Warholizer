import { byte } from "../NumberTypes";
import { PureRasterOperation } from "../Warholizer/RasterOperations/PureRasterOperation/types";
import { CombineMethod, Composition, DimensionId, Format, Layout, Node, PHOTO, Spread, VariationDistribution } from "./types";

/** A short id, unique within a document. */
export const newId = (): string => crypto.randomUUID().slice(0, 8);

export const operationNode = (op: PureRasterOperation): Node => ({ kind: 'operation', id: newId(), op });

export const sequence = (...children: Node[]): Node & { kind: 'sequence' } => ({ kind: 'sequence', id: newId(), children });

export const allPerImage: VariationDistribution = { type: 'all-per-image' };
export const inTurn: VariationDistribution = { type: 'one-per-image', order: { type: 'in-turn' } };
export const shuffled = (seed: number): VariationDistribution => ({ type: 'one-per-image', order: { type: 'shuffled', seed } });

export const variationsList = (distribution: VariationDistribution, ...children: Node[]): Node => ({
  kind: 'variations', id: newId(), distribution, variants: { type: 'list', children },
});

export const variationsSpread = (distribution: VariationDistribution, op: PureRasterOperation, ...params: Spread[]): Node => ({
  kind: 'variations', id: newId(), distribution, variants: { type: 'spread', op, params },
});

export const combine = (method: CombineMethod, by?: DimensionId[]): Node => ({ kind: 'combine', id: newId(), method, by });

/** A Layout with everything at its default: a free tile, three across. */
export const layout = (changes: Partial<Layout> = {}): Layout => ({
  type: 'layout', placement: { type: 'flow' }, size: { type: 'across', n: 3 }, fit: 'contain', align: 'center',
  pattern: 'normal', gutter: 0, labels: 'none', frame: { type: 'free' }, ...changes,
});

/** The entry points the editor offers for Layout. */
export type LayoutPreset = 'tile' | 'line' | 'crosstab' | 'sheet';

export const presetOf = (l: Layout): LayoutPreset =>
  l.placement.type === 'by-dimensions' ? 'crosstab'
  : l.frame.type === 'page' ? 'sheet'
  : (l.size.type === 'across' || l.size.type === 'down') && l.size.n === 'all' ? 'line'
  : 'tile';

/** Switches entry point, keeping the settings they share. */
export const withPreset = (l: Layout, preset: LayoutPreset, dims: { id: DimensionId }[]): Layout => {
  const flow: Layout = { ...l, placement: { type: 'flow' } };
  switch (preset) {
    case 'tile': return { ...flow, frame: { type: 'free' }, size: l.size.type === 'across' && l.size.n !== 'all' ? l.size : { type: 'across', n: 3 } };
    case 'line': return { ...flow, frame: { type: 'free' }, size: { type: 'across', n: 'all' }, fit: l.fit === 'contain' ? 'natural' : l.fit };
    case 'sheet': return { ...flow, frame: { type: 'page', distribution: { type: 'one-cell-per-image', overflow: 'spill' } },
      size: l.size.type === 'across' && l.size.n !== 'all' ? l.size : { type: 'across', n: 3 } };
    case 'crosstab': return {
      ...l, pattern: 'normal', labels: 'headers',
      placement: { type: 'by-dimensions', rows: dims.length > 1 ? [dims[dims.length - 2].id] : [], columns: dims.length ? [dims[dims.length - 1].id] : [] },
    };
  }
};

export const newSeed = () => Math.floor(Math.random() * 1_000_000);

/** Shadow → background pairs sampled from docs/references/warhol-duotone-grid-giraffe.jpg. */
export const warholDuotones: [string, string][] = [
  ['#183a65', '#ff4137'],
  ['#850564', '#f3dd6d'],
  ['#012be5', '#00fcff'],
  ['#891c72', '#00e5c8'],
  ['#980405', '#88dbdf'],
  ['#077942', '#fef08d'],
];

/** The sample Composition: six duotones of each photo, tiled three across. */
export const warholDuotoneGrid = (): Composition => ({
  version: 1,
  name: 'Warhol duotone grid',
  root: sequence(
    operationNode({ type: 'levels', black: byte(0), white: byte(245), gamma: 1 }),
    variationsList(allPerImage, ...warholDuotones.map(([shadow, background]) =>
      operationNode({ type: 'gradientMap', stops: [shadow, background] }))),
    combine(layout(), [PHOTO]),
  ),
});

export const emptyComposition = (): Composition => ({ version: 1, name: 'Untitled', root: sequence() });

export const formatNode = (format: Format): Node => ({ kind: 'format', id: newId(), format });
