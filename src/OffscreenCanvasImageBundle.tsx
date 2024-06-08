import { ImageRecord } from "./ImageRecord";
import { OffscreenCanvasImage } from "./OffscreenCanvasImage";

export function OffscreenCanvasImageBundle({
  images,
  maxWidth
}: {
  images: ImageRecord[]; 
  maxWidth?: number
}) {
  return <>
    {images.map(img => <OffscreenCanvasImage
      key={img.id}
      oc={img.osc}
      style={{
        maxWidth: `${maxWidth ?? 200}px`,
        border: '1px solid blue',
        marginRight: '5px',
        marginBottom: '5px'
      }} />
    )}
  </>;
}