import ForceGraph2D, { ForceGraphMethods, LinkObject, NodeObject } from 'react-force-graph-2d';
import { DagMode } from './GraphViewerDemo';
import { useContainerWidth } from './useContainerWidth';
import React from 'react';
import { operationIconSvgPath } from './Warholizer/RasterOperations/operationIconSvgPath';
import pureGraphs, { PureGraphData, PureGraphLink, PureGraphNode } from './pureGraphs';
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
import { iconTransform } from './Warholizer/RasterOperations/OperationIcon';

type NodeTouchMode = {
  type: 'SelectNodes',
  selectedNodeIds: string[]
} | {
  type: 'ReceiveLinkFromSources',
  sourceNodeIds: string[]
};

const red = 'rgb(200,60,60)';
const blue = '#0d6efd';
  //'image': 'rgb(41,140,140)',
  //'applicator':'black',

const nodePaint = (
  node: NodeObject<NodeObject<PureGraphNode>>,
  fillColor: string,
  ctx: CanvasRenderingContext2D,
  globalScale: number
) => {
  const fontSize = 12 / globalScale;
  //console.log({globalScale,fontSize})
  ctx.fillStyle = fillColor;
  ctx.font = `${fontSize}px Sans-Serif`;
  const path = new Path2D(operationIconSvgPath(node.op));
  const scale = 0.33;
  const w = 24 * scale;
  const h = w;
  ctx.save();
  ctx.fillStyle='white';
  ctx.translate(node.x!-w/2,node.y!-h/2);
  const transformIcon = iconTransform(node.op);
  if(transformIcon.flipX || transformIcon.flipY){
    ctx.translate(transformIcon.flipY ? 0 : w, transformIcon.flipX ? 0 : h);
    ctx.scale(transformIcon.flipX ? -1 : 1, transformIcon.flipY ? -1 : 1);
  }
  if(transformIcon.degreesRotation){
    ctx.translate(w/2,h/2);
    ctx.rotate(transformIcon.degreesRotation * Math.PI/180);
    ctx.translate(-w/2,-h/2);
  }
  ctx.scale(scale,scale);
  ctx.fill(path)
  ctx.restore();
};

type GraphRefType = 
    ForceGraphMethods<
    NodeObject<PureGraphNode>,
    LinkObject<PureGraphNode, object>>;

export function PureGraphEditor({
  value,
  onChange,
  defaultInputs,
  dagMode,
  height,
}: {
  value: PureGraphData;
  onChange: (value: PureGraphData) => void;
  defaultInputs: ImageRecord[];
  dagMode: DagMode;
  height: number;
}) {
  const [graph,setGraph,undoController] = useUndo<PureGraphData>(value);
  const { containerRef, availableWidth } = useContainerWidth();
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

  const [inputImages, setInputImages] = React.useState<ImageRecord[]>(defaultInputs);
  const [outputImages, setOutputImages] = React.useState<{id:string,osc:OffscreenCanvas}[]>([]);

  const graphRef = React.useRef<GraphRefType>();

  React.useEffect(() => {
      setOutputImages([]);
      console.log('apply');
      pureGraphs
        .apply(graph, inputImages)
        .then(setOutputImages);
  },[graph, inputImages]);

  React.useEffect(() => {
    if(!graphRef.current){
      return;
    }
    const d3graph = graphRef.current;
    if(graph.links.length > 0){
      //d3graph.d3Force('charge')?.strength(-100);
    } else {
      d3graph.d3Force('charge')?.strength(-10);
    }
  },[graph.links.length, graphRef]);

  React.useEffect(() => {
    graphRef.current?.d3ReheatSimulation();
  },[availableWidth,value]);

  React.useEffect(() => {
    onChange(graph);
    console.log('change');
  },[graph, onChange]);

  const clonedGraphData = React.useMemo(
    () => pureGraphs.clone(value),
    [value]);

  return (<div>
    <div className="row">
      <div className="col-sm-8">
        <div className="card mb-3">
          <div className="card-header d-flex justify-content-between align-items-center">
            <span>Operation Graph</span>
            <UndoRedoToolbar controller={undoController} />
          </div>

          <div className="card-header">
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
                <span className="d-flex gap-1">
                  <button
                    className="btn btn-lg btn-outline-secondary btn-sm"
                    onClick={() => {
                      const sourceNodeIds = nodeTouchMode.type === 'SelectNodes' ? nodeTouchMode.selectedNodeIds : [];
                      setNodeTouchMode({ type: 'ReceiveLinkFromSources', sourceNodeIds })
                    }}
                  >
                    Link to...
                  </button>
                  <button
                    className="btn btn-lg btn-danger btn-sm"
                    onClick={() => {
                      setGraph(pureGraphs.remove(value, activeNode));
                      clearNodeSelection();
                    }}
                  >
                    Remove
                  </button>
                </span>
              </div>
            </div>
          )}

          <div className="card-header">
            {nodeTouchMode.type === "ReceiveLinkFromSources" ? (
              "Select another operation to create a forward link."
            ) : (
              "Select an operation to edit."
            )}
          </div>

          <div className="card-img-bottom card-img-top bg-dark" ref={containerRef} style={{ position: 'relative' }}>
            <ForceGraph2D
              onBackgroundClick={() => clearNodeSelection()}
              onLinkClick={(l: LinkObject<PureGraphNode, object>) => {
                const source = l.source!;
                const target = l.target!;
                if(
                  typeof source === "string" || typeof source === "number" ||
                  typeof target === "string" || typeof target === "number"
                ){
                  return;
                } 
                const link: DirectedGraphLink<PureGraphLink> = {source: source.id, target: target.id};
                setGraph(pureGraphs.removeLink(graph,link));
              }}
              onLinkRightClick={() => alert('link right click')}
              onBackgroundRightClick={() => alert('bg right click')}
              onNodeRightClick={() => alert('node right click')}
              onNodeClick={node => { onNodeClick(node); }}
              enablePanInteraction={false}
              enableZoomInteraction={false}
              onEngineTick={() => {
                graphRef.current?.zoomToFit();
              }}
              ref={graphRef}
              height={height}
              width={availableWidth}
              graphData={clonedGraphData}
              nodeCanvasObjectMode={() => "after"}
              nodeColor={node => activeNodeIds.indexOf(node.id) > -1 ? blue : red}
              cooldownTime={1000}
              dagLevelDistance={25}
              linkDirectionalParticleWidth={2}
              linkDirectionalParticles={3}
              dagMode={dagMode}
              nodeRelSize={7}
              linkColor={() => "white"}
              nodeCanvasObject={(node, ctx, globalScale) => {
                nodePaint(node, red, ctx, globalScale);
              }}
            />
          </div>
        </div>
        
      </div>
      <div className="col-sm-4">
        <InputsEditor defaultInputs={inputImages} onChange={setInputImages} />
        <div className="mt-3">
          <Outputs outputs={outputImages} />
        </div>
      </div>
    </div>
  </div>
  );
}