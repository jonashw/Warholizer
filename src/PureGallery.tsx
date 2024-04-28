import React from 'react';
import ImageUtil from './Warholizer/ImageUtil';
import { applyPureOperationPipeline } from './Warholizer/RasterOperations/apply';
import { OffscreenCanvasImage } from './OffscreenCanvasImage';
import { Dimension, PureRasterOperation, PureRasterOperations } from './Warholizer/RasterOperations/PureRasterOperation';
import { Angle, Byte, Percentage, PositiveNumber, positiveNumber } from './Warholizer/RasterOperations/NumberTypes';
import onFilePaste from './Warholizer/onFilePaste';
import fileToDataUrl from './fileToDataUrl';

type ImageOutput = {description: string, imgs: OffscreenCanvas[], msElapsed: number};
type Effect = [string, (imgs:OffscreenCanvas[]) => Promise<OffscreenCanvas[]>, Effect[]?];

const pureExample = (name: string, ops: PureRasterOperation[]): Effect => 
    [
        name,
        async img => applyPureOperationPipeline(ops,img)
    ];

export default () => {
    const effects: Effect[] = [
        ...([100,200,300] as PositiveNumber[]).flatMap(w =>
        ([100,200,300] as PositiveNumber[]).map(h =>
            pureExample(`scaleToFit ${w},${h}`, [{type:'scaleToFit', w,h}]),
        )),
        ...([60,120,180] as Byte[]).map(value =>
            pureExample(`threshold ${value}`, [{type:'threshold', value}]),
        ),
        ...([50,100] as Percentage[]).map(percent =>
            pureExample(`grayscale ${percent}%`, [{type:'grayscale', percent}]),
        ),
        pureExample(`blur`, [{type:'blur', pixels: 3}]),
        ...([90,180,270] as Angle[]).map(degrees =>
            pureExample(`rotateHue ${degrees}deg`, [{type:'rotateHue', degrees}]),
        ),
        pureExample(`invert`, [{type:'invert'}]),
        pureExample(`double invert`, [
            {type:'invert'},
            {type:'invert'},
        ]),
        pureExample(`double invert`, [
            {type:'invert'},
            {type:'noop'},
        ]),
        ...(
            (['x','y'] as Dimension[]).flatMap(dimension => 
            ([20,50,80] as Percentage[]).map(amount => 
                pureExample(`Wrap ${dimension} ${amount}%`, [{type:'wrap',dimension,amount}]),
            ))
        ),
        ...(
            (['x','y'] as Dimension[]).flatMap(dimension => 
            [0.2,0.5,0.8].map(amount => 
                pureExample(`Scale ${dimension} ${amount*100}%`, [{
                    type:'scale',
                    x: dimension == 'x' ? amount : 1,
                    y: dimension == 'y' ? amount : 1
                }]),
            ))
        ),
        ...[1,2,3].map(n =>
            pureExample(`multiply(${n})`, [{type:'multiply',n}]),
        ),
    ];

    const [inputImages, setInputImages] = React.useState<{id:number,osc:OffscreenCanvas}[]>([]);
    const [outputImages,setOutputImages] = React.useState<({id:number,img:ImageOutput}|undefined)[]>(effects.map(_ => undefined));

    const unixNow = () => new Date().valueOf();

    const prepareInputImage = async (oscPromise: Promise<OffscreenCanvas>) => {
        const osc = await oscPromise;
        const op: PureRasterOperation = {
            type:'scaleToFit',
            w: positiveNumber(500),
            h: positiveNumber(500)
        };
        const scaled = await PureRasterOperations.apply(op, [osc]);
        setInputImages([
            ...inputImages,
            {
                id: unixNow(),
                osc: scaled[0]
            }
        ]);
    }

    React.useEffect(() => {
        prepareInputImage(ImageUtil.loadOffscreen("/warhol.jpg"))
        onFilePaste(async (data: ArrayBuffer | string) => {
            prepareInputImage(ImageUtil.loadOffscreen(data.toString()));
        });
    },[]);

    const useFile = async (file: File) => {
        const url = await fileToDataUrl(file);
        prepareInputImage(ImageUtil.loadOffscreen(url.toString()));
    };

    React.useEffect(() => {
        console.log('inputImages changed',inputImages);
        if(!inputImages.length){
            setOutputImages(effects.map(_ => undefined));
            console.log('inputZero has no value. no op');
            return;
        }
        console.log('refreshing...')
        setOutputImages(effects.map(_ => undefined));
        const effect = async () => {
            let outputs: ({img:ImageOutput, id: number}|undefined)[] = 
                effects.map(_ => undefined); //placeholders for unfinished effects

            let i = 1;
            for(let effect of effects){
                const ta = window.performance.now();
                const outputImgs = await effect[1](inputImages.map(i => i.osc));
                const tb = window.performance.now();
                const o = {
                    description: effect[0], 
                    imgs: outputImgs,
                    msElapsed: tb - ta,
                };
                outputs[i] = {img: o, id: unixNow()};
                i++;
                setOutputImages([...outputs]);
            }
        }
        effect();
    }, [inputImages]);

    return (
        <div className="container-fluid">
            <div className="row">
                <div className="col-sm-6 col-md-4 col-lg-3 col-xl-2 mb-4">
                    <div className="card text-white bg-primary">
                        {inputImages.map(img =>  
                        <>
                            <OffscreenCanvasImage key={img.id} oc={img.osc}/>
                            <div className="card-body">
                                <div className="d-flex justify-content-between align-items-center">
                                    {img.osc.width}&times;{img.osc.height}
                                    <button className="btn btn-danger btn-sm"
                                    onClick={() => {
                                        setInputImages(inputImages.filter(m => m !== img));
                                    }}>Remove</button>
                                </div>
                            </div>
                        </>)}
                        <div className="card-body">
                            <h6 className="card-title">Input Image</h6>
                            <div className="card-text">
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
                                        className="btn btn-primary"
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
                {outputImages.map((o,i) => o && 
                    <div key={i} className="col-sm-6 col-md-4 col-lg-3 col-xl-2 mb-4">
                        <div className="card">
                            {o.img.imgs.map((img,imgIndex) => 
                                <div key={imgIndex}>
                                    {o.img.imgs.length > 1 && <span>#{imgIndex+1}</span>}
                                    <OffscreenCanvasImage 
                                        key={`${o.id}-${i}-${imgIndex}`}
                                        oc={img} 
                                        className="card-img-top"
                                        style={{
                                            background:'white'
                                        }}
                                    />
                                    <div className="text-center">{img.width}&times;{img.height}</div>
                                </div>
                            )}
                            <div className="card-body">
                                <h6 className="card-title">{o.img.description}</h6>
                                <div className="card-text">
                                </div>
                                <div className="card-text">
                                    {o.img.msElapsed.toFixed(0)}ms<br/>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};