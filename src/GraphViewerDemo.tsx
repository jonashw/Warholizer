import React from 'react';
import ForceGraph2D from 'react-force-graph-2d';
import { ButtonRadiosInput } from './Warholizer/RasterOperations/ButtonRadiosInput';

type DagMode = | 'td' | 'bu' | 'lr' | 'rl' | 'radialout' | 'radialin';
const dagModes: DagMode[] = ['td', 'bu', 'lr', 'rl', 'radialout', 'radialin'];
type GraphData = {
  nodes: {id:string}[],
  links: {source:string, target: string}[]
};

export function GraphViewerDemo() {
  const [graphData,setGraphData] = React.useState<GraphData>();
  const [dagMode,setDagMode] = React.useState<DagMode>('td');

  React.useEffect(() => {
    //fetch('/miserables.json') .then(r => r.json() as Promise<GraphData>) .then(setGraphData);
    //setGraphData(genRandomTree(30));
    //setGraphData(genRandomTree(30));
    setGraphData({
      nodes: [0,1,2,3,4,5,6].map(id => ({id: id.toString()})),
      links: [[0,1],[0,2],[1,3],[1,4],[2,6],[2,5],].map(([source,target]) => ({target: target.toString(), source: source.toString()}))
    })
  },[]);


  return <div className="text-white text-center">
    <div>
      <ButtonRadiosInput 
        options={dagModes.map(value => ({ value, label: value }))}
        onChange={setDagMode}
        value={dagMode}
      />
    </div>
    {graphData && (
      <ForceGraph2D 
      height={500}
        graphData={graphData}
        //linkDirectionalArrowLength={10}
        nodeCanvasObjectMode={() => "after"}
        nodeColor={() => "white"}
        linkDirectionalParticleWidth={2}
        linkDirectionalParticles={2}
        dagMode={dagMode}
        dagLevelDistance={75}
        d3VelocityDecay={0.3}
        nodeRelSize={1}
        linkColor={() => "white"}
        nodeCanvasObject={(node, ctx, globalScale) => {
          const label = node.id;
          const fontSize = 12/globalScale;
          //console.log({globalScale,fontSize})
          ctx.font = `${fontSize}px Sans-Serif`;
          const textWidth = ctx.measureText(label).width;
          const [w,h] = [textWidth*2, fontSize*2];

          ctx.save();
          ctx.fillStyle = 'black';
          ctx.strokeStyle = 'white'
          ctx.lineWidth = 1;
          ctx.fillRect(node.x! - w / 2, node.y! - h / 2, w, h);
          //ctx.strokeRect(node.x! - w / 2, node.y! - h / 2, w, h);

          ctx.restore();
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillStyle = 'white';
          ctx.fillText(label, node.x!, node.y!);
        }}
      />
    )}
  </div>;
}
