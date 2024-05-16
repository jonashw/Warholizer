export type GraphData = {
  nodes: GraphNode[];
  links: GraphLink[];
};
export type GraphLink = {source:string, target: string};
export type GraphNode = {id:string,label: string};