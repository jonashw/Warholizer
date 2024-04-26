import React from 'react';
import ImageUtil, { ImagePayload } from './Warholizer/ImageUtil';
import { Dimension, PureRasterOperation } from './Warholizer/RasterOperations/PureRasterOperation';
import { applyPureOperation } from './Warholizer/RasterOperations/apply';

//type ImageOutput = {description: string, imgs: OffscreenCanvas[], msElapsed: number};
type ViewableImageOutput = {description: string, imgs: ImagePayload[], msElapsed: number};
type Effect = [string, (img:OffscreenCanvas) => Promise<OffscreenCanvas[]>, Effect[]?];

const pureExample = (name: string, op: PureRasterOperation): Effect => 
    [
        name,
        async img => applyPureOperation(op,[img])
    ];

//tilingPatterns.map(tp => tp.)

export default () => {
    const effects: Effect[] = [
        pureExample(`invert`, {type:'invert'}),
        ...(
            (['x','y'] as Dimension[]).flatMap(dimension => 
            [0.2,0.5,0.8].map(amount => 
                pureExample(`Wrap ${dimension} ${amount*100}%`, {type:'wrap',dimension,amount}),
            ))
        ),
        ...(
            (['x','y'] as Dimension[]).flatMap(dimension => 
            [0.2,0.5,0.8].map(amount => 
                pureExample(`Scale ${dimension} ${amount*100}%`, {
                    type:'scale',
                    x: dimension == 'x' ? amount : 1,
                    y: dimension == 'y' ? amount : 1
                }),
            ))
        ),
    ];

    const [outputImages,setOutputImages] = React.useState<(ViewableImageOutput|undefined)[]>(effects.map(_ => undefined));

    React.useEffect(() => {
        const effect = async () => {
            var t0 = window.performance.now();
            const inputZero = await ImageUtil.loadOffscreen("/warhol.jpg");
            var t1 = window.performance.now();
            let input = inputZero;
            let outputs: (ViewableImageOutput|undefined)[] = [
                {
                    description: "Original",
                    imgs: [await ImageUtil.offscreenCanvasToPayload(input)],
                    msElapsed: t1 - t0,
                },
                ...effects.map(_ => undefined) //placeholders for unfinished effects
            ];

            let i = 1;
            for(let e of effects){
                const ta = window.performance.now();
                const outputImgs = await e[1](input);
                const tb = window.performance.now();
                const o = {
                    description: e[0], 
                    imgs: await Promise.all(outputImgs.map(o => ImageUtil.offscreenCanvasToPayload(o))),
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
                                <img
                                    key={i}
                                    src={img.dataUrl}
                                    className="card-img-top"
                                    style={{
                                        background:'white'
                                    }}
                                />
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