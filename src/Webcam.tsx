import React from "react";
import { loadOffscreen } from "./Warholizer/ImageUtil";

type FPS = 1|2|3|4|5;

const wait = (ms: number) => () => new Promise<void>(resolve => {
  setTimeout(() => {
    resolve();
  }, ms);
});

type FPSMeasurement = {totalMsElapsed: number; totalFrames: number; average: number};
const measureNextFrame = (totalMsElapsed: number, measurement: FPSMeasurement): FPSMeasurement => {
  const totalFrames = measurement.totalFrames+1;
  console.log({totalMsElapsed});
  return {
    totalMsElapsed,
    totalFrames, 
    average: totalMsElapsed/totalFrames
  };
};

export function Webcam({
  onFrame
}: {
  onFrame: (osc: OffscreenCanvas) => void;
}) {
  const [fps,setFps] = React.useState<FPS>(1);
  const videoElementRef = React.useRef<HTMLVideoElement>(null);
  React.useEffect(() => {
    if (!videoElementRef.current) {
      console.log('no video element yet');
      return;
    }
    let looping = true;
    const video = videoElementRef.current!;
    console.log('preparing video stream');
    const captureFrame = () => loadOffscreen(videoElementRef.current!).then(onFrame);
    const startPollingForFrames = async () => {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      video.srcObject = stream;
      video.oncanplay = () => {
        video.play();
      };
      video.onplaying = () => {
        const loop = () => { 
          if(!looping){
            return;
          }
          captureFrame()
          .then(wait(1000/fps))
          .then(() => requestAnimationFrame(loop));
        };
        setTimeout(() => {
          video.width = video.videoWidth;
          video.height = video.videoHeight;
          console.log('started playing', video.videoWidth, video.videoHeight, video);
          //setVideo(video);
          loop();
        }, 1000);
      };

    };
    startPollingForFrames();
    return () => {
      //cleanup
      console.log('cleanup')
      video.onplaying = null;
      looping = false;
    };
  }, [fps, onFrame, videoElementRef]);

  const videoElement = React.useMemo(() => {
    console.log('rendering video element');
    return <video key={"THE VIDEO STREAM"} ref={videoElementRef} style={{ display: 'none' }} />;
  }, [videoElementRef]);

  return (
    <div className="card">
      <div className="card-body">
        <label className="form-label">Target FPS ({fps})</label>
        <input className="form-range" type="range" min={1} max={5} step={1} value={fps} onChange={e => setFps(e.target.value as unknown as FPS)}/>
      </div>
      {videoElement}
    </div>
  );
}
