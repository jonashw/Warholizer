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
import { useMetaKeys } from './useMetaKeys';

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
  const { containerRef, availableWidth } = useContainerWidth();
  const [activeNodeId,setActiveNodeId] = React.useState<string>();
  const [graph,setGraph,undoController] = useUndo<PureGraphData>(value);
  const [inputImages, setInputImages] = React.useState<ImageRecord[]>(defaultInputs);
  const [outputImages, setOutputImages] = React.useState<{id:string,osc:OffscreenCanvas}[]>([]);
  const metaKeys = useMetaKeys();

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

  const activeNode = React.useMemo(
    () => graph.nodes.find(n => n.id === activeNodeId),
    [activeNodeId, graph]);

  return (<div>
    <div className="row">
      <div className="col-sm-8">
        <div className="card mb-3">
          <div className="card-header d-flex justify-content-between align-items-center">
            <UndoRedoToolbar controller={undoController} />
            <div>
              <NewOpDropdownMenu
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
                    setActiveNodeId(newNode.id);
                  } else {
                    setGraph(pureGraphs.addNode(value, newNode));
                  }
                }}
              />
            </div>
          </div>
          {graph.nodes.length > 0 && (
            <div className="card-header d-flex justify-content-between flex-grow-1 align-items-center">
              {activeNode ? (
                <>
                  <PureRasterOperationInlineEditor
                    value={activeNode.op}
                    onChange={newOp => {
                      const updatedOp = { ...newOp, id: activeNode.op.id };
                      const updatedNode: PureGraphNode = { op: updatedOp, id: updatedOp.id };
                      setGraph(pureGraphs.replace(value, activeNode, updatedNode));
                      setActiveNodeId(updatedNode.id);
                    }}
                    sampleOperators={sampleOperations}
                  />
                  <button
                    className="btn btn-lg btn-danger btn-sm"
                    onClick={() => {
                      setGraph(pureGraphs.remove(value, activeNode));
                      setActiveNodeId(undefined);
                    }}
                  >
                    Remove
                  </button>
                </>
              ) : (
                <div>Select an operation to edit.</div>
              )}
            </div>
          )}
          <div className="card-img-bottom bg-dark" ref={containerRef} style={{ position: 'relative' }}>
            <ForceGraph2D
              onBackgroundClick={() => setActiveNodeId(undefined)}
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
              onNodeClick={node => {
                if (node.id === activeNode?.id) {
                  setActiveNodeId(undefined);
                } else {
                  if(activeNode && metaKeys.ctrl){
                    const link: DirectedGraphLink<PureGraphLink> = 
                      { source: activeNode.id, target: node.id };
                    setGraph(pureGraphs.addLink(graph,link));
                  } else {
                    setActiveNodeId(node.id);
                  }
                }
              }}
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
              nodeColor={node => node.id === activeNodeId ? blue : red}
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