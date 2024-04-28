import React from 'react';
import ImageUtil from './Warholizer/ImageUtil';
import { OffscreenCanvasImage } from './OffscreenCanvasImage';
import { PureRasterOperation, PureRasterOperations } from './Warholizer/RasterOperations/PureRasterOperation';
import { angle,byte, positiveNumber } from './Warholizer/RasterOperations/NumberTypes';
import onFilePaste from './Warholizer/onFilePaste';
import fileToDataUrl from './fileToDataUrl';
import { PureRasterApplicator, PureRasterApplicators } from './Warholizer/RasterOperations/PureRasterApplicator';
import { PureRasterOperationInlineEditor } from './Warholizer/RasterOperations/PureRasterOperationInlineEditor';

const sampleOperations: PureRasterOperation[] = [
    {"type":"invert"},
    {"type":"stack",dimension:'x'},
    {"type":"threshold", value: byte(128)},
    {"type":"rotateHue",degrees: angle(180)},
    {"type":"multiply",n: 2},
    {"type":"wrap",amount:50,dimension:'x'},
    {"type":"grayscale",percent:100},
    {"type":"blur",pixels:5}
];
export default () => {
    const [inputImages, setInputImages] = React.useState<{id:string,osc:OffscreenCanvas}[]>([]);
    const [outputImages, setOutputImages] = React.useState<{id:string,osc:OffscreenCanvas}[]>([]);
    const [applicator,setApplicator] = React.useState<PureRasterApplicator>({"type":"flatMap", ops:[{type:"invert"}]});
    const selectRef = React.createRef<HTMLSelectElement>();

    //const unixNow = () => new Date().valueOf();
    const newId = () => crypto.randomUUID().toString();

    React.useEffect(() => {
        setOutputImages([]);
        if(inputImages.length === 0 || applicator.ops.length === 0){
            return;
        }
        PureRasterApplicators.apply(
            applicator,
            inputImages.map(i => i.osc))
        .then(oscs => oscs.map(osc => ({osc, id: newId()})))
        .then(setOutputImages);
    },[inputImages,applicator]);

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
                </div>

                <div className="col-md-6 mb-3">
                    <div className="card">
                        <div className="card-header d-flex justify-content-between">
                            Operations

                            <div>
                                {PureRasterApplicators.types.map(t => 
                                    <label key={t} className="ms-3">
                                        <input
                                            type="radio"
                                            name="applicatorType" 
                                            value={t}
                                            checked={applicator.type === t}
                                            onChange={e => {
                                                if(e.target.value === t){
                                                    setApplicator({...applicator, type: t});
                                                }
                                            }}
                                        />
                                        {' '}{t}
                                    </label>
                                )}
                            </div>
                        </div>

                        <div className="list-group list-group-flush">
                            {applicator.ops.map((op,i) => 
                                <div className="list-group-item" key={`${i}-${op.type}`}>
                                    <div className="d-flex justify-content-between">
                                        <PureRasterOperationInlineEditor id={i.toString()} value={op} onChange={newOp => {
                                            setApplicator({
                                                ...applicator,
                                                ops: applicator.ops.map(o => o == op ? newOp : o)
                                            });
                                        }}/>
                                        <button className="btn btn-sm btn-outline-danger"
                                            onClick={() => {
                                                setApplicator({
                                                    ...applicator,
                                                    ops: applicator.ops.filter(o => o !== op)
                                                });
                                            }}
                                        >Remove</button>
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="card-footer">
                            <div className="d-flex justify-content-between">
                                <select
                                    ref={selectRef}
                                    value={undefined}
                                    onChange={e => {
                                        const op = sampleOperations.filter(op => op.type === e.target.value)[0];
                                        if(!op){
                                            return;
                                        }
                                        console.log({op});
                                        setApplicator({
                                            ...applicator,
                                            ops: [...applicator.ops, {...op}]
                                        });
                                        if(selectRef.current){
                                            selectRef.current.value = "";
                                        }
                                    }}
                                >
                                    <option value={""}>Add an operation</option>
                                    {sampleOperations.map(op => 
                                        <option key={op.type} value={op.type}>{op.type}</option>
                                    )}
                                </select>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            <div className="card">
                <div className="card-header">
                    Output ({outputImages.length})
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
    );
};