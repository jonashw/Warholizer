import React from "react";
import ImageUtil from "./Warholizer/ImageUtil";
import { OffscreenCanvasImage } from "./OffscreenCanvasImage";
import { PureRasterApplicator, PureRasterApplicators } from "./Warholizer/RasterOperations/PureRasterApplicator";
import { ImageRecord } from "./ImageRecord";

export type WarholizerImageRef = {getHeight: () => number};

export const WarholizerImage = React.forwardRef(function (
    {
        onSize,
        src,
        applicators,
        className,
        style
    }: {
        onSize?: (w: number, h: number) => void,
        src: (string | ImageRecord | OffscreenCanvas | HTMLVideoElement)[],
        applicators: PureRasterApplicator[],
        className?: string;
        style?: React.CSSProperties;
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
            setFinalImages(await PureRasterApplicators.applyAll(applicators, oscs));
        };
        effect();
    },[src, applicators])

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

    return <>{finalImages.map((img,i) => <OffscreenCanvasImage key={i} {...{onSize, className,style}} oc={img} />)}</>
})