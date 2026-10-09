import { Node, NodeId, SequenceNode } from "./types";

/** Child nodes a node contains (a spread's variants are generated, not contained). */
export const childrenOf = (node: Node): Node[] =>
  node.kind === 'sequence' ? node.children
  : node.kind === 'variations' && node.variants.type === 'list' ? node.variants.children
  : [];

const withChildren = (node: Node, children: Node[]): Node =>
  node.kind === 'sequence' ? { ...node, children }
  : node.kind === 'variations' && node.variants.type === 'list' ? { ...node, variants: { type: 'list', children } }
  : node;

export const findNode = (root: Node, id: NodeId): Node | undefined => {
  if (root.id === id) return root;
  for (const child of childrenOf(root)) {
    const found = findNode(child, id);
    if (found) return found;
  }
  return undefined;
};

export const parentOf = (root: Node, id: NodeId): { parent: Node, index: number } | undefined => {
  const children = childrenOf(root);
  const index = children.findIndex(c => c.id === id);
  if (index >= 0) return { parent: root, index };
  for (const child of children) {
    const found = parentOf(child, id);
    if (found) return found;
  }
  return undefined;
};

/** `root` with the node `id` replaced by `update(node)`. */
export const updateNode = (root: Node, id: NodeId, update: (node: Node) => Node): Node => {
  if (root.id === id) return update(root);
  const children = childrenOf(root);
  if (children.length === 0) return root;
  const updated = children.map(c => updateNode(c, id, update));
  return updated.every((c, i) => c === children[i]) ? root : withChildren(root, updated);
};

export const removeNode = (root: Node, id: NodeId): Node => {
  const location = parentOf(root, id);
  if (!location) return root;
  return updateNode(root, location.parent.id, parent =>
    withChildren(parent, childrenOf(parent).filter(c => c.id !== id)));
};

export const insertNode = (root: Node, parentId: NodeId, index: number, node: Node): Node =>
  updateNode(root, parentId, parent => {
    const children = [...childrenOf(parent)];
    children.splice(Math.max(0, Math.min(index, children.length)), 0, node);
    return withChildren(parent, children);
  });

/** Moves a node one place earlier (-1) or later (+1) among its siblings. */
export const moveNode = (root: Node, id: NodeId, delta: -1 | 1): Node => {
  const location = parentOf(root, id);
  if (!location) return root;
  const children = [...childrenOf(location.parent)];
  const target = location.index + delta;
  if (target < 0 || target >= children.length) return root;
  [children[location.index], children[target]] = [children[target], children[location.index]];
  return updateNode(root, location.parent.id, parent => withChildren(parent, children));
};

export const asSequence = (node: Node): SequenceNode =>
  node.kind === 'sequence' ? node : { kind: 'sequence', id: node.id, children: [node] };
