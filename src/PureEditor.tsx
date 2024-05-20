import React from 'react';
import { OffscreenCanvasImage } from './OffscreenCanvasImage';
import { applicatorAsRecord, PureRasterApplicators } from './Warholizer/RasterOperations/PureRasterApplicator';
import { PureRasterApplicatorsEditor } from './PureRasterApplicatorsEditor';
import { ImageRecord } from './ImageRecord';
import { InputsEditor } from './InputsEditor';
import { defaultApplicator } from './defaultApplicator';
import { Thumbnail } from './Thumbnail';

export default function PureEditor() {
    const [inputImages, setInputImages] = React.useState<ImageRecord[]>([]);
    const [applicators, setApplicators] = React.useState([applicatorAsRecord(defaultApplicator)]);
    const [outputImages, setOutputImages] = React.useState<{id:string,osc:OffscreenCanvas}[]>([]);

    const newId = () => crypto.randomUUID().toString();

    React.useEffect(() => {
        setOutputImages([]);
        if(inputImages.length === 0){
            return;
        }
        const inputOffscreenCanvases = inputImages.map(i => i.osc);
        PureRasterApplicators.applyAll(applicators, inputOffscreenCanvases)
            .then(oscs => oscs.map(osc => ({osc, id: newId()})))
            .then(setOutputImages);
    },[inputImages,applicators]);

    return (
        <div className="container-fluid">
            <div className="row">
                <div className="col-md-6 mb-3">
                    <InputsEditor defaultInputs={inputImages} onChange={setInputImages}/>
                </div>

                <div className="col-md-6 mb-3">
                    <PureRasterApplicatorsEditor
                        defaultApplicators={applicators}
                        onChange={setApplicators} 
                        previewImages={inputImages}
                    />
                </div>

                <div className="col-12">
                    <div className="card">
                        <div className="card-header">
                            Outputs ({outputImages.length})
                        </div>

                        {outputImages.length === 1 && (
                            <OffscreenCanvasImage key={outputImages[0].id} oc={outputImages[0].osc} style={{
                                maxWidth:'100%', 
                                maxHeight:'100%'
                            }}/>
                        )}

                        {outputImages.length !== 1 && (
                            <div className="card-body">
                                <div className="d-flex justify-content-start gap-1 align-items-center">
                                    {outputImages.map(img => 
                                        <Thumbnail sideLength={90} img={img} key={img.id}/>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}