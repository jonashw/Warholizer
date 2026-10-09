import { LengthUnit, Line, PureRasterOperation, Stack, Tile } from "../Warholizer/RasterOperations/PureRasterOperation/types";

/**
 * Composer documents (ADR 0003). A Composition is a tree of nodes; every node takes a cube of
 * images and returns a cube. The document is plain JSON: this file is also its canonical format.
 */
export type Composition = {
  version: 1,
  name: string,
  root: SequenceNode,
};

/** Every node has a stable id; dimensions are identified by the node (and parameter) that created them. */
export type NodeId = string;

export type Node =
  | OperationNode
  | SequenceNode
  | VariationsNode
  | CombineNode
  | PickNode
  | PivotNode;

/**
 * An Effect (image → image) or a Separate (image → parts), depending on the operation.
 * Group-aware effects (Tone) compute statistics per group of the `by` dimensions (one group of
 * everything when absent).
 */
export type OperationNode = { kind: 'operation', id: NodeId, op: PureRasterOperation, by?: DimensionId[] };

export type SequenceNode = { kind: 'sequence', id: NodeId, children: Node[] };

export type VariationsNode = {
  kind: 'variations',
  id: NodeId,
  distribution: VariationDistribution,
  variants: Variants,
  /** Names the new dimension, like a comprehension variable; the derived name applies otherwise. */
  bind?: string,
};

export type VariationDistribution =
  | { type: 'all-per-image' }
  | { type: 'one-per-image', order: Order };

export type Order =
  | { type: 'in-turn' }
  | { type: 'shuffled', seed: number };

export type Variants =
  | { type: 'list', children: Node[] }
  | { type: 'spread', op: PureRasterOperation, params: Spread[] };

/** A numeric range of one parameter, divided by count or by step. Each adds one dimension. */
export type Spread =
  | { type: 'count', param: string, from: number, to: number, n: number, unit?: LengthUnit, bind?: string }
  | { type: 'skip-by', param: string, from: number, to: number, by: number, unit?: LengthUnit, bind?: string };

/** Images grouped by the `by` dimensions (all but the newest when absent), one result per group. */
export type CombineNode = { kind: 'combine', id: NodeId, method: CombineMethod, by?: DimensionId[] };

export type CombineMethod = Layout | Blend;
export type Layout = Tile | Line | Crosstab;
export type Blend = Stack;
export type CombineKind = 'layout' | 'blend';

/** A labeled grid: one dimension down the rows, another across the columns. */
export type Crosstab = { type: 'crosstab', rows: DimensionId, columns: DimensionId, labels: boolean };

/** One member removes the dimension (slice); a list keeps it (dice). */
export type PickNode = { kind: 'pick', id: NodeId, dimension: DimensionId, members: MemberKey | MemberKey[] };

/** Reorders dimensions; listed dimensions come first, in this order. */
export type PivotNode = { kind: 'pivot', id: NodeId, order: DimensionId[] };

export type DimensionId = string;
export type MemberKey = string;

export type Member = { key: MemberKey, label: string };
export type Dimension = { id: DimensionId, name: string, members: Member[] };

/**
 * One image at its coordinates; a dimension that does not apply to the cell is absent. `scale` is
 * the image's pixels per original photo pixel (below 1 in previews; 1 when absent), so sizes
 * resolve the same at every resolution.
 */
export type Cell<Img> = { coords: Record<DimensionId, MemberKey>, image: Img, scale?: number };

export type Cube<Img> = { dimensions: Dimension[], cells: Cell<Img>[] };

export const PHOTO: DimensionId = 'photo';

export const combineKindOf = (method: CombineMethod): CombineKind =>
  method.type === 'stack' ? 'blend' : 'layout';
