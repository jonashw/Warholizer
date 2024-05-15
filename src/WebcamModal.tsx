import React from "react";
import { OffscreenCanvasImage } from "./OffscreenCanvasImage";
import { Webcam } from "./Webcam";


export function WebcamModal({
  onClose
}: {
  onClose?: (oscs?: OffscreenCanvas[]) => void;
}) {
  const ref = React.createRef();
  const [frames, setFrames] = React.useState<OffscreenCanvas[]>([]);

  const cancel = () => {
    if (onClose) {
      onClose(undefined);
    }
  };

  return (
    <>
      <div className="modal fade show" tabIndex={-1} style={{ display: 'block' }}>
        <div className="modal-dialog">
          <div className="modal-content">
            <div className="modal-header">
              <h5 className="modal-title">Webcam Capture</h5>
              <button type="button" className="btn-close" aria-label="Close" onClick={cancel}></button>
            </div>
            <div className="modal-body">
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
            </div>
            <div className="modal-footer">
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
            </div>
          </div>
        </div>
      </div>
      <div className="modal-backdrop fade show"></div>
    </>
  );
}
