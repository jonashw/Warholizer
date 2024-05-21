import { DirectedGraphData, DirectedGraphLink } from "./DirectedGraphData";
import { ImageRecord, imageAsRecord } from "./ImageRecord";
import { PureRasterOperationRecord } from "./Warholizer/RasterOperations/PureRasterApplicator";
import {Set as ImmutableSet} from "immutable";
import { PureRasterOperations } from "./Warholizer/RasterOperations/PureRasterOperation";

export type PureGraphData = 
  DirectedGraphData<
    PureGraphNode,
    PureGraphLink>;
export type PureGraphNode = {op: PureRasterOperationRecord, id: string};
export type PureGraphLink = object;

type OperationInstruction = {
    op: PureRasterOperationRecord,
    inputs: ImageRecord[]
};

type InstructionGroupsAccumulator = {
    [opId: string]: {op:PureRasterOperationRecord, inputs: ImageRecord[]}
};

async function getOutputBySourceId(instructions: OperationInstruction[]): Promise<{[id: string]: ImageRecord[]}>  {
    const groups = instructions.flatMap(async inst => {
        const oscs = inst.inputs.map(i => i.osc);
        const outputImgs = await PureRasterOperations.apply(inst.op, oscs);
        return [
            inst.op.id,
            outputImgs.map(imageAsRecord)
        ] as [string,ImageRecord[]];
    });
    const entries = await Promise.all(groups);
    return Object.fromEntries(entries);
}

const pairs = <T>(items: T[]) => 
    Array.from(Array(items.length-1).keys())
    .map(i =>
        [
            items[i],
            items[i + 1]
        ] as [T, T]);

