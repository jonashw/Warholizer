import { isGroupAware } from "../Warholizer/RasterOperations/PureRasterOperation/registry";
import { DimensionId, MemberKey, Node, PHOTO } from "./types";

/**
 * Pick pushdown (ADR 0003, future direction 3): when a Pick later in a sequence keeps only some
 * members of a dimension, the step that creates the dimension (a Variations, or the input's Photo)
 * computes only those members. Allowed only when the result is provably the same: every step in
 * between treats each member independently.
 */
export type Pushdown = {
  /** Photos to keep from the start of the sequence. */
  photos?: Set<MemberKey>,
  /** For a child index: the members its Variations needs to compute, by dimension. */
  variations: Map<number, Map<DimensionId, Set<MemberKey>>>,
};

/** Whether a step treats each member of `dimension` on its own (so fewer members change nothing else). */
const independent = (node: Node, dimension: DimensionId): boolean => {
  switch (node.kind) {
    case 'operation': return !isGroupAware(node.op) || (node.by ?? []).includes(dimension);
    case 'sequence': return node.children.every(c => independent(c, dimension));
    // Dealt distributions assign variants by position, which changes when cells are left out.
    case 'variations': return node.distribution.type === 'all-variants-per-image'
      && (node.variants.type === 'spread' || node.variants.children.every(c => independent(c, dimension)));
    case 'combine': return (node.by ?? []).includes(dimension);
    case 'pick':
    case 'pivot':
    case 'format': return true;
  }
};

/** The dimensions a Variations creates. */
const createdBy = (node: Node): DimensionId[] =>
  node.kind !== 'variations' ? []
  : node.variants.type === 'list' ? [node.id]
  : node.variants.params.map(p => `${node.id}:${p.param}`);

export const pushdownFor = (children: Node[]): Pushdown => {
  const result: Pushdown = { variations: new Map() };
  children.forEach((pick, j) => {
    if (pick.kind !== 'pick') return;
    const keep = new Set(Array.isArray(pick.members) ? pick.members : [pick.members]);
    const origin = pick.dimension === PHOTO ? -1 : children.findIndex((c, i) => i < j && createdBy(c).includes(pick.dimension));
    if (origin < -1 || (origin === -1 && pick.dimension !== PHOTO)) return;
    if (origin >= 0) {
      const creator = children[origin];
      if (creator.kind !== 'variations' || creator.distribution.type !== 'all-variants-per-image') return;
    }
    if (!children.slice(origin + 1, j).every(c => independent(c, pick.dimension))) return;
    const intersect = (current: Set<MemberKey> | undefined) => current ? new Set([...current].filter(k => keep.has(k))) : keep;
    if (origin === -1) {
      result.photos = intersect(result.photos);
    } else {
      const forChild = result.variations.get(origin) ?? new Map<DimensionId, Set<MemberKey>>();
      forChild.set(pick.dimension, intersect(forChild.get(pick.dimension)));
      result.variations.set(origin, forChild);
    }
  });
  return result;
};
