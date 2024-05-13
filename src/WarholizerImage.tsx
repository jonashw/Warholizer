import React from "react";
import ImageUtil from "./Warholizer/ImageUtil";
import { PureRasterOperation, PureRasterOperations } from "./Warholizer/RasterOperations/PureRasterOperation";
import { OffscreenCanvasImage } from "./OffscreenCanvasImage";

export function WarholizerImage({
    src,
    operations,
    combinator
}:{
    src: string,
    operations: PureRasterOperation[],
    combinator?: "pipe" | "flatMap" | "zip"
}){
    const [finalImages,setFinalImages] = React.useState<OffscreenCanvas[]>([]);
    React.useEffect(() => {
        const effect = async () => {
            const osc = await ImageUtil.loadOffscreen(src);
            const apply = 
                combinator === "pipe" 
                ? PureRasterOperations.applyPipeline
                : PureRasterOperations.applyFlatMap;
            setFinalImages(await apply(operations, [osc]));
        };
        effect();
    },[src,operations, combinator])
    return <>{finalImages.map(img => <OffscreenCanvasImage oc={img} />)}</>
}