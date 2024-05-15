import React from "react";
import { OffscreenCanvasImage } from "./OffscreenCanvasImage";
import { Webcam } from "./Webcam";
import { Modal } from "./Modal";

export function WebcamModal({
  onClose
}: {
  onClose?: (oscs?: OffscreenCanvas[]) => void;
}) {
  const ref = React.createRef();
  const [frames, setFrames] = React.useState<OffscreenCanvas[]>([]);
  const close = () => {
    if (onClose) {
      onClose(frames);
    }
  };

  return <Modal
      title="Webcam Capture" 
      flush
      onClose={close}
      body={<div className="text-center">
        <Webcam onFrame={frame => setFrames([...frames, frame])} ref={ref} />
        {frames.map((frame, i) => 
          <OffscreenCanvasImage
            className="mt-2"
            oc={frame}
            key={i}
            onClick={() => {
              setFrames(frames.filter(f => f !== frame));
            }}
            style={{maxWidth:'50px',cursor:'pointer'}}
          />)}
      </div>}
      footer={
        <button
          type="button"
          className="btn btn-primary w-100"
          disabled={frames.length === 0}
          onClick={close}
        >Use Captured Images</button>
      }
    />;
}
