import React from 'react';
import ImageUtil from './Warholizer/ImageUtil';
import { applyPureOperationPipeline } from './Warholizer/RasterOperations/apply';
import { OffscreenCanvasImage } from './OffscreenCanvasImage';
import { Dimension, PureRasterOperation } from './Warholizer/RasterOperations/PureRasterOperation';
import { Angle, Byte, Percentage } from './Warholizer/RasterOperations/NumberTypes';

type ImageOutput = {description: string, imgs: OffscreenCanvas[], msElapsed: number};
type Effect = [string, (imgs:OffscreenCanvas[]) => Promise<OffscreenCanvas[]>, Effect[]?];

const pureExample = (name: string, ops: PureRasterOperation[]): Effect => 
    [
        name,
        async img => applyPureOperationPipeline(ops,img)
    ];

export default () => {
    const effects: Effect[] = [
        pureExample(`noop`, [{type:'noop'}]),
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
    ];

    const [outputImages,setOutputImages] = React.useState<(ImageOutput|undefined)[]>(effects.map(_ => undefined));

    React.useEffect(() => {
        const effect = async () => {
            var t0 = window.performance.now();
            const inputZero = await ImageUtil.loadOffscreen("/warhol.jpg");
            var t1 = window.performance.now();
            let input = inputZero;
            let outputs: (ImageOutput|undefined)[] = [
                {
                    description: "Original",
                    imgs: [input],
                    msElapsed: t1 - t0,
                },
                ...effects.map(_ => undefined) //placeholders for unfinished effects
            ];

            let i = 1;
            for(let effect of effects){
                const ta = window.performance.now();
                const outputImgs = await effect[1]([input]);
                const tb = window.performance.now();
                const o = {
                    description: effect[0], 
                    imgs: outputImgs,
                    msElapsed: tb - ta,
                };
                outputs[i] = o;
                i++;
                setOutputImages([...outputs]);
            }
        }
        effect();
    }, []);

    return (
        <div className="container-fluid">
            <div className="row">
                {outputImages.map((o,i) => o && 
                    <div key={i} className="col-sm-6 col-md-4 col-lg-3 col-xl-2 mb-4">
                        <div className="card">
                            {o.imgs.map((img,i) => 
                                <div key={i}>
                                    {o.imgs.length > 1 && <span>#{i+1}</span>}
                                    <OffscreenCanvasImage 
                                        oc={img} 
                                        className="card-img-top"
                                        style={{
                                            background:'white'
                                        }}
                                    />
                                </div>
                            )}
                            <div className="card-body">
                                <h6 className="card-title">{o.description}</h6>
                                <div className="card-text">
                                    {o.msElapsed.toFixed(0)}ms<br/>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};