import React from 'react';
import ImageUtil, { ImagePayload } from './Warholizer/ImageUtil';
import { Modal } from './Modal';

export const OffscreenCanvasImage = ({
    onSize,
    oc, className, style,
    onClick
}: {
    onSize?: (w: number, h: number) => void,
    oc: OffscreenCanvas;
    className?: string;
    style?: React.CSSProperties;
    onClick?: () => void
}) => {
    const [payload, setPayload] = React.useState<ImagePayload>();
    const [modalVisible, setModalVisible] = React.useState(false);
    const [loaded,setLoaded] = React.useState(false);
    React.useEffect(() => {
        ImageUtil.offscreenCanvasToPayload(oc).then(setPayload);
    }, [oc]);
    return <>
        <img
            alt="img"
            onClick={() => {
                if(onClick){
                    onClick();
                } else {
                    setModalVisible(true);
                }
            }}
            onLoad={e => {
                setLoaded(true);
                if(onSize){
                    onSize(
                        e.currentTarget.clientWidth,
                        e.currentTarget.clientHeight);
                }
            }}
            src={payload?.dataUrl}
            className={className}
            style={{
                ...{cursor: 'pointer'},
                ...(style ?? {})
                ,display: loaded ? 'inherit' : 'none'
            }} />
        {modalVisible && (
            <Modal
                title="Image Preview" 
                flush
                onClose={() => setModalVisible(false)}
                body={<>
                    {payload && <div className="d-flex justify-content-center">
                        <img
                            onLoad={() => setLoaded(true)}
                            alt="img"
                            src={payload?.dataUrl}
                            style={{
                                maxWidth:'100%',
                                display: loaded ? 'inherit' : 'none'
                            }} 
                        />
                    </div>}
                </>}
            />
        )}
    </>;
};
