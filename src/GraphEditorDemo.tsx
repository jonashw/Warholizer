import React from "react";
import { operationAsRecord } from "./Warholizer/RasterOperations/PureRasterApplicator";
import { PureGraphEditor } from "./PureGraphEditor";
import pureGraphs from "./pureGraphs";
import { ImageRecord, imageAsRecord } from "./ImageRecord";
import { loadSampleImages, sampleImageUrls } from "./sampleImageUrls";
import { PureRasterOperation } from "./Warholizer/RasterOperations/PureRasterOperation";
import { angle } from "./Warholizer/RasterOperations/NumberTypes";

pureGraphs.pipe([
  {type:"slideWrap",dimension:'x',amount:50} as PureRasterOperation
  ,{type:"slideWrap",dimension:'y',amount:50} as PureRasterOperation
  ,{type:'grid',rows:3, cols:3} as PureRasterOperation
].map(operationAsRecord));


const defaultGraph = 
pureGraphs.pipe([
  operationAsRecord({type:'rotate',degrees:angle(360-45),about:'top-left'})
]);

/*
pureGraphs.pipe([
  operationAsRecord({type:'rotate',degrees:135}),
  operationAsRecord({type:'rotate',degrees:135})
]);

  pureGraphs.mergePipe(
    [
      operationAsRecord({type:"noop"}),
      operationAsRecord({type:"slideWrap",dimension:'y',amount:50})
    ],
    operationAsRecord({type:"tile", primaryDimension:"x", lineLength:2}),
    [
      operationAsRecord({type:"grid", rows:2, cols:2})
    ]
  );

  pureGraphs.mergePipe(
    [
      operationAsRecord({type:"noop"}),
      operationAsRecord({type:"slideWrap",dimension:'y',amount:50})
    ],
    operationAsRecord({type:"line", direction:"right",squish:true}),
    [
    ]
  );
*/

export function GraphEditorDemo() {
  const [inputs,setInputs] = React.useState<ImageRecord[]>();
  const [graph,setGraph] = React.useState(defaultGraph);
  React.useEffect(() => {
    loadSampleImages([
      sampleImageUrls.warhol
    ])
    .then(imgs => imgs.map(imageAsRecord))
    .then(setInputs)
  },[]);
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