export default {
    apply: async (graph: PureGraphData, inputs: ImageRecord[]): Promise<ImageRecord[]> => {
        const opById = Object.fromEntries(graph.nodes.map(n => [n.op.id, n.op]));
        //const sourceIds = ImmutableSet<string>(graph.links.map(l => l.source));
        const targetIds = ImmutableSet<string>(graph.links.map(l => l.target));
        const targetOpsBySourceId = graph.links.reduce((groups,link) => {
            const group = [
                ...(groups[link.source] ?? [])
                ,opById[link.target]
            ];
            return {
                ...groups,
                [link.source]: group
            };
        }, {} as Record<string,PureRasterOperationRecord[]>);

        const entryOps = 
            graph.nodes
            .filter(n => !targetIds.has(n.op.id))
            .map(n => n.op);
        const frstInstructions = entryOps.map(op => ({op,inputs}));

        return await (async function loop(n,instructions): Promise<ImageRecord[]> {
            const outputBySourceId = await getOutputBySourceId(instructions);
            const sourceIds = Array.from(Object.keys(outputBySourceId));
            const unconsumedOutput = 
                sourceIds
                .filter(sourceId => !(sourceId in targetOpsBySourceId))
                .flatMap(sourceId => outputBySourceId[sourceId] ?? []);
            const nextInstructionsUnmerged: OperationInstruction[] = 
                sourceIds
                .flatMap(sourceId => 
                    (targetOpsBySourceId[sourceId] ?? [])
                    .map(op => ({
                        op,
                        inputs: outputBySourceId[sourceId]
                    })));
            const nextInstructionsMerged: InstructionGroupsAccumulator = nextInstructionsUnmerged.reduce(
                //Forking is natural... merging is explicit.
                (groups: InstructionGroupsAccumulator,{op,inputs}) => {
                    const group = groups[op.id] || {op, inputs: []};
                    const updatedGroup = {...group, inputs: [...group.inputs, ...inputs]};
                    return {...groups, [op.id]: updatedGroup} as InstructionGroupsAccumulator;
                },
                {} as InstructionGroupsAccumulator);
            const nextInstructions = Object.values(nextInstructionsMerged);
            console.log({n,instructions,unconsumedOutput,nextInstructionsUnmerged,nextInstructionsMerged,nextInstructions})
            if(nextInstructions.length === 0){
                return unconsumedOutput;
            }
            return [
                ...unconsumedOutput
                ,...(await loop(n+1,nextInstructions))
            ];
        })(1,frstInstructions);
    },
    addNode: (graph: PureGraphData, node: PureGraphNode): PureGraphData => ({
        links: graph.links, nodes:[...graph.nodes, node]
    }),
    addLink: (graph: PureGraphData, link: DirectedGraphLink<PureGraphLink>): PureGraphData => {
        const source = graph.nodes.find(n => n.id === link.source);
        const target = graph.nodes.find(n => n.id === link.target);
        if(!source || !target){
            return graph;
        }
        const existingLinks = 
            graph.links.filter(l => 
                (l.source === source.id && l.target === target.id) ||
                (l.target === source.id && l.source === target.id));
        if(existingLinks.length > 0){
            return graph;
        }
        const newLink = {source:source.id, target: target.id};
        return {
            nodes: graph.nodes,
            links: [...graph.links, newLink]
        }
    },
    removeLink: (graph: PureGraphData, link: DirectedGraphLink<PureGraphLink>): PureGraphData => ({
        links: graph.links.filter(l => !(l.source === link.source && l.target === link.target)),
        nodes: graph.nodes
    }),
    init: (): PureGraphData => ({links: [], nodes:[]}),
    replace: (graph: PureGraphData, node: PureGraphNode, updatedNode: PureGraphNode): PureGraphData => {
        const nodes = graph.nodes.map(n => n.id !== node.id ? n : updatedNode);
        const links = graph.links;
        return {nodes, links};
    },
    remove: (graph: PureGraphData, node: PureGraphNode): PureGraphData => {
        const nodes = graph.nodes.filter(n => n.id !== node.op.id);
        const nodeById = Object.fromEntries(nodes.map(n => [n.id,n]));
        const danglingSourceNodeIds = 
            graph.links
            .filter(l => l.target === node.op.id)
            .map(l => nodeById[l.source])
            .filter(n => n)
            .map(n => n.id);
        const danglingTargetNodeIds = 
            graph.links
            .filter(l => l.source === node.op.id)
            .map(l => nodeById[l.target])
            .filter(n => n)
            .map(n => n.id);
        const links = [
            ...graph.links.filter(l => l.source !== node.op.id && l.target !== node.op.id),
            ...danglingSourceNodeIds.flatMap(source => 
                danglingTargetNodeIds.map(target => ({source, target})))
        ];
        console.log({graph,links});
        return {nodes, links};
    },
    mergePipe: (
        sources: PureRasterOperationRecord[],
        sharedTarget: PureRasterOperationRecord,
        targetPipes?: PureRasterOperationRecord[]
    ): PureGraphData => {
        const links =  
            [
                ...sources.map(source => ({
                    source: source.id,
                    target: sharedTarget.id 
                }))
                ,...(
                    !targetPipes 
                    ? []
                    : pairs([sharedTarget,...targetPipes]).map(([source,target]) => ({
                        source: source.id,
                        target: target.id
                    }))
                )
            ];
        return {
            links,
            nodes: [
                ...sources,
                sharedTarget,
                ...(targetPipes ?? [])
            ].map(op => ({op,id: op.id}) as PureGraphNode)
        };
    },
    pipe: (ops: PureRasterOperationRecord[]): PureGraphData => {
        const links =  
            pairs(ops)
            .map(([a,b]) => ({ source: a.id, target: b.id }));
        console.log({links,nodes:ops});
        return {
            links,
            nodes: ops.map(op => ({op,id: op.id}) as PureGraphNode)
        };
    },
    clone: (value: PureGraphData): PureGraphData => 
        ({
            links: value.links.map(link => ({...link})),
            nodes: value.nodes.map(node => ({...node}))
        }),
    singular: (op: PureRasterOperationRecord): PureGraphData => ({links: [], nodes:[{op,id:op.id}]}),

};