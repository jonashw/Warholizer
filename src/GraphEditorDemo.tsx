import React from "react";
import { operationAsRecord } from "./Warholizer/RasterOperations/PureRasterApplicator";
import { PureGraphEditor } from "./PureGraphEditor";
import pureGraphs from "./pureGraphs";
import { ImageRecord } from "./ImageRecord";
import { useSampleImages } from "./useSampleImages";


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
  return pureGraphs.precede(graph, slideWrap.id, operationAsRecord({type:'invert'}));
})();

export function GraphEditorDemo() {
  const [inputs,setInputs] = React.useState<ImageRecord[]>();
  const [graph,setGraph] = React.useState(defaultGraph);

  useSampleImages(
    React.useCallback(library => [library.warhol],[]),
    setInputs);

  return <div className="container-fluid">
    {inputs && <PureGraphEditor
      defaultInputs={inputs}
      dagMode="lr"
      height={500}
      value={graph}
      onChange={setGraph}
    />}
  </div>;
}