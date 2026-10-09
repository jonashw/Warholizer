import React from 'react';
import { applicatorAsRecord, Arrangement, PureRasterApplicators } from './Warholizer/RasterOperations/PureRasterApplicator';
import { PureRasterApplicatorsEditor } from './PureRasterApplicatorsEditor';
import { imageAsRecord, ImageRecord } from './ImageRecord';
import { InputsEditor } from './InputsEditor';
import { defaultApplicator } from './defaultApplicator';
import { Outputs } from './Outputs';
import { loadSampleImages, sampleImageUrls } from './sampleImageUrls';

export default function PureEditor() {
    const [inputImages, setInputImages] = React.useState<ImageRecord[]>();
    const [arrangement, setArrangement] = React.useState<Arrangement>({ applicators: [applicatorAsRecord(defaultApplicator)], perInput: false });
    const [result, setResult] = React.useState<{
        inputImages: ImageRecord[],
        arrangement: Arrangement,
        outputImages: ImageRecord[]
    }>();
    const outputImages =
        result && result.inputImages === inputImages && result.arrangement === arrangement
        ? result.outputImages
        : [];


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
        if(!inputImages){
            return;
        }
        if(inputImages.length === 0){
            return;
        }
        let cancelled = false;
        const inputOffscreenCanvases = inputImages.map(i => i.osc);
        PureRasterApplicators.applyArrangement(arrangement, inputOffscreenCanvases)
            .then(oscs => oscs.map(osc => ({osc, id: crypto.randomUUID().toString()})))
            .then(outputImages => {
                if(!cancelled){
                    setResult({inputImages, arrangement, outputImages});
                }
            });
        return () => { cancelled = true; };
    },[inputImages,arrangement]);

    return (
        <div className="container-fluid">
            {inputImages && (
                <div className="row">
                    <div className="col-md-6 mb-3">
                        <InputsEditor defaultInputs={inputImages} onChange={setInputImages} />
                    </div>

                    <div className="col-md-6 mb-3">
                        <PureRasterApplicatorsEditor
                            defaultArrangement={arrangement}
                            onChange={setArrangement}
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