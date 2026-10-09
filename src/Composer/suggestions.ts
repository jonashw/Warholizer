import { operationRegistry } from "../Warholizer/RasterOperations/PureRasterOperation/registry";
import { PureRasterOperation } from "../Warholizer/RasterOperations/PureRasterOperation/types";
import { Trace } from "./evaluate";
import { Placeholder } from "./infer";
import { numericParamOf } from "./spread";
import { childrenOf, removeNode, updateNode } from "./tree";
import { Node, NodeId, OperationNode, SequenceNode, VariationsNode } from "./types";

/**
 * In-app suggestions and checks (docs/knowledge/usage-patterns.md): patterns in a composition's
 * structure that suggest a clearer form, or a probable mistake. Structure only, never images
 * (docs/principles.md). Each may carry a one-tap fix.
 */
export type Suggestion = {
  id: string,
  nodeId: NodeId,
  kind: 'warning' | 'suggestion',
  title: string,
  detail: string,
  apply?: (root: SequenceNode) => SequenceNode,
};

const sameOp = (a: PureRasterOperation, b: PureRasterOperation) => JSON.stringify(a) === JSON.stringify(b);

const allNodes = (node: Node): Node[] => [node, ...childrenOf(node).flatMap(allNodes)];

/** Variations of one operation differing in one evenly spaced numeric setting: a Spread written out by hand. */
const listToSpread = (node: VariationsNode): Suggestion | undefined => {
  if (node.variants.type !== 'list' || node.variants.children.length < 3) return undefined;
  const ops = node.variants.children.map(c => c.kind === 'operation' ? c.op : undefined);
  if (ops.some(op => !op || op.type !== ops[0]!.type)) return undefined;
  const typed = ops as PureRasterOperation[];
  const params = Object.keys(typed[0]).filter(k => k !== 'type' && typed.some(op => JSON.stringify((op as Record<string, unknown>)[k]) !== JSON.stringify((typed[0] as Record<string, unknown>)[k])));
  if (params.length !== 1 || !numericParamOf(typed[0].type, params[0])) return undefined;
  const param = params[0];
  const values = typed.map(op => (op as Record<string, unknown>)[param]);
  if (!values.every(v => typeof v === 'number')) return undefined;
  const sorted = [...values as number[]].sort((a, b) => a - b);
  const step = sorted[1] - sorted[0];
  const even = step > 0 && sorted.every((v, i) => Math.abs(v - (sorted[0] + i * step)) < 1e-6);
  if (!even) return undefined;
  return {
    id: `spread:${node.id}`, nodeId: node.id, kind: 'suggestion',
    title: 'This is a spread',
    detail: `${sorted.length} values of ${param} from ${sorted[0]} to ${sorted[sorted.length - 1]}: a Spread keeps them editable as one range.`,
    apply: root => updateNode(root, node.id, n => ({
      ...(n as VariationsNode),
      variants: { type: 'spread', op: typed[0], params: [{ type: 'count', param, from: sorted[0], to: sorted[sorted.length - 1], n: sorted.length }] },
    })) as SequenceNode,
  };
};

/** Repeated variants (A B C A B C): usually written to make counts match, which cycling already does. */
const repeatedVariants = (node: VariationsNode): Suggestion | undefined => {
  if (node.variants.type !== 'list') return undefined;
  const children = node.variants.children;
  const ops = children.map(c => c.kind === 'operation' ? c.op : undefined);
  if (ops.some(op => !op)) return undefined;
  const unique: OperationNode[] = [];
  children.forEach(c => { if (!unique.some(u => sameOp(u.op, (c as OperationNode).op))) unique.push(c as OperationNode); });
  if (unique.length === children.length) return undefined;
  const cycling = node.distribution.type === 'one-variant-per-image' && node.distribution.order.type === 'in-turn';
  return {
    id: `repeats:${node.id}`, nodeId: node.id, kind: 'suggestion',
    title: 'Variants repeat',
    detail: cycling
      ? `${children.length} variants, ${unique.length} different: one variant per image already cycles, so the repeats can go (same result).`
      : `${children.length} variants, ${unique.length} different. To reuse variants across images, keep one of each and use one variant per image, in turn.`,
    apply: root => updateNode(root, node.id, n => ({
      ...(n as VariationsNode),
      distribution: { type: 'one-variant-per-image', order: { type: 'in-turn' } },
      variants: { type: 'list', children: unique },
    })) as SequenceNode,
  };
};

