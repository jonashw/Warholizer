import ForceGraph2D from 'react-force-graph-2d';
import { DagMode } from './GraphViewerDemo';
import { ApplicatorDirectedGraphNodeType, applicatorDirectedGraph } from './applicatorDirectedGraph';
import { useContainerWidth } from './useContainerWidth';
import { ImageRecord } from './ImageRecord';
import { PureRasterApplicatorRecord } from './Warholizer/RasterOperations/PureRasterApplicator';
import React from 'react';

const nodeTypeColor: { [K in ApplicatorDirectedGraphNodeType]: string } = {
  'image': 'rgb(41,140,140)',
  'applicator':'black',
  'operation':'rgb(200,60,60)'
};

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

  return (
    <div ref={containerRef}>
      <ForceGraph2D
        height={height}
        width={availableWidth}
        graphData={graphData}
        nodeCanvasObjectMode={() => "replace"}
        nodeColor={node => nodeTypeColor[node.type] ?? "black"}
        linkDirectionalParticleWidth={2}
        linkDirectionalParticles={3}
        dagMode={dagMode}
        dagLevelDistance={30}
        nodeRelSize={5}
        linkColor={() => "white"}
        nodeCanvasObject={(node, ctx, globalScale) => {
          const label = node.label;
          const fontSize = 12 / globalScale;
          //console.log({globalScale,fontSize})
          ctx.font = `${fontSize}px Sans-Serif`;
          const textWidth = ctx.measureText(label).width;
          const [w, h] = [textWidth + 8, fontSize * 2];
          ctx.save();
          ctx.fillStyle = nodeTypeColor[node.type];
          ctx.strokeStyle = 'white';
          ctx.lineWidth = 1;
          ctx.fillRect(node.x! - w / 2, node.y! - h / 2, w, h);
          //ctx.strokeRect(node.x! - w / 2, node.y! - h / 2, w, h);
          ctx.restore();
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillStyle = 'white';
          ctx.fillText(label, node.x!, node.y!);
        }} />
    </div>
  );
}