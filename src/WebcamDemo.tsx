import React from "react";
import { WarholizerImage } from "./WarholizerImage";
import { angle, positiveNumber } from "./Warholizer/RasterOperations/NumberTypes";
import { PureRasterApplicatorRecord, PureRasterOperationRecord } from "./Warholizer/RasterOperations/PureRasterApplicator";
import { PureRasterApplicatorsEditor } from "./PureRasterApplicatorsEditor";
import { Webcam } from "./Webcam";
import { Tile } from "./Warholizer/RasterOperations/PureRasterOperation";
import { Buffer } from "./Buffer";

const defaultApplicator: PureRasterApplicatorRecord = {
  id:crypto.randomUUID(),
  "type":"pipe",
  ops:[
      { type: 'rotateHue',degrees:angle(90)},
      { type: 'tile', lineLength: 3, primaryDimension: 'x'} as Tile,
      { type: 'scaleToFit',w:positiveNumber(800),h:positiveNumber(800)}
  ].map(op => ({...op, id: crypto.randomUUID()} as PureRasterOperationRecord))};

export function WebcamDemo() {
  const [screenshot,setScreenshot] = React.useState<OffscreenCanvas>();
  const [applicators,setApplicators] = React.useState<PureRasterApplicatorRecord[]>([defaultApplicator]);
  const [buffer,setBuffer] = React.useState<Buffer<OffscreenCanvas>>(new Buffer(9));

  const webcam = React.useMemo(() => {
    const onFrame = (osc: OffscreenCanvas) => {
      setScreenshot(osc);
      setBuffer(buffer.push(osc));
    }

    return <Webcam onFrame={onFrame} />;
  }, [buffer]);

  return <div className="container-fluid">
    <div className="row">
      <div className="col-md-6">
        {webcam}
        {buffer.items.length}
        {screenshot && (
          <div className="card mt-4">
            <WarholizerImage
              src={buffer.items}
              className="card-img-top card-img-bottom"
              applicators={applicators}
            />
          </div>
        )}
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