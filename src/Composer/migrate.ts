import { Composition, Layout, Node } from "./types";

/** A Tile, Line or Crosstab written before Layout (ADR 0003): its Layout. */
const legacyLayout = (method: Record<string, unknown>): Layout | undefined => {
  const base: Layout = {
    type: 'layout', placement: { type: 'flow' }, size: { type: 'across', n: 3 }, fit: 'contain', align: 'center',
    pattern: 'normal', gutter: 0, labels: 'none', reading: { horizontal: 'ltr', vertical: 'ttb' }, frame: { type: 'free' },
  };
  switch (method.type) {
    case 'tile': return {
      ...base,
      size: method.primaryDimension === 'y' ? { type: 'down', n: Number(method.lineLength) } : { type: 'across', n: Number(method.lineLength) },
    };
    case 'line': return {
      ...base,
      size: method.direction === 'down' || method.direction === 'up' ? { type: 'down', n: 'all' } : { type: 'across', n: 'all' },
      fit: method.squish ? 'justified' : 'natural',
      reading: { horizontal: method.direction === 'left' ? 'rtl' : 'ltr', vertical: method.direction === 'up' ? 'btt' : 'ttb' },
    };
    case 'crosstab': return {
      ...base,
      placement: { type: 'by-dimensions', rows: [String(method.rows)], columns: [String(method.columns)] },
      labels: method.labels === false ? 'none' : 'headers',
    };
    default: return undefined;
  }
};

const migrateNode = (node: Node): Node => {
  if (node.kind === 'combine') {
    const layout = legacyLayout(node.method as unknown as Record<string, unknown>);
    if (layout) return { ...node, method: layout };
    // Layouts saved before reading direction read left to right, top to bottom.
    if (node.method.type === 'layout' && !node.method.reading) {
      return { ...node, method: { ...node.method, reading: { horizontal: 'ltr', vertical: 'ttb' } } };
    }
    return node;
  }
  if (node.kind === 'sequence') return { ...node, children: node.children.map(migrateNode) };
  if (node.kind === 'variations') {
    // Distributions were renamed with both nouns (ADR 0003): all-per-image, one-per-image.
    const type = node.distribution.type as string;
    const distribution = type === 'all-per-image' ? { type: 'all-variants-per-image' as const }
      : type === 'one-per-image' ? { ...node.distribution, type: 'one-variant-per-image' as const } as typeof node.distribution
      : node.distribution;
    const variants = node.variants.type === 'list' ? { type: 'list' as const, children: node.variants.children.map(migrateNode) } : node.variants;
    return { ...node, distribution, variants };
  }
  return node;
};

/** Brings a saved composition up to the current model. */
export const migrateComposition = (composition: Composition): Composition =>
  ({ ...composition, root: migrateNode(composition.root) as Composition['root'] });
