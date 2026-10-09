import { Composition, Layout, Node } from "./types";

/** A Tile, Line or Crosstab written before Layout (ADR 0003): its Layout. */
const legacyLayout = (method: Record<string, unknown>): Layout | undefined => {
  const base: Layout = {
    type: 'layout', placement: { type: 'flow' }, size: { type: 'across', n: 3 }, fit: 'contain', align: 'center',
    pattern: 'normal', gutter: 0, labels: 'none', frame: { type: 'free' },
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
    return layout ? { ...node, method: layout } : node;
  }
  if (node.kind === 'sequence') return { ...node, children: node.children.map(migrateNode) };
  if (node.kind === 'variations' && node.variants.type === 'list') {
    return { ...node, variants: { type: 'list', children: node.variants.children.map(migrateNode) } };
  }
  return node;
};

/** Brings a saved composition up to the current model. */
export const migrateComposition = (composition: Composition): Composition =>
  ({ ...composition, root: migrateNode(composition.root) as Composition['root'] });
