import React from "react";
import ImageUtil from "./Warholizer/ImageUtil";
import { OffscreenCanvasImage } from "./OffscreenCanvasImage";
import { PureRasterApplicator, PureRasterApplicators } from "./Warholizer/RasterOperations/PureRasterApplicator";

export function WarholizerImage({
    src,
    applicators,
    className,
    style
}:{
    src: string | OffscreenCanvas | HTMLVideoElement,
    applicators: PureRasterApplicator[],
    className?: string;
    style?: React.CSSProperties;
}){
    const [finalImages,setFinalImages] = React.useState<OffscreenCanvas[]>([]);

    React.useEffect(() => {
        const effect = async () => {
            const osc = src instanceof OffscreenCanvas  
                ? src 
                : await ImageUtil.loadOffscreen(src) ;
            setFinalImages(await PureRasterApplicators.applyAll(applicators, [osc]));
        };
        effect();
    },[src, applicators])

    return <>{finalImages.map((img,i) => <OffscreenCanvasImage key={i} {...{className,style}} oc={img} />)}</>
}