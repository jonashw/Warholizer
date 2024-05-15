import React from "react";
import { loadOffscreen } from "./Warholizer/ImageUtil";

export const Webcam = React.forwardRef(function ({
  onFrame
}: {
  onFrame: (osc: OffscreenCanvas) => void;
},ref) {
  const videoElementRef = React.useRef<HTMLVideoElement>(null);

  React.useEffect(() => {
    if (!videoElementRef.current) {
      console.log('no video element yet');
      return;
    }
    const video = videoElementRef.current!;
    const init = async () => {
      console.log('preparing video stream');
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      video.autoplay = true;
      video.srcObject = stream;
      video.onplaying = () => {
        console.log('started playing', video);
      };

    };

    init();

    return () => {
      console.log('cleanup')
      video.onplaying = null;
    };
  }, [onFrame, videoElementRef]);

  const capture = () => {
    if (!videoElementRef.current) {
      console.log('no video element yet');
      return;
    }
    const video = videoElementRef.current!;
    loadOffscreen(video).then(onFrame).then(() => {
    });
  };

  React.useImperativeHandle(ref, () => {
    return {
      capture: () => new Promise(resolve => {
        if (!videoElementRef.current) {
          console.log('no video element yet');
          return Promise.resolve();
        }
        const video = videoElementRef.current!;

        loadOffscreen(video).then(resolve).then(() => {
        });
      })
    };
  });

  const videoElement = React.useMemo(() => {
    console.log('rendering video element');
    return (
      <video 
        style={{maxWidth:'100%'}}
        key={"THE VIDEO STREAM"}
        ref={videoElementRef}
      />
    );
  }, []);

  return (<div 
    style={{cursor:'pointer'}}
    onClick={capture}
  >
    {videoElement}
    <div>Click/tap the video to capture</div>
  </div>);
});