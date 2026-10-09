import React from "react";
import ReactCrop, { PercentCrop } from "react-image-crop";
import 'react-image-crop/dist/ReactCrop.css';
import { Modal } from "../../../../Modal";
import { CanvasView } from "../../../../CanvasView";
import { Crop } from "../types";

const round2 = (n: number) => Math.round(n * 100) / 100;

/** The crop as percentages of the input, converting pixel crops using the input's size. */
const toPercentCrop = (op: Crop, input: OffscreenCanvas | undefined): PercentCrop => {
  if (op.unit === '%' || !input || input.width === 0 || input.height === 0) {
    return { unit: '%', x: op.x, y: op.y, width: op.width, height: op.height };
  }
  return {
    unit: '%',
    x: 100 * op.x / input.width,
    y: 100 * op.y / input.height,
    width: 100 * op.width / input.width,
    height: 100 * op.height / input.height,
  };
};

/**
 * Crop by dragging over the image flowing into the operation, as in the original Warholizer editor.
 * The result is stored in percent, so it applies at any resolution (previews are often downscaled)
 * and to every input of the operation.
 */
export function VisualCropModal({
  op, inputs, onChange, onClose
}: {
  op: Crop,
  inputs: () => Promise<OffscreenCanvas[]>,
  onChange: (op: Crop) => void,
  onClose: () => void
}) {
  const [images, setImages] = React.useState<OffscreenCanvas[]>();
  const [index, setIndex] = React.useState(0);
  const [crop, setCrop] = React.useState<PercentCrop>();

  React.useEffect(() => {
    let cancelled = false;
    inputs().then(imgs => {
      if (!cancelled) {
        setImages(imgs);
        setCrop(toPercentCrop(op, imgs[0]));
      }
    });
    return () => { cancelled = true; };
    // Load once per opening; later changes come from this modal.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const image = images?.[index];
  const apply = () => {
    if (crop && crop.width > 0 && crop.height > 0) {
      onChange({
        ...op,
        unit: '%',
        x: round2(crop.x), y: round2(crop.y), width: round2(crop.width), height: round2(crop.height)
      });
    }
    onClose();
  };

  return (
    <Modal
      title="Crop"
      onClose={onClose}
      body={
        <div>
          {!images && <div className="text-muted">Loading…</div>}
          {images && images.length === 0 && <div className="text-muted">No images flow into this operation yet.</div>}
          {images && images.length > 1 && (
            <div className="d-flex gap-1 mb-2 flex-wrap">
              {images.map((img, i) => (
                <button key={i} className={"btn btn-sm p-0 border " + (i === index ? "border-primary border-2" : "")}
                  onClick={() => setIndex(i)} title={`Preview on input ${i + 1}`}>
                  <CanvasView osc={img} style={{ height: '40px', display: 'block' }} />
                </button>
              ))}
            </div>
          )}
          {image && (
            <div className="d-flex justify-content-center" style={{ background: '#eee' }}>
              <ReactCrop crop={crop} onChange={(_, percentCrop) => setCrop(percentCrop)}>
                <CanvasView osc={image} style={{ maxWidth: '100%', maxHeight: '65vh', display: 'block' }} />
              </ReactCrop>
            </div>
          )}
          {crop && (
            <div className="small text-muted mt-2">
              {round2(crop.x)}%, {round2(crop.y)}% · {round2(crop.width)}% × {round2(crop.height)}%
              {images && images.length > 1 && ' · applies to every input'}
            </div>
          )}
        </div>
      }
      footer={
        <div className="d-flex gap-2">
          <button className="btn btn-outline-secondary" onClick={() => setCrop({ unit: '%', x: 0, y: 0, width: 100, height: 100 })}>Reset</button>
          <button className="btn btn-outline-secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={apply} disabled={!crop || crop.width === 0 || crop.height === 0}>Apply</button>
        </div>
      }
    />
  );
}
