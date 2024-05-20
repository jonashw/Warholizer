import { OffscreenCanvasImage } from './OffscreenCanvasImage';
import { ImageRecord } from './ImageRecord';


export function Thumbnail({
    sideLength,
    img,
    onClick
}: {
    sideLength: number;
    img: ImageRecord;
    onClick?: () => void
}) {
    const s = `${sideLength}px`;
    return (
        <div key={img.id} style={{
            width: s,
            height: s,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            outline: '1px solid blue'
        }}>
            <OffscreenCanvasImage
                onClick={onClick}
                key={img.id}
                oc={img.osc} 
                style={{
                    maxWidth: s,
                    maxHeight: s,
                    boxShadow: '0 1px 3px black'
                }} />
        </div>
    );
}
