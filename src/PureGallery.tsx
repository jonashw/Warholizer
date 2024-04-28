import React from 'react';
import ImageUtil from './Warholizer/ImageUtil';
import { applyPureOperationPipeline } from './Warholizer/RasterOperations/apply';
import { OffscreenCanvasImage } from './OffscreenCanvasImage';
import { Dimension, PureRasterOperation } from './Warholizer/RasterOperations/PureRasterOperation';
import { Angle, Byte, Percentage } from './Warholizer/RasterOperations/NumberTypes';
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

    const [outputImages,setOutputImages] = React.useState<({id:number,img:ImageOutput}|undefined)[]>(effects.map(_ => undefined));
    const [inputZero, setInputZero] = React.useState<{id:number,osc:OffscreenCanvas}>();

    const unixNow = () => new Date().valueOf();

    React.useEffect(() => {
        ImageUtil.loadOffscreen("/warhol.jpg")
            .then(osc => setInputZero({id:unixNow(),osc}));

        onFilePaste(async (data: ArrayBuffer | string) => {
            let osc = await ImageUtil.loadOffscreen(data.toString());
            setInputZero({osc, id: unixNow()});
        });
    },[]);

    const useFile = async (file: File) => {
        const url = await fileToDataUrl(file);
        const osc = await ImageUtil.loadOffscreen(url.toString());
        setInputZero({osc,id:unixNow()});
    };

    React.useEffect(() => {
        console.log('inputZero changed',inputZero);
        if(!inputZero){
            console.log('inputZero has no value. no op');
            return;
        }
        console.log('refreshing...')
        setOutputImages(effects.map(_ => undefined));
        const effect = async () => {
            let input = inputZero;
            let outputs: ({img:ImageOutput, id: number}|undefined)[] = 
                effects.map(_ => undefined); //placeholders for unfinished effects

            let i = 1;
            for(let effect of effects){
                const ta = window.performance.now();
                const outputImgs = await effect[1]([input.osc]);
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
    }, [inputZero]);

    return (
        <div className="container-fluid">
            <div className="row">
                <div className="col-sm-6 col-md-4 col-lg-3 col-xl-2 mb-4">
                    <div className="card text-white bg-primary">
                        {inputZero ? <OffscreenCanvasImage key={inputZero.id} oc={inputZero.osc}/> : <></>}
                        <div className="card-body">
                            <h6 className="card-title">Input Image</h6>
                            <div className="card-text">
                                <input 
                                    type="file" 
                                    className="form-control"
                                    capture="user"
                                    accept="image/jpeg, image/png, image/gif"
                                    onChange={e => {
                                        var files = Array.from(e.target.files || []);
                                        console.log({files});
                                        if (files.length !== 1) {
                                            return;
                                        }
                                        useFile(files[0]);
                                    }}/>
                            </div>
                        </div>
                    </div>
                </div>
                {inputZero && outputImages.map((o,i) => o && 
                    <div key={i} className="col-sm-6 col-md-4 col-lg-3 col-xl-2 mb-4">
                        <div className="card">
                            {o.img.imgs.map((img,imgIndex) => 
                                <div key={i}>
                                    {o.img.imgs.length > 1 && <span>#{i+1}</span>}
                                    <OffscreenCanvasImage 
                                        key={`${o.id}-${i}-${imgIndex}`}
                                        oc={img} 
                                        className="card-img-top"
                                        style={{
                                            background:'white'
                                        }}
                                    />
                                </div>
                            )}
                            <div className="card-body">
                                <h6 className="card-title">{o.img.description}</h6>
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