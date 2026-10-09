import { stringRepresentation } from "../../Warholizer/RasterOperations/PureRasterOperation/stringRepresentation";
import { combineMethodLabel, isSeparation, operationLabel } from "../labels";
import { formatSummary } from "../formats";
import { formatSize } from "../../Warholizer/RasterOperations/PureRasterOperation/length";
import { combineKindOf, Dimension, Node, VariationDistribution } from "../types";

/** What kind of step a node is, in the vocabulary of ADR 0003. */
export const kindLabel = (node: Node): string => {
  switch (node.kind) {
    case 'operation': return isSeparation(node.op) ? 'Separate' : 'Effect';
    case 'sequence': return 'Sequence';
    case 'variations': return node.variants.type === 'spread' ? 'Variations · Spread' : 'Variations · List';
    case 'combine': return `Combine · ${combineKindOf(node.method) === 'blend' ? 'Blend' : 'Layout'}`;
    case 'pick': return 'Pick';
    case 'pivot': return 'Pivot';
    case 'format': return 'Format';
  }
};

export const distributionLabel = (d: VariationDistribution): string =>
  d.type === 'all-per-image' ? 'all per image'
  : d.order.type === 'in-turn' ? 'one per image, in turn'
  : 'one per image, shuffled';

const dimensionName = (dimensions: Dimension[], id: string) =>
  dimensions.find(d => d.id === id)?.name ?? (id === 'photo' ? 'Photo' : '?');

/** One line under a step's name: its settings, readable at a glance. */
export const nodeSummary = (node: Node, dimensions: Dimension[]): string => {
  switch (node.kind) {
    case 'operation': {
      const text = stringRepresentation(node.op);
      const open = text.indexOf('(');
      return open < 0 ? '' : text.slice(open + 1, -1);
    }
    case 'sequence': return `${node.children.length} steps`;
    case 'variations': return node.variants.type === 'list'
      ? `${node.variants.children.length} variants · ${distributionLabel(node.distribution)}`
      : `${node.variants.params.map(p => `${p.param} ${p.from}..${p.to} ${p.type === 'count' ? `×${p.n}` : `every ${p.by}`}`).join(' · ')} · ${distributionLabel(node.distribution)}`;
    case 'combine': {
      const by = node.by ? node.by.map(id => dimensionName(dimensions, id)).join(', ') || 'everything' : 'auto';
      const m = node.method;
      if (m.type !== 'layout') return `${m.blendingMode} · by ${by}`;
      const names = (ids: string[]) => ids.map(id => dimensionName(dimensions, id)).join(' × ') || 'none';
      const where = m.placement.type === 'by-dimensions'
        ? `${names(m.placement.rows)} down, ${names(m.placement.columns)} across`
        : m.size.type === 'across' || m.size.type === 'down' ? `${m.size.n} ${m.size.type}` : `${m.size.type} ${formatSize(m.size.size)}`;
      const page = m.frame.type === 'page'
        ? (m.frame.distribution.type === 'one-cell-per-image' ? ` · each once, ${m.frame.distribution.overflow}` : ' · fill the page')
        : '';
      return `${where}${page} · by ${by}`;
    }
    case 'format': return formatSummary(node.format);
    case 'pick': {
      const name = dimensionName(dimensions, node.dimension);
      return Array.isArray(node.members) ? `${name} in ${node.members.length}` : `${name} = one`;
    }
    case 'pivot': return node.order.map(id => dimensionName(dimensions, id)).join(', ') + ' first';
  }
};

/** Colors that make a step recognizable in the flow (gradient maps, fills, palettes). */
export const nodeSwatches = (node: Node): string[] => {
  if (node.kind === 'operation') {
    const op = node.op;
    if (op.type === 'gradientMap') return op.stops;
    if (op.type === 'fill' && op.color) return [String(op.color)];
    return [];
  }
  if (node.kind === 'variations' && node.variants.type === 'list') {
    return node.variants.children.flatMap(c => {
      const s = nodeSwatches(c);
      return s.length ? [s[s.length - 1]] : [];
    });
  }
  return [];
};

export const nodeTitle = (node: Node): string => {
  switch (node.kind) {
    case 'operation': return operationLabel(node.op);
    case 'variations': return node.variants.type === 'spread' ? `Spread ${operationLabel(node.variants.op)}` : 'Variations';
    case 'combine': return combineMethodLabel(node.method);
    case 'format': return node.format.name;
    case 'sequence': return 'Sequence';
    case 'pick': return 'Pick';
    case 'pivot': return 'Pivot';
  }
};
