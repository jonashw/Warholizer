import React from "react";
import { WarholizerImage } from "./WarholizerImage";
import { angle, positiveNumber } from "./Warholizer/RasterOperations/NumberTypes";
import { loadOffscreen } from "./Warholizer/ImageUtil";
import { PureRasterApplicatorListItemEditor } from "./PureRasterApplicatorListItemEditor";
import { PureRasterApplicatorRecord, PureRasterOperationRecord } from "./Warholizer/RasterOperations/PureRasterApplicator";

export function WebcamDemo() {
  const videoElementRef = React.useRef<HTMLVideoElement>(null);
  const [screenshot,setScreenshot] = React.useState<OffscreenCanvas>();
  React.useEffect(() => {
    const effect = async () => {
      if (!videoElementRef.current) {
        console.log('no video element yet');
        return;
      }
      console.log('preparing video stream');
      const video = videoElementRef.current!;
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      //setStream(stream);
      video.srcObject = stream;
      video.oncanplay = () => {
        video.play();
      };
      video.onplaying = () => {
        setTimeout(() => {
          video.width = video.videoWidth;
          video.height = video.videoHeight;
          console.log('started playing',video.videoWidth,video.videoHeight,video);
          //setVideo(video);
          setInterval(() => {
            loadOffscreen(videoElementRef.current!).then(setScreenshot)
          },200);
        },1000);
      }
    };
    effect();
  }, [videoElementRef]);

  const videoElement = React.useMemo(() => {
    console.log('rendering video element');
    return <video key={"THE VIDEO STREAM"} ref={videoElementRef} style={{display:'none'}}/>
  }, [videoElementRef]);

  React.useEffect(() => {
    if(!screenshot){
      return;
    }
  },[screenshot])

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
        {videoElement}
        {!screenshot && <div className="text-light">Loading...</div>}
      </div>
      <div className="col-md-6">
        {applicators.map((applicator, i) =>
          <PureRasterApplicatorListItemEditor
            key={i}
            value={applicator}
            onChange={updatedApplicator => {
              setApplicators(applicators.map(a => a === applicator ? updatedApplicator : a))
            }}
            onRemove={() => {
              setApplicators(applicators.filter(a => a !== applicator))
            }}
          />
        )}
      </div>
    </div>
  </div>;
}