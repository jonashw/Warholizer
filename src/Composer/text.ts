import { isLength } from "../Warholizer/RasterOperations/PureRasterOperation/length";
import { PureRasterOperation } from "../Warholizer/RasterOperations/PureRasterOperation/types";
import { Composition, Node, Spread, VariationDistribution } from "./types";

/** "gradientMap" → "gradient-map". */
const kebab = (s: string) => s.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();

const value = (v: unknown): string => {
  if (Array.isArray(v)) return `[${v.map(value).join(' ')}]`;
  if (isLength(v)) return `${v.value} ${v.unit}`;
  if (v !== null && typeof v === 'object') {
    // A sum type: its tag, then its fields, e.g. match(reference: first).
    const { type, ...rest } = v as Record<string, unknown>;
    const fields = Object.entries(rest).map(([k, x]) => `${kebab(k)}: ${value(x)}`).join(' ');
    return type === undefined ? `(${fields})` : `${kebab(String(type))}${fields ? `(${fields})` : ''}`;
  }
  if (typeof v === 'string' && /\s/.test(v)) return JSON.stringify(v);
  return String(v);
};

const args = (o: Record<string, unknown>) =>
  Object.entries(o)
    .filter(([, v]) => v !== undefined)
    .map(([k, v]) => ` ${kebab(k)}: ${value(v)}`)
    .join('');

const operation = (op: PureRasterOperation) => {
  const { type, ...rest } = op;
  return kebab(type) + args(rest);
};

export const distributionText = (d: VariationDistribution): string =>
  d.type === 'all-per-image' ? 'all-per-image'
  : d.order.type === 'in-turn' ? 'one-per-image(in-turn)'
  : `one-per-image(shuffled(seed: ${d.order.seed}))`;

const spreadText = (s: Spread) =>
  `${s.bind ? `${s.bind} <- ` : ''}${kebab(s.param)}: ${s.from}..${s.to}${s.unit && s.unit !== 'px' ? ` ${s.unit}` : ''} ${s.type === 'count' ? `count: ${s.n}` : `skip-by: ${s.by}`}`;

const lines = (node: Node, depth: number): string[] => {
  const indent = '  '.repeat(depth);
  const nested = (children: Node[]) => children.flatMap(c => lines(c, depth + 1));
  switch (node.kind) {
    case 'operation': return [indent + operation(node.op) + (node.by ? ` by: [${node.by.join(' ')}]` : '')];
    case 'sequence': return [indent + 'sequence', ...nested(node.children)];
    case 'variations': {
      const head = `${indent}variations ${distributionText(node.distribution)}${node.bind ? ` ${node.bind} <-` : ''}`;
      if (node.variants.type === 'list') {
        return [head, ...nested(node.variants.children)];
      }
      return [
        head,
        `${indent}  spread ${operation(node.variants.op)}`,
        ...node.variants.params.map(s => `${indent}    ${spreadText(s)}`),
      ];
    }
    case 'combine': {
      const { method } = node;
      const by = node.by ? ` by: [${node.by.join(' ')}]` : '';
      if (method.type === 'crosstab') {
        return [`${indent}crosstab rows: ${method.rows} columns: ${method.columns}${method.labels ? '' : ' labels: false'}${by}`];
      }
      return [indent + operation(method) + by];
    }
    case 'pick': return [`${indent}pick ${node.dimension} ${Array.isArray(node.members) ? `in: [${node.members.join(' ')}]` : `= ${node.members}`}`];
    case 'pivot': return [`${indent}pivot [${node.order.join(' ')}]`];
  }
};

/**
 * The read-only text view (ADR 0003): indentation-based s-expressions, one node per line,
 * children indented. Dimensions are referred to by id.
 */
export const compositionText = (composition: Composition): string =>
  lines(composition.root, 0).join('\n');
