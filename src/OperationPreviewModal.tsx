import React from 'react';
import { PureRasterApplicatorRecord, PureRasterOperationRecord, operationAsRecord } from './Warholizer/RasterOperations/PureRasterApplicator';
import { ImageRecord } from './ImageRecord';
import { Modal } from './Modal';
import { WarholizerImage } from './WarholizerImage';
import { sampleOperations } from './sampleOperations';
import { OperationIcon } from './Warholizer/RasterOperations/OperationIcon';
import { PureRasterOperations } from './Warholizer/RasterOperations/PureRasterOperation';
import { Thumbnail } from './Thumbnail';


export const OperationPreviewModal = ({
    previewImages, onClose, onSelect, previewApplicators
}: {
    previewImages: ImageRecord[];
    previewApplicators: (op: PureRasterOperationRecord) => PureRasterApplicatorRecord[];
    onClose: () => void;
    onSelect: (op: PureRasterOperationRecord) => void
}) => {
    const [selectedImgIds,setSelectedImgIds] = React.useState(new Set(previewImages.map(i => i.id)));
    const toggleImgId = (imgId:string, include:boolean) => {
        const nextImageIds = 
            include
            ? [...selectedImgIds, imgId]
            : Array.from(selectedImgIds).filter(i => i !== imgId);
        setSelectedImgIds(new Set(nextImageIds));
    };
    const candidates = sampleOperations.map(op => ({
        op,
        applicators: previewApplicators(operationAsRecord(op))
    }));
    return (
        <Modal
            onClose={onClose}
            body={(
                <div>
                    {previewImages.length > 1 && (
                        <div className="row">
                            {previewImages.map(img => (
                                <div className="col">
                                    <input
                                        type="checkbox"
                                        checked={selectedImgIds.has(img.id)}
                                        onChange={e => toggleImgId(img.id, e.target.checked)}
                                    />
                                    <Thumbnail
                                        img={img}
                                        side={"90px"} 
                                        onClick={() => toggleImgId(img.id, !selectedImgIds.has(img.id))}
                                    />
                                </div>
                            ))}
                        </div>
                    )}
                    <div className="row">
                        {candidates.map(({op,applicators}) => {
                            return (
                                <div 
                                    className="col-6 col-sm-4 col-xl-3"
                                    title={PureRasterOperations.stringRepresentation(op)}
                                >
                                    <OperationIcon op={op} className="me-2"/>
                                    {op.type}
                                    <WarholizerImage
                                        thumbnail={90}
                                        onClick={() => {
                                            onSelect(operationAsRecord(op));
                                            onClose();
                                        }}
                                        applicators={applicators}
                                        src={previewImages.filter(i => selectedImgIds.has(i.id))}
                                        style={{ maxWidth: '100%' }}
                                    />
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}
            title="Choose an operation" />
    );
};
