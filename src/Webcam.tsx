import React from "react";
import { loadOffscreen } from "./Warholizer/ImageUtil";

type FPS = 1|2|3|4|5;

const wait = (ms: number) => () => new Promise<void>(resolve => {
  setTimeout(() => {
    resolve();
  }, ms);
});

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

    const captureFrame = () => 
      loadOffscreen(video)
      .then(onFrame);

    const startPollingForFrames = async () => {
      console.log('preparing video stream');
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      video.autoplay = true;
      video.srcObject = stream;
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
          console.log('started playing', video);
          loop();
        }, 1000);
      };

    };

    startPollingForFrames();

    return () => {
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
      <div className="card-header">
        Webcam Input
      </div>
      <div className="card-body">
        <label className="form-label">Target FPS ({fps})</label>
        <input className="form-range"
          type="range"
          value={fps} 
          min={1} max={5} step={1}
          onChange={e => setFps(e.target.value as unknown as FPS)}
        />
      </div>
      {videoElement}
    </div>
  );
}