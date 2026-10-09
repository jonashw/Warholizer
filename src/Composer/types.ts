import { LengthUnit, PureRasterOperation, Size, Stack } from "../Warholizer/RasterOperations/PureRasterOperation/types";

/**
 * Composer documents (ADR 0003). A Composition is a tree of nodes; every node takes a cube of
 * images and returns a cube. The document is plain JSON: this file is also its canonical format.
 */
export type Composition = {
  version: 1,
  name: string,
  root: SequenceNode,
  /** The default frame for pages (Letter, portrait, 300 DPI when absent). */
  format?: Format,
  /** How results are written; defaults when absent. */
  export?: ExportSettings,
};

/** How results are written (ADR 0003, Export), not how they look. */
export type ExportSettings = {
  fileType: 'png' | 'jpeg' | 'pdf',
  /** PDF only: one file per page, or one document with every page. */
  pdf: 'one-per-page' | 'one-document',
  /** Proof renders at half resolution. */
  resolution: 'final' | 'proof',
};

/**
 * A named frame (ADR 0003, Formats): paper, a screen shape or a product. Sizes are in `unit`;
 * `dpi` turns physical units into pixels (and gives pixel formats a physical size).
 */
export type Format = {
  name: string,
  width: number,
  height: number,
  unit: 'in' | 'mm' | 'px',
  dpi: number,
  /** Printer margins: content stays inside. */
  margin: number,
  /** Extra image past the trim, on each side. */
  bleed: number,
  /** Keep important content this far inside the trim. */
  safe: number,
  background: 'white' | 'transparent',
};

/** Every node has a stable id; dimensions are identified by the node (and parameter) that created them. */
export type NodeId = string;

export type Node =
  | OperationNode
  | SequenceNode
  | VariationsNode
  | CombineNode
  | PickNode
  | PivotNode
  | FormatNode;

/** Sets the frame of the images after it; Variations of Format make Format a dimension. */
export type FormatNode = { kind: 'format', id: NodeId, format: Format };

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

/**
 * How variants meet images (ADR 0003; mirrors LayoutDistribution). Display names spell both
 * nouns: all variants per image, one variant per image, one image per variant.
 */
export type VariationDistribution =
  | { type: 'all-variants-per-image' }
  | { type: 'one-variant-per-image', order: Order }
  /** Each variant used once per round; images beyond one round spill into a Round dimension, are dropped, or pass through unchanged. */
  | { type: 'one-image-per-variant', order: Order, overflow: 'spill' | 'drop' | 'keep' };

export type Order =
  | { type: 'in-turn' }
  | { type: 'shuffled', seed: number };

export type Variants =
  | { type: 'list', children: Node[] }
  | { type: 'spread', op: PureRasterOperation, params: Spread[] };

/** A numeric range of one parameter, divided by count or by step. Each adds one dimension. */
export type Spread =
  /** n values from `from` to `to`; geometric spacing keeps equal ratios (4, 6, 9, 13…), for sizes. */
  | { type: 'count', param: string, from: number, to: number, n: number, spacing?: 'linear' | 'geometric', unit?: LengthUnit, bind?: string }
  | { type: 'skip-by', param: string, from: number, to: number, by: number, unit?: LengthUnit, bind?: string };

/** Images grouped by the `by` dimensions (all but the newest when absent), one result per group. */
export type CombineNode = { kind: 'combine', id: NodeId, method: CombineMethod, by?: DimensionId[] };

export type CombineMethod = Layout | Blend | Animate;
/** Overlay a group's images into one: stacked with a blend mode, or each pixel's mean or median. */
export type Blend = Stack | { type: 'mean' } | { type: 'median' };
/** A group's images become the frames of one animation, in cube order. */
export type Animate = { type: 'animate', frameMs: number, bounce: boolean };
export type CombineKind = 'layout' | 'blend' | 'animate';

/**
 * Images placed into a grid of layout cells (ADR 0003, Layout): Tile, Line, Crosstab and Sheet
 * are all Layouts. Positions come from cube order (flow) or from dimensions (a crosstab).
 */
export type Layout = {
  type: 'layout',
  placement: Placement,
  size: LayoutSize,
  fit: Fit,
  align: Align,
  pattern: Pattern,
  gutter: Size,
  labels: 'none' | 'captions' | 'headers',
  /** Which way order runs: left to right or right to left; top to bottom or bottom to top. */
  reading: Reading,
  frame: LayoutFrame,
};

export type Reading = { horizontal: 'ltr' | 'rtl', vertical: 'ttb' | 'btt' };

export type Placement =
  | { type: 'flow' }
  | { type: 'by-dimensions', rows: DimensionId[], columns: DimensionId[] }
  /** Pages arranged for folding: the 8-page mini-zine from one sheet (pages in cube order, cover first). */
  | { type: 'imposition', scheme: 'mini-zine-8' };

/** How big each cell is: so many across or down (all: one line), or a width or height. */
export type LayoutSize =
  | { type: 'across', n: number | 'all' }
  | { type: 'down', n: number | 'all' }
  | { type: 'width', size: Size }
  | { type: 'height', size: Size };

/** When an image's shape differs from its cell's. Justified: equal heights per row filling the width (Across). */
export type Fit = 'contain' | 'cover' | 'natural' | 'justified';
export type Align = 'start' | 'center' | 'end';
export type Pattern = 'normal' | 'half-drop' | 'half-brick' | 'mirror' | 'wacky';

/** Free: grows with its content. Page: the images' format, filled by a distribution. */
export type LayoutFrame = { type: 'free' } | { type: 'page', distribution: LayoutDistribution };

/** Mirrors VariationDistribution (ADR 0003): images and cells instead of variants and images. */
export type LayoutDistribution =
  | { type: 'one-cell-per-image', overflow: 'spill' | 'shrink' }
  | { type: 'one-image-per-cell', order: Order, edges: 'whole-copies' | 'bleed' };

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
 * resolve the same at every resolution. An animated cell's image is its first frame.
 */
export type Cell<Img> = {
  coords: Record<DimensionId, MemberKey>, image: Img, scale?: number, frame?: Format,
  animation?: { frames: Img[], frameMs: number, bounce: boolean },
};

export type Cube<Img> = { dimensions: Dimension[], cells: Cell<Img>[] };

export const PHOTO: DimensionId = 'photo';

export const combineKindOf = (method: CombineMethod): CombineKind =>
  method.type === 'layout' ? 'layout' : method.type === 'animate' ? 'animate' : 'blend';
