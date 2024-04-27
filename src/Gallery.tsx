import React from 'react';
import ImageUtil,{ImagePayload, WarholizerImage} from './Warholizer/ImageUtil';
import ValueRange from "./Warholizer/ValueRange";
import { tilingPatterns } from './Warholizer/TilingPattern';
import { Dimension, PureRasterOperation } from './Warholizer/RasterOperations/PureRasterOperation';
import { Percentage } from './Warholizer/RasterOperations/NumberTypes';

type ImageOutput = {description: string, img: ImagePayload, histogram: ImagePayload, msElapsed: number};
type Effect = [string, (img:ImagePayload) => Promise<ImagePayload>, Effect[]?];

const pureExample = (name: string, op: PureRasterOperation): Effect => 
    [
        name,
        async img => {
            const imgs = await ImageUtil.applyPure(img,op);
            return imgs[0];
        }
    ];

//tilingPatterns.map(tp => tp.)

export default () => {
    const tilingPatternEffects = tilingPatterns.map(tp => [
            `Tiling Pattern (${tp.label})`,
            img => ImageUtil.tilingPattern(img,tp)
        ] as Effect);
    const effects: Effect[] = [
        pureExample(`invert`, {type:'invert'}),
        ...(
            (['x','y'] as Dimension[]).flatMap(dimension => 
            ([20,50,80] as Percentage[]).map(amount => 
                pureExample(`Wrap ${dimension} ${amount}%`, {type:'wrap',dimension,amount}),
            ))
        ),
        ...(
            (['x','y'] as Dimension[]).flatMap(dimension => 
            [0.2,0.5,0.8].map(amount => 
                pureExample(`Wrap ${dimension} ${amount*100}%`, {
                    type:'scale',
                    x: dimension == 'x' ? amount : 1,
                    y: dimension == 'y' ? amount : 1
                }),
            ))
        ),
        ...tilingPatternEffects,
        [
            "Noise (rgb)",
            img => ImageUtil.noise(img.width,img.height,"rgb")
        ],
        [
            "Grain (rgb)",
            img => ImageUtil.addGrain(img, "rgb")
        ],
        [
            "Noise (bw)",
            img => ImageUtil.noise(img.width,img.height,"bw")
        ],
        [
            "Grain (bw)",
            img => ImageUtil.addGrain(img, "bw")
        ],
        [
            "Noise (grayscale)",
            img => ImageUtil.noise(img.width,img.height,"grayscale")
        ],
        [
            "Grain (grayscale)",
            img => ImageUtil.addGrain(img, "grayscale")
        ],
        [
            'Cropped',
            (img:ImagePayload) =>
                ImageUtil.crop(img, {
                    crop: {
                        height:300,
                        width:300,
                        unit:'px',
                        x:0,
                        y:0
                    },
                    adjustRatio: {x:1,y:1}
                })
        ],
        [
            'Threshold',
            (img:ImagePayload) => ImageUtil.threshold(img,123)
        ],
        [
            'Grain + Threshold',
            (img:ImagePayload) => 
                new WarholizerImage(img)
                .addGrain("grayscale").then(img => img
                .threshold(123)).then(i => i.payload)
        ],
        [
            'Value Ranges',
            async (img:ImagePayload) => {
                const vrs = ValueRange.split(ValueRange.initial(), [90,170] );
                const result = await ImageUtil.applyImageValueRanges(vrs,img);
                return result.modified;
            }
        ],
        [
            'Quantized',
            async (img:ImagePayload) => {
                const result = await ImageUtil.quantize(img,3,[undefined]);
                return result.quantized;
            }
        ],
        [
            "Invert",
            img => ImageUtil.invert(img)
        ],
    ];

    const [outputImages,setOutputImages] = React.useState<(ImageOutput|undefined)[]>(effects.map(_ => undefined));

    React.useEffect(() => {
        const effect = async () => {
            var t0 = window.performance.now();
            const inputZero = await ImageUtil.load("/warhol.jpg");
            var t1 = window.performance.now();
            let input = inputZero;
            let outputs: (ImageOutput|undefined)[] = [
                {
                    description: "Original",
                    img: input,
                    msElapsed: t1 - t0,
                    histogram: await ImageUtil.getValueHistogram(input)
                },
                ...effects.map(_ => undefined)
            ];

            let i = 1;
            //for(let e of tilingPatternEffects){
            for(let e of effects){
                const ta = window.performance.now();
                const output = await e[1](input);
                const tb = window.performance.now();
                outputs[i] = {
                    description: e[0], 
                    img:output,
                    msElapsed: tb - ta,
                    histogram: await ImageUtil.getValueHistogram(output)
                };
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
                            <img
                                src={o.img.dataUrl}
                                className="card-img-top"
                                style={{
                                    background:'white'
                                }}
                            />
                            <div className="card-body">
                                <h6 className="card-title">{o.description}</h6>
                                <div className="card-text">
                                    {o.msElapsed.toFixed(0)}ms<br/>
                                </div>
                            </div>
                            <img
                                src={o.histogram.dataUrl}
                                className="card-img-bottom"
                                style={{
                                    borderTop:'1px solid #ddd'
                                }}
                            />
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};