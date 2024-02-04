import React from 'react';
import ImageUtil,{ImagePayload} from './Warholizer/ImageUtil';
import ValueRange from "./Warholizer/ValueRange";
export default () => {
    const [img,setImg] = React.useState<ImagePayload|undefined>();
    const [img2,setImg2] = React.useState<ImagePayload|undefined>();
    const effects = [
        (_:ImagePayload) => ImageUtil.load('/warhol.jpg'),
        async (img:ImagePayload) => {
            const vrs = ValueRange.split(ValueRange.initial(), [90,170] );
            const result = await ImageUtil.applyImageValueRanges(vrs,img);
            return result.modified;
        }
    ];

    const [outputImages,setOutputImages] = React.useState<(ImagePayload|undefined)[]>(effects.map(_ => undefined));

    React.useEffect(() => {
        const effect = async () => {
            const inputZero: ImagePayload = {dataUrl: '', width:0, height: 0};
            let input = inputZero;
            let outputs: (ImagePayload|undefined)[] = effects.map(_ => undefined);
            let i = 0;
            for(let e of effects){
                const output = await e(input);
                outputs[i] = output;
                i++;
                setOutputImages([...outputs]);
                input = output;
            }
        }
        effect();
    }, []);


    return (
        <div className="App">
            <div className="centralizer" style={{color:'white'}}>
                {outputImages.map(img => img && <img src={img.dataUrl}/>)}
            </div>
        </div>
    );
};