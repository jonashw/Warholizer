import { byte } from "../NumberTypes";
import { PureRasterOperation } from "../Warholizer/RasterOperations/PureRasterOperation/types";
import { CombineMethod, Composition, DimensionId, Node, PHOTO, Spread, VariationDistribution } from "./types";

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
    combine({ type: 'tile', primaryDimension: 'x', lineLength: 3 }, [PHOTO]),
  ),
});

export const emptyComposition = (): Composition => ({ version: 1, name: 'Untitled', root: sequence() });
