import ForceGraph2D, { ForceGraphMethods, LinkObject, NodeObject } from 'react-force-graph-2d';
import { DagMode } from './GraphViewerDemo';
import {  ApplicatorDirectedGraphNode, ApplicatorDirectedGraphNodeType, applicatorDirectedGraph } from './applicatorDirectedGraph';
import { useContainerWidth } from './useContainerWidth';
import { ImageRecord } from './ImageRecord';
import { PureRasterApplicatorRecord } from './Warholizer/RasterOperations/PureRasterApplicator';
import React from 'react';
import { operationIconSvgPath } from './Warholizer/RasterOperations/operationIconSvgPath';

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
  const label = node.label;
  const fontSize = 12 / globalScale;
  //console.log({globalScale,fontSize})
  ctx.font = `${fontSize}px Sans-Serif`;
  const textWidth = ctx.measureText(label).width;
  const [w, h] = [textWidth + 8, fontSize * 2];
  if(node.type === "operation"){
    const path = new Path2D(operationIconSvgPath(node.operation));
    const scale = 0.33;
    const w = 24 * scale;
    const h = w;
    ctx.save();
    ctx.fillStyle='white';
    ctx.translate(node.x!-w/2,node.y!-h/2);
    ctx.scale(scale,scale);
    ctx.fill(path)
    ctx.restore();
  } else {
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
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = 'white';
    ctx.fillText(label, node.x!, node.y!);
    ctx.restore();
  }
};

type GraphRefType = 
    ForceGraphMethods<
    NodeObject<ApplicatorDirectedGraphNode>,
    LinkObject<ApplicatorDirectedGraphNode, object>>;

const linkStrength = (link: {source: ApplicatorDirectedGraphNode, target: ApplicatorDirectedGraphNode}) =>
  (link.source.type === 'applicator' && link.target.type === 'applicator')
  || (link.source.type === 'image' && link.target.type === 'applicator')
  || (link.source.type === 'applicator' && link.target.type === 'image')
  ? 1 : 0.5;

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
    graph.d3Force('link')?.strength(linkStrength);
  },[graphRef]);

  React.useEffect(() => {
    graphRef.current?.d3ReheatSimulation();
  },[availableWidth]);

  return (
    <div ref={containerRef}>
      <ForceGraph2D
        onNodeClick={n => console.log(n)}
        enablePanInteraction={false}
        enableZoomInteraction={false}
        onEngineStop={() => {
          graphRef.current?.zoomToFit(100);
        }}
        ref={graphRef}
        height={height}
        width={availableWidth}
        graphData={graphData}
        nodeCanvasObjectMode={node => node.type === "operation" ? "after" : "replace"}
        nodeColor={node => nodeTypeColor[node.type] ?? "black"}
        cooldownTime={1000}
        dagLevelDistance={25}
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