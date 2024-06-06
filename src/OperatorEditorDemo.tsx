import React from "react";
import { PureRasterOperationRecord, operationAsRecord } from "./Warholizer/RasterOperations/PureRasterApplicator";
import { ImageRecord, imageAsRecord } from "./ImageRecord";
import { loadSampleImages, sampleImageUrls } from "./sampleImageUrls";
import { PureRasterOperationInlineEditor } from "./Warholizer/RasterOperations/PureRasterOperationInlineEditor";
import { Outputs } from "./Outputs";
import { PureRasterOperation, PureRasterOperations } from "./Warholizer/RasterOperations/PureRasterOperation";
import { sampleOperations } from "./sampleOperations";
import { InputsEditor } from "./InputsEditor";

export function OperatorEditorDemo() {
  const [inputs, setInputs] = React.useState<ImageRecord[]>();
  const [ops, setOps] = React.useState<PureRasterOperationRecord[]>(([
    ...sampleOperations
    ,{ type: 'rotate', about: 'center', degrees: 135}
    ,{ type: 'invert'}
  ] as PureRasterOperation[]).map(operationAsRecord));
  const [outputSets, setOutputSets] = React.useState<ImageRecord[][]>();

  React.useEffect(() => {
    if(!inputs){
      return;
    }
    Promise.all(ops.map(op => 
      PureRasterOperations.apply(op,inputs.map(i => i.osc))
      .then(outputs => outputs.map(imageAsRecord)))
    )
    .then(setOutputSets);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[inputs/*,ops (USE MORE GRANULAR RE-APPLY ON CHANGE FOR BETTER PERFORMANCE) */]);

  React.useEffect(() => {
    loadSampleImages([
      sampleImageUrls.warhol
    ])
      .then(imgs => imgs.map(imageAsRecord))
      .then(setInputs);
  }, []);

  const onOpChange = (changedOp: PureRasterOperationRecord) =>{
    const index = ops.findIndex(o => o.id === changedOp.id);
    if(inputs && outputSets){
      PureRasterOperations
      .apply(changedOp,inputs.map(i => i.osc))
      .then(imgs => imgs.map(imageAsRecord))
      .then(updatedOutputSet => {
        setOutputSets(outputSets.map((os,i) => i === index ? updatedOutputSet : os));
      });
    }
    setOps(ops.map(o => o.id === changedOp.id ? changedOp : o));
  }

  return <div className="container-fluid">
    {inputs && (
      <div className="mb-3">
        <InputsEditor
          defaultInputs={inputs}
          onChange={setInputs}
        />
      </div>
    )}
    <div className="row">
    {ops.map((op, i) =>
      <div className="col-xl-6" key={op.id}>
        <div className="card mb-3">
          <div className="card-body">
            <div className="row">
              <div className="col-md-1">
                {outputSets && outputSets[i] && <Outputs outputs={outputSets[i]} noHeader />}
              </div>
              <div className="col-md-3">
                <pre>{PureRasterOperations.stringRepresentation(op)}</pre>
              </div>
              <div className="col-md-8">
                <div className="d-flex justify-content-between">
                  <PureRasterOperationInlineEditor
                    onChange={onOpChange}
                    value={op} />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    )}
    </div>
  </div>;
}
