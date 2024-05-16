export type DirectedGraphData<TNode, TLink> = {
  nodes: DirectedGraphNode<TNode>[];
  links: DirectedGraphLink<TLink>[];
}
export type DirectedGraphNode<T> = {id:string} & T;
export type DirectedGraphLink<T> = {source:string, target: string} & T;