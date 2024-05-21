import { OffscreenCanvasImage } from './OffscreenCanvasImage';
import { ImageRecord } from './ImageRecord';

export type CSSLength = number | `${number}${'px'|'cm'|'mm'|'em'}`

export function Thumbnail({
    side,
    img,
    onClick
}: {
    side: CSSLength
    img?: ImageRecord;
    onClick?: () => void
}) {
    return (
        <div key={img?.id} 
            onClick={onClick}
            style={{
                width: side,
                height: side,
                display: 'flex',
                position:'relative',
                background: 'white',
                alignItems: 'center',
                justifyContent: 'center',
                outline: '1px solid blue',
                cursor: 'pointer',
                opacity: img ? 1 : 0.25
            }}
        >
            {img && <OffscreenCanvasImage
                key={img?.id}
                oc={img.osc} 
                style={{
                    maxWidth: side,
                    maxHeight: side,
                    boxShadow: '0 1px 3px black'
                }} />
            }
        </div>
    );
}