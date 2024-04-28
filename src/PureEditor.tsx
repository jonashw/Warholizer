import React from 'react';
import ImageUtil from './Warholizer/ImageUtil';
import { OffscreenCanvasImage } from './OffscreenCanvasImage';
import { PureRasterOperation, PureRasterOperations } from './Warholizer/RasterOperations/PureRasterOperation';
import { positiveNumber } from './Warholizer/RasterOperations/NumberTypes';
import onFilePaste from './Warholizer/onFilePaste';
import fileToDataUrl from './fileToDataUrl';
import { PureRasterApplicator, PureRasterApplicators } from './Warholizer/RasterOperations/PureRasterApplicator';
import { PureRasterApplicatorCardEditor } from './PureRasterApplicatorCardEditor';

export default () => {
    const [inputImages, setInputImages] = React.useState<{id:string,osc:OffscreenCanvas}[]>([]);
    const [outputImages, setOutputImages] = React.useState<{id:string,osc:OffscreenCanvas}[]>([]);
    const defaultApplicator: PureRasterApplicator = {"type":"flatMap", ops:[]};
    const [applicators,setApplicators] = React.useState<PureRasterApplicator[]>([defaultApplicator]);

    //const unixNow = () => new Date().valueOf();
    const newId = () => crypto.randomUUID().toString();

    React.useEffect(() => {
        setOutputImages([]);
        if(inputImages.length === 0){
            return;
        }
        const inputOffscreenCanvases = inputImages.map(i => i.osc);
        applicators.reduce(
            async (oscs,applicator) => 
                applicator.ops.length > 0 
                ? PureRasterApplicators.apply(applicator, await oscs)
                : oscs,
            Promise.resolve(inputOffscreenCanvases))
        .then(oscs => oscs.map(osc => ({osc, id: newId()})))
        .then(setOutputImages);
    },[inputImages,applicators]);

    const prepareInputImage = async (url: string) => {
        const osc = await ImageUtil.loadOffscreen(url);
        const op: PureRasterOperation = {
            type:'scaleToFit',
            w: positiveNumber(500),
            h: positiveNumber(500)
        };
        const scaled = await PureRasterOperations.apply(op, [osc]);
        setInputImages([
            ...inputImages,
            {
                id: newId(),
                osc: scaled[0]
            }
        ]);
    }

    React.useEffect(() => {
        prepareInputImage("/warhol.jpg")
        onFilePaste(async (data: ArrayBuffer | string) => {
            prepareInputImage(data.toString());
        });
    },[]);

    const useFile = async (file: File) => {
        const url = await fileToDataUrl(file);
        prepareInputImage(url.toString());
    };

    return (
        <div className="container-fluid">
            <div className="row">
                <div className="col-md-6 mb-3">
                    <div className="card">
                        <div className="card-header">
                            Inputs
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
                                                var files = Array.from(e.target.files || []);
                                                if (files.length !== 1) {
                                                    return;
                                                }
                                                useFile(files[0]);
                                            }}
                                        />
                                    </label>
                                )}
                            </div>
                        </div>

                    </div>
                    <div className="card mt-3">
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
                                            justifyContent:'center'
                                        }}>
                                            <OffscreenCanvasImage key={img.id} oc={img.osc} style={{maxWidth:s, maxHeight:s}}/>
                                        </div>
                                    );
                                })}
                            </div>
                            <pre>{JSON.stringify(outputImages.map(o => o.id),null,2)}</pre>
                        </div>
                    </div>
                </div>

                <div className="col-md-6 mb-3">
                    {applicators.map((applicator,i) =>
                        <div key={i} className="mb-3">
                            <PureRasterApplicatorCardEditor
                                id={i.toString()}
                                value={applicator}
                                onChange={updatedApplicator => {
                                    setApplicators(applicators.map(a => a === applicator ? updatedApplicator : a))
                                }} 
                                onRemove={() => {
                                    setApplicators(applicators.filter(a => a !== applicator))
                                }}
                            />
                        </div>
                    )}
                    <button className="btn btn-primary w-100" onClick={() => {
                        setApplicators([...applicators,defaultApplicator]);
                    }}>Add Applicator</button>
                </div>
            </div>
            <pre className="text-white">{JSON.stringify(applicators,null,2)}</pre>
        </div>
    );
};