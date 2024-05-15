import React from 'react';
import ImageUtil, { ImagePayload } from './Warholizer/ImageUtil';

export const OffscreenCanvasImage = ({
    oc, className, style,
    onClick
}: {
    oc: OffscreenCanvas;
    className?: string;
    style?: React.CSSProperties;
    onClick?: () => void
}) => {
    const [payload, setPayload] = React.useState<ImagePayload>();
    React.useEffect(() => {
        ImageUtil.offscreenCanvasToPayload(oc).then(setPayload);
    }, [oc]);
    return <img
        onClick={onClick}
        alt="img"
        src={payload?.dataUrl}
        className={className}
        style={style} />;
};
