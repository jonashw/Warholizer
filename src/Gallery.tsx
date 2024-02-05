import React from 'react';
import ImageUtil,{ImagePayload} from './Warholizer/ImageUtil';
import ValueRange from "./Warholizer/ValueRange";

type ImageOutput = {description: string, img: ImagePayload, histogram: ImagePayload, msElapsed: number};
type Effect = [string, (img:ImagePayload) => Promise<ImagePayload>, Effect[]?];

export default () => {
    const effects: Effect[] = [
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
            async (img:ImagePayload) => ImageUtil.threshold(await ImageUtil.addGrain(img,"grayscale"),123)
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
        <div className="App">
            <div className="centralizer" style={{color:'white','flexWrap':'wrap', margin:'-2rem'}}>
                {outputImages.map((o,i) => o && 
                    <div key={i}>
                        <div>{o.description}</div>
                        <div>{o.msElapsed.toFixed(0)}ms</div>
                        <div>
                            <img
                                src={o.img.dataUrl}
                                style={{
                                    margin:'5px',
                                    maxWidth:'200px',
                                    background:'white'
                                }}
                            />
                        </div>
                        <div>
                            <img
                                src={o.histogram.dataUrl}
                                style={{
                                    border:'2px solid white',
                                    margin:'5px',
                                    maxWidth:'200px',
                                    background:'white'
                                }}
                            />
                        </div>
                    </div>)}
            </div>
        </div>
    );
};