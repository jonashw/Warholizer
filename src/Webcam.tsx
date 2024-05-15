import React from "react";
import { loadOffscreen } from "./Warholizer/ImageUtil";

export function Webcam({
  onFrame
}: {
  onFrame: (osc: OffscreenCanvas) => void;
}) {
  const videoElementRef = React.useRef<HTMLVideoElement>(null);
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
          console.log('started playing', video.videoWidth, video.videoHeight, video);
          //setVideo(video);
          setInterval(() => {
            loadOffscreen(videoElementRef.current!).then(onFrame);
          }, 200);
        }, 1000);
      };
    };
    effect();
  }, [onFrame, videoElementRef]);

  const videoElement = React.useMemo(() => {
    console.log('rendering video element');
    return <video key={"THE VIDEO STREAM"} ref={videoElementRef} style={{ display: 'none' }} />;
  }, [videoElementRef]);

  return videoElement;
}
