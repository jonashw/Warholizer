import React from 'react';
import { OffscreenCanvasImage } from './OffscreenCanvasImage';
import { positiveNumber } from './Warholizer/RasterOperations/NumberTypes';
import { applicatorAsRecord, PureRasterApplicators } from './Warholizer/RasterOperations/PureRasterApplicator';
import { WarholizerImage } from './WarholizerImage';
import { PureRasterApplicatorsEditor } from './PureRasterApplicatorsEditor';
import { ImageRecord } from './ImageRecord';
import { InputsEditor } from './InputsEditor';
import { defaultApplicator } from './defaultApplicator';

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
                    <PureRasterApplicatorsEditor defaultApplicators={applicators} onChange={setApplicators} />
                </div>

                <div className="col-12">
                    <div className="card">
                        <div className="card-header">
                            Outputs ({outputImages.length})
                        </div>

                        <div className="card-body">
                            <div className="d-flex justify-content-start gap-1 align-items-center">
                                {outputImages.map(img => {
                                    const s = '90px';
                                    return (
                                        <div key={img.id} style={{
                                            width:s,
                                            height:s,
                                            display:'flex',
                                            alignItems:'center',
                                            justifyContent:'center',
                                            outline: '1px solid blue'
                                        }}>
                                            <OffscreenCanvasImage key={img.id} oc={img.osc} style={{
                                                maxWidth:s, 
                                                maxHeight:s,
                                                boxShadow: '0 1px 3px black'
                                            }}/>
                                        </div>
                                    );
                                })}
                            </div>
                            <pre>{JSON.stringify(outputImages.map(o => o.id),null,2)}</pre>
                        </div>
                    </div>
                </div>
            </div>
            <pre className="text-white">{JSON.stringify(applicators,null,2)}</pre>
            <WarholizerImage 
                src="/warhol.jpg"
                applicators={[{
                    type:'pipe',
                    ops: [
                        {type:'scaleToFit',h:positiveNumber(600),w:positiveNumber(600)},
                        {type:'slideWrap',amount:50,dimension:'x'},
                        {type:'slideWrap',amount:50,dimension:'y'},
                        {type:'grid',cols:2,rows:2}
                    ]}]}
            />
        </div>
    );
}