/** Variations followed by picking one of them: only that variant matters. */
const pickAfterVariations = (sequence: SequenceNode): Suggestion[] =>
  sequence.children.flatMap((node, i): Suggestion[] => {
    const next = sequence.children[i + 1];
    if (node.kind !== 'variations' || node.variants.type !== 'list' || !next || next.kind !== 'pick'
      || next.dimension !== node.id || Array.isArray(next.members)) return [];
    const chosen = node.variants.children.find(c => c.id === next.members);
    if (!chosen) return [];
    return [{
      id: `pick:${node.id}`, nodeId: next.id, kind: 'suggestion',
      title: 'Only one variant is kept',
      detail: 'Pick keeps one variant of the step before it; the step can just be that variant (same result, less rendering).',
      apply: root => removeNode(updateNode(root, node.id, () => chosen), next.id) as SequenceNode,
    }];
  });

const geometryKinds = new Set(['geometry']);

/** A geometry step after a page changes the page, so it may no longer fit its paper. */
const geometryAfterPage = (node: Node, trace: Trace<Placeholder> | undefined): Suggestion | undefined => {
  if (node.kind !== 'operation' || !geometryKinds.has(operationRegistry[node.op.type].kind)) return undefined;
  const input = trace?.get(node.id)?.input;
  const page = input?.cells.find(c => c.frame)?.frame;
  if (!page) return undefined;
  return {
    id: `geometry:${node.id}`, nodeId: node.id, kind: 'warning',
    title: `Changes a ${page.name} page`,
    detail: `${operationRegistry[node.op.type].label} after a Sheet resizes or reshapes the page, so it may no longer print at ${page.name}. Move it before the layout to change the images instead.`,
  };
};

/** Per-pixel color effects right after a free layout read the same before it, on smaller images. */
const colorAfterLayout = (sequence: SequenceNode): Suggestion[] =>
  sequence.children.flatMap((node, i): Suggestion[] => {
    const previous = sequence.children[i - 1];
    if (node.kind !== 'operation' || operationRegistry[node.op.type].kind !== 'tone' || operationRegistry[node.op.type].groupAware) return [];
    if (!previous || previous.kind !== 'combine' || previous.method.type !== 'layout') return [];
    if (previous.method.frame.type !== 'free' || previous.method.labels !== 'none') return [];
    return [{
      id: `move:${node.id}`, nodeId: node.id, kind: 'suggestion',
      title: 'Works the same before the layout',
      detail: `${operationRegistry[node.op.type].label} changes each pixel on its own, so it gives the same result before the layout, on each image instead of the whole canvas.`,
      apply: root => {
        const children = [...root.children];
        [children[i - 1], children[i]] = [children[i], children[i - 1]];
        return { ...root, children };
      },
    }];
  });

/** Mixed shapes contained in uniform cells leave bands; justified rows fit together. */
const mixedShapesContained = (node: Node, trace: Trace<Placeholder> | undefined): Suggestion | undefined => {
  if (node.kind !== 'combine' || node.method.type !== 'layout') return undefined;
  const layout = node.method;
  if (layout.fit !== 'contain' || layout.placement.type !== 'flow' || layout.size.type !== 'across') return undefined;
  const cells = trace?.get(node.id)?.input.cells ?? [];
  const aspects = cells.map(c => c.image.width / Math.max(1, c.image.height));
  if (aspects.length < 2 || Math.max(...aspects) / Math.min(...aspects) < 1.3) return undefined;
  return {
    id: `justify:${node.id}`, nodeId: node.id, kind: 'suggestion',
    title: 'Shapes differ: try Justified',
    detail: 'Contain leaves bands around images of different shapes. Justified rows give every image in a row the same height and fill the width, keeping shapes.',
    apply: root => updateNode(root, node.id, n => ({ ...n, method: { ...layout, fit: 'justified' } }) as Node) as SequenceNode,
  };
};

export const suggestionsFor = (root: SequenceNode, trace?: Trace<Placeholder>): Suggestion[] => {
  const nodes = allNodes(root);
  const sequences = nodes.filter((n): n is SequenceNode => n.kind === 'sequence');
  return [
    ...nodes.flatMap(n => [geometryAfterPage(n, trace), mixedShapesContained(n, trace)]),
    ...nodes.flatMap(n => n.kind === 'variations' ? [listToSpread(n), repeatedVariants(n)] : []),
    ...sequences.flatMap(pickAfterVariations),
    ...sequences.flatMap(s => s === root ? colorAfterLayout(s) : []),
  ].filter((s): s is Suggestion => s !== undefined);
};
