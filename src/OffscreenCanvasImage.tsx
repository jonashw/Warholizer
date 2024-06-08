import React from 'react';
import ImageUtil, { ImagePayload } from './Warholizer/ImageUtil';
import { Modal } from './Modal';
import { ImageRecord } from './ImageRecord';

const cache: Record<string,ImagePayload> = {};

export const OffscreenCanvasImage = ({
    onSize,
    oc, className, style,
    onClick
}: {
    onSize?: (w: number, h: number) => void,
    oc: OffscreenCanvas | ImageRecord;
    className?: string;
    style?: React.CSSProperties;
    onClick?: () => void
}) => {
    const [payload, setPayload] = React.useState<ImagePayload>();
    const [modalVisible, setModalVisible] = React.useState(false);
    const [loaded,setLoaded] = React.useState(false);
    React.useEffect(() => {
        if('id' in oc){
            if(oc.id in cache){
                setPayload(cache[oc.id]);
            } else {
                ImageUtil.offscreenCanvasToPayload(oc.osc).then(payload => {
                    setPayload(payload);
                    cache[oc.id] = payload;
                });
            }
        } else {
            ImageUtil.offscreenCanvasToPayload(oc).then(setPayload);
        }
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
