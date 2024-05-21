import React from 'react';
import { applicatorAsRecord, PureRasterApplicators } from './Warholizer/RasterOperations/PureRasterApplicator';
import { PureRasterApplicatorsEditor } from './PureRasterApplicatorsEditor';
import { imageAsRecord, ImageRecord } from './ImageRecord';
import { InputsEditor } from './InputsEditor';
import { defaultApplicator } from './defaultApplicator';
import { Outputs } from './Outputs';
import { loadSampleImages, sampleImageUrls } from './sampleImageUrls';

export default function PureEditor() {
    const [inputImages, setInputImages] = React.useState<ImageRecord[]>();
    const [applicators, setApplicators] = React.useState([applicatorAsRecord(defaultApplicator)]);
    const [outputImages, setOutputImages] = React.useState<ImageRecord[]>([]);

    const newId = () => crypto.randomUUID().toString();

    React.useEffect(() => {
        loadSampleImages([
            sampleImageUrls.warhol,
            sampleImageUrls.banana,
            sampleImageUrls.soupCan
        ])
        .then(imgs => imgs.map(imageAsRecord))
        .then(setInputImages)
    },[]);

    React.useEffect(() => {
        setOutputImages([]);
        if(!inputImages){
            return;
        }
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
            {inputImages && (
                <div className="row">
                    <div className="col-md-6 mb-3">
                        <InputsEditor defaultInputs={inputImages} onChange={setInputImages} />
                    </div>

                    <div className="col-md-6 mb-3">
                        <PureRasterApplicatorsEditor
                            defaultApplicators={applicators}
                            onChange={setApplicators}
                            previewImages={inputImages}
                        />
                    </div>

                    <div className="col-12">
                        <Outputs outputs={outputImages} />

                    </div>
                </div>
            )}
        </div>
    );
}