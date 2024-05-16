import { ImageRecord } from "./ImageRecord";
import { PureRasterApplicatorRecord } from "./Warholizer/RasterOperations/PureRasterApplicator";
import { DirectedGraphData } from "./DirectedGraphData";

export type ApplicatorDirectedGraphData = 
  DirectedGraphData<
    ApplicatorDirectedGraphNode,
    ApplicatorDirectedGraphLink>;
export type ApplicatorDirectedGraphNode = {
  label: string,
  type: ApplicatorDirectedGraphNodeType
};
export type ApplicatorDirectedGraphNodeType =
  'image' | 'applicator' | 'operation';
export type ApplicatorDirectedGraphLink = object;

export const applicatorDirectedGraph = (
  inputs: ImageRecord[],
  applicators: PureRasterApplicatorRecord[]
): DirectedGraphData<
    ApplicatorDirectedGraphNode,
    ApplicatorDirectedGraphLink> => {
  const nodes: ApplicatorDirectedGraphNode[] = [
    ...inputs.map((input, i) => 
      ({
        type: 'image' as ApplicatorDirectedGraphNodeType,
        id: input.id,
        label: `Image #${i + 1}` 
      }))
    ,...applicators.map(a => 
      ({
        type: 'applicator' as ApplicatorDirectedGraphNodeType,
        id: a.id,
        label: a.type
      }))
    ,...applicators.flatMap(a => a.ops.map(o => 
      ({
        type: 'operation' as ApplicatorDirectedGraphNodeType,
        id: o.id,
        label: o.type
      })))
  ];

  const links: ApplicatorDirectedGraphLink[] = [
    ...applicators.slice(0,1).flatMap(firstApplicator => 
      inputs.flatMap(input => 
        ({
          source: input.id,
          target: firstApplicator.id
        })))
    ,...applicators.reduce((acc,a) => 
      ({
        prev: a,
        links: 
          acc.prev === undefined 
          ? acc.links
          : [
            ...acc.links 
            ,...[
              {
                source: acc.prev.id,
                target: a.id
              }
            ]
          ]
      }),
      {
        prev: undefined as PureRasterApplicatorRecord | undefined,
        links: [] as ApplicatorDirectedGraphLink[]
      }).links
    ,...applicators.flatMap(a => a.ops.map(op => 
      ({
        source: a.id,
        target: op.id
      })))
  ] as ApplicatorDirectedGraphLink[];

  return { links, nodes } as DirectedGraphData<ApplicatorDirectedGraphNode,ApplicatorDirectedGraphLink>;
};