import React from "react";
import { WarholizerImage } from "./WarholizerImage";
import { angle, positiveNumber } from "./Warholizer/RasterOperations/NumberTypes";
import { PureRasterApplicatorRecord, PureRasterOperationRecord } from "./Warholizer/RasterOperations/PureRasterApplicator";
import { PureRasterApplicatorsEditor } from "./PureRasterApplicatorsEditor";
import { Webcam } from "./Webcam";

export function WebcamDemo() {
  const [screenshot,setScreenshot] = React.useState<OffscreenCanvas>();

const defaultApplicator: PureRasterApplicatorRecord = {
    id:crypto.randomUUID(),
    "type":"pipe",
    ops:[
        { type: 'rotateHue',degrees:angle(90)},
        { type: 'grid',cols:4,rows:4},
        { type: 'scaleToFit',w:positiveNumber(800),h:positiveNumber(800)}
    ].map(op => ({...op, id: crypto.randomUUID()} as PureRasterOperationRecord))};

const [applicators,setApplicators] = React.useState<PureRasterApplicatorRecord[]>([defaultApplicator]);

  return <div className="container-fluid">
    <div className="row">

      <div className="col-md-6">
        {screenshot && <WarholizerImage
          src={screenshot}
          className="img-fluid"
          style={{ border: '1px solid white' }}
          applicators={applicators}
        />}
        <Webcam onFrame={setScreenshot}/>
        {!screenshot && <div className="text-light">Loading...</div>}
      </div>
      <div className="col-md-6">
        <PureRasterApplicatorsEditor
          defaultApplicators={applicators}
          onChange={setApplicators}
        />
      </div>
    </div>
  </div>;
}