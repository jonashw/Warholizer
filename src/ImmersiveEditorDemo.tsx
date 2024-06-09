import { PureGraphViewer } from "./PureGraphViewer";
import { operationAsRecord } from "./Warholizer/RasterOperations/PureRasterApplicator";
import { WarholizerImage } from "./WarholizerImage";
import pureGraphs from "./pureGraphs";
import "./Immersive.css";
import { useContainerSize } from "./useContainerSize";

const defaultGraph = (() => {
  const slideWrap = operationAsRecord({type:"slideWrap",dimension:'y',amount:50});
  const graph = pureGraphs.mergePipe(
    [
      operationAsRecord({type:"noop"})
      ,slideWrap
    ]
    ,operationAsRecord({type:'line',direction:'right',squish:false})
    ,[
      operationAsRecord({type:'grid',rows:3, cols:3})
    ]
  );
  return pureGraphs.insert(graph, operationAsRecord({type:'invert'}), 'after', slideWrap.id, );
})();

export function ImmersiveEditorDemo() {
  const {containerRef,clientRect} = useContainerSize();
  return <div className="container-fluid height-100">
    <div className="card height-100">
      <div className="card-body">
        <div className="d-flex gap-2">
          <WarholizerImage src={["/banana.jpg"]} transform={{type: "noop"}} thumbnail={50} />
          <WarholizerImage src={["/warhol.jpg"]} transform={{type: "noop"}} thumbnail={50} />
          <WarholizerImage src={["/soup-can.jpg"]} transform={{type: "noop"}} thumbnail={50} />
        </div>
      </div>
      <div className="card-img-bottom flex-grow-100" ref={containerRef}>
        <PureGraphViewer graph={defaultGraph} height={clientRect.height}/>
      </div>
      <div className="card-body">
        <div className="d-flex gap-2">
          <WarholizerImage src={["/banana.jpg"]} transform={{type: "noop"}} thumbnail={50} />
          <WarholizerImage src={["/warhol.jpg"]} transform={{type: "noop"}} thumbnail={50} />
          <WarholizerImage src={["/soup-can.jpg"]} transform={{type: "noop"}} thumbnail={50} />
        </div>
      </div>
    </div>
  </div>;
}
