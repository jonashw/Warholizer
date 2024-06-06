import { OffscreenCanvasImage } from './OffscreenCanvasImage';
import { ImageRecord } from './ImageRecord';
import { Thumbnail } from './Thumbnail';


export function Outputs({
    outputs,
    noHeader 
}: {
    outputs: ImageRecord[],
    noHeader?: boolean 
}) {
    return (
        <div className="card">
            {!noHeader && <div className="card-header">
                Outputs ({outputs.length})
            </div>}

            {outputs.length === 1 && (
                <OffscreenCanvasImage key={outputs[0].id} oc={outputs[0].osc} style={{
                    maxWidth: '100%',
                    maxHeight: '100%'
                }} />
            )}

            {outputs.length !== 1 && (
                <div className="card-body">
                    <div className="d-flex justify-content-start gap-1 align-items-center flex-wrap">
                        {outputs.map(img => <Thumbnail side={"90px"} img={img} key={img.id} />
                        )}
                        {outputs.length === 0 && (
                            <Thumbnail side={"90px"} img={undefined} />
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
