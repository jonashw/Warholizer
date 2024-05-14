import React from 'react';
import ImageUtil from './Warholizer/ImageUtil';
import { OffscreenCanvasImage } from './OffscreenCanvasImage';
import { PureRasterOperation, PureRasterOperations } from './Warholizer/RasterOperations/PureRasterOperation';
import { positiveNumber } from './Warholizer/RasterOperations/NumberTypes';
import onFilePaste from './Warholizer/onFilePaste';
import fileToDataUrl from './fileToDataUrl';
import { PureRasterApplicator, applicatorAsRecord, PureRasterApplicators } from './Warholizer/RasterOperations/PureRasterApplicator';
import { useUndo } from './undo/useUndo';
import { UndoRedoToolbar } from './undo/UndoRedoToolbar';
import { WarholizerImage } from './WarholizerImage';
import { PureRasterApplicatorsEditor } from './PureRasterApplicatorsEditor';

export const defaultApplicator: PureRasterApplicator = { "type":"flatMap", ops:[ ]};

export default function PureEditor() {
    const [inputImages, setInputImages, inputImagesUndoController] = useUndo<{id:string,osc:OffscreenCanvas}[]>([]);
    const [applicators, setApplicators] = React.useState([ applicatorAsRecord(defaultApplicator)    ]);
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

    const prepareInputImages = async (urls: string[]) => {
        const newInputImages = await Promise.all(urls.map(async url => {
            const osc = await ImageUtil.loadOffscreen(url);
            const op: PureRasterOperation = {
                type:'scaleToFit',
                w: positiveNumber(500),
                h: positiveNumber(500)
            };
            return await PureRasterOperations.apply(op, [osc]);
        }));
        setInputImages([
            ...inputImages,
            ...newInputImages.map(scaled => ({
                id: newId(),
                osc: scaled[0]
            }))
        ]);
    }

    React.useEffect(() => {
        prepareInputImages(["/warhol.jpg","/banana.jpg","/soup-can.jpg"])
        onFilePaste(async (data: ArrayBuffer | string) => {
            prepareInputImages([data.toString()]);
        });
    },[]);

    const prepareFile = async (file: File) => {
        const url = await fileToDataUrl(file);
        prepareInputImages([url.toString()]);
    };

    return (
        <div className="container-fluid">
            <div className="row">
                <div className="col-md-6 mb-3">
                    <div className="card">
                        <div className="card-header d-flex justify-content-between align-items-center">
                            Inputs
                            <UndoRedoToolbar controller={inputImagesUndoController} />
                        </div>

                        <div className="list-group list-group-flush">
                            {inputImages.map(img => {
                                const s = '30px';
                                return <div className="list-group-item" key={img.id}>
                                    <div className="d-flex justify-content-between align-items-center">
                                        <div style={{
                                            width:s,
                                            height:s,
                                            display:'flex',
                                            alignItems:'center',
                                            justifyContent:'center'
                                        }}>
                                            <OffscreenCanvasImage key={img.id} oc={img.osc} style={{maxWidth:s, maxHeight:s}}/>
                                        </div>
                                        {img.osc.width}&times;{img.osc.height}
                                        <button className="btn btn-outline-danger btn-sm"
                                        onClick={() => {
                                            setInputImages(inputImages.filter(m => m !== img));
                                        }}>Remove</button>
                                    </div>
                                </div>;
                            })}
                        </div>

                        <div className="card-footer">
                            <div className="d-flex justify-content-between align-items-center">
                                Add via 
                                {([
                                    {
                                        label:"Upload",
                                        id:"file-upload-regular",
                                        capture: undefined

                                    },
                                    {
                                        label:"Capture",
                                        id:"file-upload-capture",
                                        capture: "user"
                                    }
                                ] as {
                                    label: string,
                                    id: string,
                                    capture: undefined | "user" | "environment"
                                }[]).map(o => 
                                    <label
                                        htmlFor={o.id}
                                        className="btn btn-primary btn-sm"
                                        key={o.id}
                                    >
                                        {o.label}
                                        <input 
                                            id={o.id}
                                            style={{display:'none'}}
                                            type="file" 
                                            className="form-control"
                                            capture={o.capture}
                                            accept="image/jpeg, image/png, image/gif"
                                            onChange={e => {
                                                const files = Array.from(e.target.files || []);
                                                if (files.length !== 1) {
                                                    return;
                                                }
                                                prepareFile(files[0]);
                                            }}
                                        />
                                    </label>
                                )}
                            </div>
                        </div>

                    </div>
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
                        {type:'scale',x:1,y:-1},
                        {type:'slideWrap',amount:50,dimension:'x'},
                        {type:'slideWrap',amount:50,dimension:'y'}
                    ]}]}
            />
        </div>
    );
}