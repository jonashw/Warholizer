import { ForceGraphMethods, LinkObject, NodeObject } from 'react-force-graph-2d';
import { DagMode } from './GraphViewerDemo';
import React from 'react';
import pureGraphs, { PureGraphData, PureGraphLink, PureGraphNode, PureGraphOutput } from './pureGraphs';
import { useUndo } from './undo/useUndo';
import { UndoRedoToolbar } from './undo/UndoRedoToolbar';
import { PureRasterOperationInlineEditor } from './Warholizer/RasterOperations/PureRasterOperationInlineEditor';
import { sampleOperations } from './sampleOperations';
import { InputsEditor } from './InputsEditor';
import { ImageRecord } from './ImageRecord';
import { Outputs } from './Outputs';
import { NewOpDropdownMenu } from './NewOpDropdownMenu';
import { operationAsRecord } from './Warholizer/RasterOperations/PureRasterApplicator';
import { DirectedGraphLink } from './DirectedGraphData';
import { OffscreenCanvasImageBundle } from './OffscreenCanvasImageBundle';
import { PureGraphViewer } from './PureGraphViewer';
import { PureRasterOperations } from './Warholizer/RasterOperations/PureRasterOperation';
type NodeTouchMode = {
  type: 'SelectNodes',
  selectedNodeIds: string[]
} | {
  type: 'ReceiveLinkFromSources',
  sourceNodeIds: string[]
};

export const red = 'rgb(200,60,60)';
export const blue = '#0d6efd';
  //'image': 'rgb(41,140,140)',
  //'applicator':'black',

//const nodePaint = ;

export type GraphRefType = 
    ForceGraphMethods<
    NodeObject<PureGraphNode>,
    LinkObject<PureGraphNode, object>>;

