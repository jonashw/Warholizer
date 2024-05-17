import ForceGraph2D, { ForceGraphMethods, LinkObject, NodeObject } from 'react-force-graph-2d';
import { DagMode } from './GraphViewerDemo';
import {  ApplicatorDirectedGraphNode, ApplicatorDirectedGraphNodeType, applicatorDirectedGraph } from './applicatorDirectedGraph';
import { useContainerWidth } from './useContainerWidth';
import { ImageRecord } from './ImageRecord';
import { PureRasterApplicatorRecord } from './Warholizer/RasterOperations/PureRasterApplicator';
import React from 'react';

const nodeTypeColor: { [K in ApplicatorDirectedGraphNodeType]: string } = {
  'image': 'rgb(41,140,140)',
  'applicator':'black',
  'operation':'rgb(200,60,60)'
};

const nodePaint = (
  node: NodeObject<NodeObject<ApplicatorDirectedGraphNode>>,
  fillColor: string,
  ctx: CanvasRenderingContext2D,
  globalScale: number
) => {
  const drawRects = true;
  const label = node.label;
  const fontSize = 12 / globalScale;
  //console.log({globalScale,fontSize})
  ctx.font = `${fontSize}px Sans-Serif`;
  const textWidth = ctx.measureText(label).width;
  const [w, h] = [textWidth + 8, fontSize * 2];
  if(drawRects){
    ctx.save();
    ctx.fillStyle = fillColor;
    ctx.lineWidth = 1;
    //ctx.strokeRect(node.x! - w / 2, node.y! - h / 2, w, h);

    ctx.fillRect(node.x! - w / 2, node.y! - h / 2, w, h);

    ctx.save();
    ctx.beginPath();
    ctx.moveTo(node.x! - w/2, node.y! + h/2);
    ctx.lineTo(node.x! + w/2, node.y! + h/2);
    ctx.lineTo(node.x! + w/2, node.y! - h/2);
    ctx.strokeStyle = 'rgba(0,0,0,0.25)';
    ctx.stroke();
    ctx.restore();

    ctx.save();
    ctx.beginPath();
    ctx.moveTo(node.x! - w/2, node.y! + h/2);
    ctx.lineTo(node.x! - w/2, node.y! - h/2);
    ctx.lineTo(node.x! + w/2, node.y! - h/2);
    ctx.strokeStyle = 'rgba(255,255,255,0.25)';
    ctx.stroke();
    ctx.restore();

    ctx.restore();
  }
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = 'white';
  ctx.fillText(label, node.x!, node.y!);
};

type GraphRefType = 
    ForceGraphMethods<
    NodeObject<ApplicatorDirectedGraphNode>,
    LinkObject<ApplicatorDirectedGraphNode, object>>;

export function ApplicatorGraph({
  inputs,
  applicators,
  dagMode,
  height,
  relateOpsBetweenApps
}: {
  inputs: ImageRecord[]
  applicators: PureRasterApplicatorRecord[];
  dagMode: DagMode;
  height: number;
  relateOpsBetweenApps: boolean
}) {
  const { containerRef, availableWidth } = useContainerWidth();

  const graphData = React.useMemo(() => 
    applicatorDirectedGraph(inputs,applicators, relateOpsBetweenApps),
    [inputs, applicators, relateOpsBetweenApps]);

  const graphRef = React.useRef<GraphRefType>();

  React.useEffect(() => {
    if(!graphRef.current){
      return;
    }
    const graph = graphRef.current;
    graph.d3Force('charge')?.strength(-100);
  },[graphRef]);


  React.useEffect(() => {
    graphRef.current?.d3ReheatSimulation();
  },[availableWidth]);

  return (
    <div ref={containerRef}>
      <ForceGraph2D
        enablePanInteraction={false}
        enableZoomInteraction={false}
        onEngineStop={() => {
          graphRef.current?.zoomToFit(300);
        }}
        ref={graphRef}
        height={height}
        width={availableWidth}
        graphData={graphData}
        nodeCanvasObjectMode={() => "replace"}
        nodeColor={node => nodeTypeColor[node.type] ?? "black"}
        cooldownTime={1000}
        linkDirectionalParticleWidth={2}
        linkDirectionalParticles={3}
        dagMode={dagMode}
        nodeRelSize={10}
        linkColor={() => "white"}
        nodePointerAreaPaint={nodePaint}
        nodeCanvasObject={(node, ctx, globalScale) => 
          nodePaint(node,nodeTypeColor[node.type],ctx,globalScale)
        } />
    </div>
  );
}