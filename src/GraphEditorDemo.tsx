import React from "react";
import { operationAsRecord } from "./Warholizer/RasterOperations/PureRasterApplicator";
import { PureGraphEditor } from "./PureGraphEditor";
import pureGraphs from "./pureGraphs";
import { ImageRecord } from "./ImageRecord";
import { PureRasterOperation } from "./Warholizer/RasterOperations/PureRasterOperation";
import { angle } from "./Warholizer/RasterOperations/NumberTypes";
import { useSampleImages } from "./useSampleImages";

pureGraphs.pipe([
  {type:"slideWrap",dimension:'x',amount:50} as PureRasterOperation
  ,{type:"slideWrap",dimension:'y',amount:50} as PureRasterOperation
  ,{type:'grid',rows:3, cols:3} as PureRasterOperation
].map(operationAsRecord));

const defaultGraph = 
pureGraphs.pipe([
  operationAsRecord({type:'rotate',degrees:angle(360-45),about:'top-right'})
]);

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