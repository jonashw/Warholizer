import React from "react";
import ImageUtil from "./Warholizer/ImageUtil";
import { OffscreenCanvasImage } from "./OffscreenCanvasImage";
import { PureRasterApplicator, PureRasterApplicators } from "./Warholizer/RasterOperations/PureRasterApplicator";
import { ImageRecord, imageAsRecord } from "./ImageRecord";
import { CSSLength, Thumbnail } from "./Thumbnail";
import { PureRasterOperation} from './Warholizer/RasterOperations/PureRasterOperation/';
import * as PureRasterOperations from './Warholizer/RasterOperations/PureRasterOperation/';

export type WarholizerImageRef = {getHeight: () => number};

export const WarholizerImage = React.forwardRef(function (
    {
        thumbnail,
        onSize,
        src,
        transform,
        className,
        style,
        onClick
    }: {
        thumbnail?: CSSLength,
        onSize?: (w: number, h: number) => void,
        src: (string | ImageRecord | OffscreenCanvas | HTMLVideoElement)[],
        transform: PureRasterApplicator[] | PureRasterOperation,
        className?: string;
        style?: React.CSSProperties;
        onClick?: () => void
    },
    ref
){
    const [finalImages,setFinalImages] = React.useState<OffscreenCanvas[]>([]);

    React.useEffect(() => {
        const effect = async () => {
            const oscs = await Promise.all(src.map(s => s instanceof OffscreenCanvas  
                ? s
                : typeof s === "string" || !('osc' in s)
                ? ImageUtil.loadOffscreen(s)
                : s.osc));
            setFinalImages(
                await ('type' in transform
                ? PureRasterOperations.apply(transform, oscs)
                : PureRasterApplicators.applyAll(transform, oscs)));
        };
        effect();
    },[src, transform])

    React.useImperativeHandle(
        ref,
        () => {
            console.log('init imperativeHandle')
            return {
                getHeight: () => {
                    const max = Math.max(...finalImages.map(i => i.height));
                    console.log({max,finalImages})
                    return max;
                }
            } as WarholizerImageRef;
        },
        [finalImages]);

    if(finalImages.length === 0 && thumbnail){
        return (
            <Thumbnail 
                img={undefined}
                side={thumbnail}
                onClick={onClick} 
            />
        );
    }

    return <>{finalImages.map((img,i) => 
        thumbnail 
        ? <Thumbnail
            key={i}
            img={imageAsRecord(img)}
            side={thumbnail} 
                {...{onSize, onClick, className, style}}
             />
        : <OffscreenCanvasImage
            key={i}
            {...{onSize, onClick, className, style}}
            oc={img} 
        />)}</>
})