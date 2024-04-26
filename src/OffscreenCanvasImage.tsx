import React from 'react';
import ImageUtil, { ImagePayload } from './Warholizer/ImageUtil';

export const OffscreenCanvasImage = ({
    oc, className, style
}: {
    oc: OffscreenCanvas;
    className?: string;
    style?: React.CSSProperties;
}) => {
    const [payload, setPayload] = React.useState<ImagePayload>();
    React.useEffect(() => {
        ImageUtil.offscreenCanvasToPayload(oc).then(setPayload);
    }, []);
    return <img
        src={payload?.dataUrl}
        className={className}
        style={style} />;
};
