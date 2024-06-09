import ForceGraph2D, { LinkObject, NodeObject } from 'react-force-graph-2d';
import { useContainerWidth } from './useContainerWidth';
import React from 'react';
import { operationIconSvgPath } from './Warholizer/RasterOperations/operationIconSvgPath';
import pureGraphs, { PureGraphData, PureGraphNode } from './pureGraphs';
import { iconTransform } from './Warholizer/RasterOperations/OperationIcon';
import { GraphRefType, blue, red } from './PureGraphEditor';

export function PureGraphViewer({
  graph, height, onLinkClick, onBackgroundClick, onNodeClick, nodeActive
}: {
  graph: PureGraphData;
  height: number;
  onLinkClick?: (l: LinkObject<PureGraphNode, object>) => void;
  onBackgroundClick?: () => void;
  onNodeClick?: (node: NodeObject<NodeObject<PureGraphNode>>) => void;
  nodeActive?: (node: NodeObject<NodeObject<PureGraphNode>>) => boolean;
}) {

  const graphRef = React.useRef<GraphRefType>();
  const { containerRef, availableWidth } = useContainerWidth();

  React.useEffect(() => {
    if (!graphRef.current) {
      return;
    }
    const d3graph = graphRef.current;
    if (graph.links.length > 0) {
      //d3graph.d3Force('charge')?.strength(-100);
    } else {
      d3graph.d3Force('charge')?.strength(-10);
    }
  }, [graph.links.length, graphRef]);

  React.useEffect(() => {
    graphRef.current?.d3ReheatSimulation();
  }, [availableWidth, graph]);

  const clonedGraphData = React.useMemo(
    () => pureGraphs.clone(graph),
    [graph]);

  return (
    <div
      className="card-img-bottom card-img-top bg-dark"
      ref={containerRef}
      style={{ position: 'relative' }}
    >
      <ForceGraph2D
        onBackgroundClick={onBackgroundClick}
        onLinkClick={onLinkClick}
        //onLinkRightClick={() => alert('link right click')}
        //onBackgroundRightClick={() => alert('bg right click')}
        onNodeRightClick={onNodeClick}
        onNodeClick={onNodeClick}
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
        cooldownTime={1000}
        dagLevelDistance={25}
        linkDirectionalParticleWidth={2}
        linkDirectionalParticles={3}
        dagMode={"td"}
        nodeRelSize={7}
        linkColor={() => "white"}
        nodeColor={node => nodeActive && nodeActive(node) ? blue : red}
        nodeCanvasObject={(
          node: NodeObject<NodeObject<PureGraphNode>>,
          ctx: CanvasRenderingContext2D,
          globalScale: number
        ) => {
          const fontSize = 12 / globalScale;
          //console.log({globalScale,fontSize})
          ctx.font = `${fontSize}px Sans-Serif`;
          const path = new Path2D(operationIconSvgPath(node.op));
          const scale = 0.33;
          const w = 24 * scale;
          const h = w;
          ctx.save();
          ctx.fillStyle = 'white';
          ctx.translate(node.x! - w / 2, node.y! - h / 2);
          const transformIcon = iconTransform(node.op);
          if (transformIcon.flipX || transformIcon.flipY) {
            ctx.translate(transformIcon.flipY ? 0 : w, transformIcon.flipX ? 0 : h);
            ctx.scale(transformIcon.flipX ? -1 : 1, transformIcon.flipY ? -1 : 1);
          }
          if (transformIcon.degreesRotation) {
            ctx.translate(w / 2, h / 2);
            ctx.rotate(transformIcon.degreesRotation * Math.PI / 180);
            ctx.translate(-w / 2, -h / 2);
          }
          ctx.scale(scale, scale);
          ctx.fill(path);
          ctx.restore();
        }} />
    </div>
  );
}