export function PureGraphEditor({
  value,
  onChange,
  defaultInputs,
}: {
  value: PureGraphData;
  onChange: (value: PureGraphData) => void;
  defaultInputs: ImageRecord[];
  dagMode: DagMode;
  height: number;
}) {
  const [inputImages, setInputImages] = React.useState<ImageRecord[]>(defaultInputs);
  const [output, setOutput] = React.useState<PureGraphOutput>();
  const [graph,setGraph,undoController] = useUndo<PureGraphData>(value);
  const [nodeTouchMode,setNodeTouchMode] = React.useState<NodeTouchMode>({type:'SelectNodes',selectedNodeIds: []})
  const clearNodeSelection =  () => {
    setNodeTouchMode({type:'SelectNodes',selectedNodeIds:[]})
  };
  const selectNode = (id: string) => {
    setNodeTouchMode({
      type: 'SelectNodes',
      selectedNodeIds: [ id ]
    });
  }

  const toolbarInstructions = 
    nodeTouchMode.type === "ReceiveLinkFromSources" 
    ?  "Select another operation to create a forward link."
    : nodeTouchMode.selectedNodeIds.length === 0 
    ? "Select an operation to edit."
    : undefined;

  const onLinkClick = (l: LinkObject<PureGraphNode, object>) => {
    const source = l.source!;
    const target = l.target!;
    if (
      typeof source === "string" || typeof source === "number" ||
      typeof target === "string" || typeof target === "number"
    ) {
      return;
    }
    const link: DirectedGraphLink<PureGraphLink> = { source: source.id, target: target.id };
    setGraph(pureGraphs.removeLink(graph, link));
  };

  const onNodeClick = (node: NodeObject<NodeObject<PureGraphNode>>) => {
    if (node.id === activeNode?.id) {
      clearNodeSelection();
    } else {
      if(nodeTouchMode.type === 'ReceiveLinkFromSources'){
        const links = 
          nodeTouchMode.sourceNodeIds
          .map(source => 
            ({
              source,
              target: node.id 
            } as DirectedGraphLink<PureGraphLink>));
          setGraph(pureGraphs.addLinks(graph,links));
          setNodeTouchMode({type:'SelectNodes',selectedNodeIds:nodeTouchMode.sourceNodeIds});
      } else {
        selectNode(node.id);
      }
    }
  }
  const activeNodeId = React.useMemo(
    () => nodeTouchMode.type === 'SelectNodes' ? nodeTouchMode.selectedNodeIds[0] : undefined,
    [nodeTouchMode]);

  const activeNodeIds = React.useMemo(
    () => nodeTouchMode.type === 'SelectNodes' ? nodeTouchMode.selectedNodeIds : nodeTouchMode.sourceNodeIds,
    [nodeTouchMode]);

  const activeNode = React.useMemo(
    () => graph.nodes.find(n => n.id === activeNodeId),
    [activeNodeId, graph]);


  React.useEffect(() => {
    pureGraphs
      .applyBottomUp(graph,inputImages)
      .then(setOutput);
  },[graph, inputImages]);


  React.useEffect(() => {
    onChange(graph);
    console.log('change');
  },[graph, onChange]);


  const nodeActive = (node: NodeObject<NodeObject<PureGraphNode>>) =>
    activeNodeIds.indexOf(node.id) > -1;

  return (<div>
    <div className="row">
      <div className="col-sm-8">
        <div className="card mb-3">
          <div className="card-header d-flex justify-content-between align-items-center">
            <span>Operation Graph</span>
            <UndoRedoToolbar controller={undoController} />
          </div>

          <div className="card-header">
            <div className="d-flex gap-1">
              <NewOpDropdownMenu
                placeholder={activeNode ? "Pipe into a new operation" : undefined}
                onSelect={op => {
                  const opRecord = operationAsRecord(op);
                  const newNode: PureGraphNode = { op: opRecord, id: opRecord.id };
                  if(activeNode){
                    const newLink: DirectedGraphLink<PureGraphLink> = {
                      source: activeNode.id,
                      target: newNode.id
                    };
                    setGraph(
                      pureGraphs.addLink(
                        pureGraphs.addNode(value, newNode),
                        newLink));
                  } else {
                    setGraph(pureGraphs.addNode(value, newNode));
                  }
                  selectNode(newNode.id);
                }}
              />
              {activeNode && <>
                <button
                  className="btn btn-lg btn-outline-secondary btn-sm flex-shrink-0"
                  onClick={() => {
                    const sourceNodeIds = nodeTouchMode.type === 'SelectNodes' ? nodeTouchMode.selectedNodeIds : [];
                    setNodeTouchMode({ type: 'ReceiveLinkFromSources', sourceNodeIds })
                  }}
                >
                  Link to...
                </button>
                <button
                  className="btn btn-lg btn-danger btn-sm flex-shrink-0"
                  onClick={() => {
                    setGraph(pureGraphs.remove(value, activeNode));
                    clearNodeSelection();
                  }}
                >
                  Remove
                </button>
              </>
              }
            </div>
          </div>

          {graph.nodes.length > 0 && activeNode && (
            <div className="card-header">
              <div className="d-flex justify-content-between flex-grow-1 align-items-center">
                <PureRasterOperationInlineEditor
                  value={activeNode.op}
                  onChange={newOp => {
                    const updatedOp = { ...newOp, id: activeNode.op.id };
                    const updatedNode: PureGraphNode = { op: updatedOp, id: updatedOp.id };
                    setGraph(pureGraphs.replace(value, activeNode, updatedNode));
                    selectNode(updatedNode.id);
                  }}
                  sampleOperators={sampleOperations}
                />
              </div>
            </div>
          )}

          {toolbarInstructions && <div className="card-header">
            {toolbarInstructions}
          </div>}

          <PureGraphViewer 
            graph={graph}
            onLinkClick={onLinkClick}
            onBackgroundClick={() => clearNodeSelection()}
            onNodeClick={onNodeClick}
            nodeActive={nodeActive}
            height={500}
          />
          
        </div>
      </div>
      <div className="col-sm-4">
        <InputsEditor defaultInputs={inputImages} onChange={setInputImages} />
        <div className="mt-3">
          <Outputs outputs={output?.outputs ?? []} />
          {output && nodeTouchMode.type === 'SelectNodes' && nodeTouchMode.selectedNodeIds.length === 1 && (
            nodeTouchMode.selectedNodeIds.map(id => (
            <div className="card mt-3" key={id}>
              <div className="card-header">
                Selected Node
              </div>
              {/*
                <div className="card-body">
                  {graph.nodes.filter(n => n.id === id).map(n => n.op).map(PureRasterOperations.stringRepresentation)}
                </div>
              */}
              <div className="card-body">
                <div className="row">
                  <div className="col">
                    <div className="text-center">Inputs ({output.inputsFor[id].length})</div>
                    <div className="d-flex justify-content-center">
                      <OffscreenCanvasImageBundle maxWidth={50} images={output.inputsFor[id]} />
                    </div>
                    <div className="text-center">
                      {(output.sourceOpsByTargetId[id] ?? []).map(op => (
                        <div className="mt-2">
                          <button
                            className="btn btn-sm btn-outline-primary"
                            onClick={() => {
                              selectNode(op.id);
                            }}
                          >{op.type}</button>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="col">
                    <div className="text-center">Outputs ({output.outputsFor[id].length})</div>
                    <div className="d-flex justify-content-center">
                      <OffscreenCanvasImageBundle maxWidth={50} images={output.outputsFor[id]} />
                    </div>
                    <div className="text-center">
                      {(output.targetOpsBySourceId[id] ?? []).map(op => (
                        <div className="mt-2">
                          <button
                            className="btn btn-sm btn-outline-primary"
                            onClick={() => {
                              selectNode(op.id);
                            }}
                          >{op.type}</button>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
            ))
          )}
        </div>
      </div>
    </div>
  </div>
  );
}