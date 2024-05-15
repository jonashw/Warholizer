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

  return <Modal
      title="Webcam Capture" 
      body={<>
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
      </>}
      footer={
        <button
          type="button"
          className="btn btn-primary w-100"
          disabled={frames.length === 0}
          onClick={() => {
            if (onClose) {
              onClose(frames);
            }
          }}
        >Use Captured Images</button>
      }
    />;
}
