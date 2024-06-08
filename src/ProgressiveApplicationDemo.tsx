import React from "react";
import { ImageRecord } from "./ImageRecord";
import { Outputs } from "./Outputs";
import {  operationAsRecord } from "./Warholizer/RasterOperations/PureRasterApplicator";
import pureGraphs, { PureGraphOutput }  from "./pureGraphs";
import { useSampleImages } from "./useSampleImages";
import { PureRasterOperations } from "./Warholizer/RasterOperations/PureRasterOperation";
import "./ProgressiveApplicationDemo.scss";
import { OffscreenCanvasImageBundle } from "./OffscreenCanvasImageBundle";

export function ProgressiveApplicationDemo() {
  const [inputs,setInputs] = React.useState<ImageRecord[]>();
  const [result,setResult] = React.useState<PureGraphOutput>();

  useSampleImages(
    React.useCallback(library => [library.banana],[]),
    setInputs);

  const graph = React.useMemo(() => 
    pureGraphs.mergePipe([
      operationAsRecord({type:"slideWrap",dimension:'y',amount:0})
      ,operationAsRecord({type:"slideWrap",dimension:'y',amount:50})
    ]
    ,operationAsRecord({type:'line',direction:'right',squish:false})
    ,[
      operationAsRecord({type:'grid',rows:3, cols:3})
    ]
  ),[]);

  React.useEffect(() => {
    if(!inputs){
      return;
    }
    pureGraphs.applyBottomUp(graph,inputs)
    .then(setResult);
  },[graph,inputs]);

  return (
    <div className="container-fluid">
      {result && <Outputs outputs={result.outputs}/>}
      {result && <div className="mt-3 row">
        {graph.nodes.map(n => n.op).map(op => (
          <div className="col-6">
          <div className="card mb-3" key={op.id} id={op.id}>
            <div className="card-body">
              <div>{PureRasterOperations.stringRepresentation(op)}</div>
              <div className="row align-items-center">
                <div className="col">
                  <div className="d-flex flex-column">
                    <OffscreenCanvasImageBundle images={result.inputsFor[op.id]} />
                    <div>
                      {(result.inputOperationsFor[op.id] ?? []).map(inputOp => (
                        <div key={inputOp.id}>
                          <a href={`#${inputOp.id}`}>
                            {PureRasterOperations.stringRepresentation(inputOp)}
                          </a>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="col-1 h3">
                  &rarr;
                </div>
                <div className="col text-center">
                  <div className="d-flex flex-column">
                    <OffscreenCanvasImageBundle images={result.outputsFor[op.id]} />
                  </div>
                </div>
              </div>
            </div>
          </div>
          </div>
        ))}
      </div>}
    </div>
  );
}