import { ImageRecord } from "./ImageRecord";
import { PureRasterApplicatorRecord, PureRasterOperationRecord } from "./Warholizer/RasterOperations/PureRasterApplicator";
import { DirectedGraphData } from "./DirectedGraphData";
import { PureRasterOperations } from "./Warholizer/RasterOperations/PureRasterOperation";

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
  applicators: PureRasterApplicatorRecord[],
  relateOperationsBetweenApplicators: boolean = true
): DirectedGraphData<
    ApplicatorDirectedGraphNode,
    ApplicatorDirectedGraphLink> => {
  const outputId = crypto.randomUUID();
  const nodes: ApplicatorDirectedGraphNode[] = [
    {
      type:'image',
      id: outputId,
      label: 'Output'
    },
    ...inputs.map((input, i) => 
      ({
        type: 'image' as ApplicatorDirectedGraphNodeType,
        id: input.id,
        label: `Image #${i + 1}` 
      }))
    ,...(relateOperationsBetweenApplicators ? [] : applicators.map(a => 
      ({
        type: 'applicator' as ApplicatorDirectedGraphNodeType,
        id: a.id,
        label: a.type
      })))
    ,...applicators.flatMap(a => a.ops.map(o => 
      ({
        type: 'operation' as ApplicatorDirectedGraphNodeType,
        id: o.id,
        label: 
          relateOperationsBetweenApplicators
          ? `${a.type}: ${PureRasterOperations.stringRepresentation(o)}`
          : PureRasterOperations.stringRepresentation(o)
      })))
  ];

  const betweenAdjacentApplicatorOps =
    applicators.reduce((acc,a) => 
      ({
        prev: a,
        links: 
          acc.prev === undefined 
          ? acc.links
          : [
            ...acc.links,
            ...(() => {
              return acc.prev.ops.flatMap(opA =>
                a.ops.map(opB =>
                  ({
                    source: opA.id,
                    target: opB.id
                  })
                ));
            })()
          ]
      }),
      {
        prev: undefined as PureRasterApplicatorRecord | undefined,
        links: [] as ApplicatorDirectedGraphLink[]
      }).links
  const betweenApplicators = 
    applicators.reduce((acc,a) => 
      ({
        prev: a,
        links: 
          acc.prev === undefined 
          ? acc.links
          : [
            ...acc.links,
            {
              source: acc.prev.id,
              target: a.id
            }
          ]
      }),
      {
        prev: undefined as PureRasterApplicatorRecord | undefined,
        links: [] as ApplicatorDirectedGraphLink[]
      }).links

  const applicatorsToOps = 
    applicators.flatMap(a => {
      switch(a.type){
        case 'flatMap': {
          return a.ops.map(op => 
          ({
            source: a.id,
            target: op.id
          }));
        }
        case 'pipe': {
          return a.ops.slice(0,1).map(firstOp => 
          ({
            source: a.id,
            target: firstOp.id
          }));
        }
      }
      return [];
    });

  const inputsToFirstApplicator = 
    applicators.slice(0,1)
    .flatMap(firstApplicator => 
      inputs.flatMap(input => 
        ({
          source: input.id,
          target: firstApplicator.id
        })));

  const lastApplicatorToOutput = 
    applicators.slice(applicators.length-1,applicators.length)
    .map(lastApplicator => 
      ({
        source: lastApplicator.id,
        target: outputId
      }));

  const lastOperationsToOutput =
    applicators.slice(applicators.length-1,applicators.length)
    .flatMap(lastApplicator => {
      switch(lastApplicator.type){
        case "pipe": {
          return lastApplicator.ops.slice(
            lastApplicator.ops.length-1,
            lastApplicator.ops.length
          ).map(lastOp => ({
            source: lastOp.id,
            target: outputId,
          }))
        }
      }
      return [];
    });
  
  const inputsToFirstOperations =
    applicators.slice(0,1)
    .flatMap(firstApplicator => {
      switch(firstApplicator.type){
        case 'pipe': {
          return inputs.flatMap(input => {
            const ops = firstApplicator.ops;
            const toFirst = 
              ops.slice(0, 1).map(op =>
              ({
                source: input.id,
                target: op.id
              }));
            const fromLast = 
              ops.slice(ops.length-1, ops.length).map(op =>
              ({
                source: op.id,
                target: outputId
              }));
            return [
              ...toFirst,
              ...fromLast
            ];
          });
        }
        case 'flatMap': {
          return inputs.flatMap(input => 
            firstApplicator.ops.map(op => 
            ({
              source: input.id,
              target: op.id
            })));
        }
      }
      return [];
    });

  const betweenOperationsOfAnApp: ApplicatorDirectedGraphLink[] =
    applicators.flatMap(a => {
      switch(a.type){
        case "pipe": {
          if(a.ops.length === 0){
            return [];
          }
          const between = a.ops.reduce(
            (acc,op) => 
            ({
              prev: op,
              links:
                acc.prev === undefined
                  ? acc.links
                  : [
                    ...acc.links,
                    {source: acc.prev.id, target: op.id}
                  ]
            }),
            {
              prev: undefined as PureRasterOperationRecord | undefined,
              links: [] as ApplicatorDirectedGraphLink[]
            }).links;
          return [
            ...between
          ];
        }
      }
      console.warn('unhandled app type: '  + a.type);
      return [];
    })

  const links: ApplicatorDirectedGraphLink[] = [
    ...(relateOperationsBetweenApplicators 
      ? inputsToFirstOperations 
      : inputsToFirstApplicator)
    ,...(relateOperationsBetweenApplicators 
      ? [] 
      : lastApplicatorToOutput)
    ,...(relateOperationsBetweenApplicators 
      ? betweenAdjacentApplicatorOps
      : betweenApplicators)
    ,...betweenOperationsOfAnApp
    ,...(relateOperationsBetweenApplicators 
      ? [] 
      : applicatorsToOps)
    ,...(relateOperationsBetweenApplicators 
      ? lastOperationsToOutput
      : [])
  ] as ApplicatorDirectedGraphLink[];

  return { links, nodes } as 
    DirectedGraphData<
      ApplicatorDirectedGraphNode,
      ApplicatorDirectedGraphLink>;
};