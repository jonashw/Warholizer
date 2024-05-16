import React from 'react';
import ForceGraph2D from 'react-force-graph-2d';
import { WarholizerImage, WarholizerImageRef } from './WarholizerImage';
import { PureRasterApplicatorRecord } from './Warholizer/RasterOperations/PureRasterApplicator';
import { DagMode } from './GraphViewerDemo';
import { ImageRecord } from './ImageRecord';
import { ApplicatorDirectedGraphData, ApplicatorDirectedGraphNodeType, applicatorDirectedGraph } from './applicatorDirectedGraph';

const nodeTypeColor: 
{ [K in ApplicatorDirectedGraphNodeType]: string } = {
  'image': 'rgb(41,140,140)',
  'applicator':'black',
  'operation':'rgb(200,60,60)'
};

export function ImageGraphSideBySide({
  applicators, dagMode, 
  inputs
}: {
  applicators: PureRasterApplicatorRecord[];
  dagMode: DagMode;
  inputs: ImageRecord[]
}) {
  const ref = React.createRef<WarholizerImageRef>();
  const [graphData,setGraphData] = React.useState<ApplicatorDirectedGraphData>({ nodes:[], links:[] })

  React.useEffect(() => {
    setGraphData(applicatorDirectedGraph(inputs,applicators));
  }, [inputs,applicators]);

  const [imageHeight,setImageHeight] = React.useState(0);

  return (
    <div className="row">
      <div className="col-md-4">
        <WarholizerImage
          onSize={(_,h) => setImageHeight(h)}
          ref={ref}
          src={inputs}
          className="img-fluid"
          applicators={applicators} />
      </div>

      <div className="col-md-8">
        {graphData && (
          <ForceGraph2D
            height={imageHeight}
            width={window.innerWidth/2}
            graphData={graphData}
            nodeCanvasObjectMode={() => "after"}
            nodeColor={node => nodeTypeColor[node.type] ?? "black"}
            linkDirectionalParticleWidth={2}
            linkDirectionalParticles={3}
            dagMode={dagMode}
            dagLevelDistance={40}
            nodeRelSize={0}
            linkColor={() => "white"}
            nodeCanvasObject={(node, ctx, globalScale) => {
              const label = node.label;
              const fontSize = 12 / globalScale;
              //console.log({globalScale,fontSize})
              ctx.font = `${fontSize}px Sans-Serif`;
              const textWidth = ctx.measureText(label).width;
              const [w,h] = [textWidth + 8, fontSize*2];
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
        )}
      </div>
    </div>
  );
}