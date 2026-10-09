import React from 'react';
import { PureRasterApplicatorRecord, PureRasterOperationRecord, operationAsRecord } from './Warholizer/RasterOperations/PureRasterApplicator';
import { ImageRecord } from './ImageRecord';
import { Modal } from './Modal';
import { WarholizerImage } from './WarholizerImage';
import { OperationIcon } from './Warholizer/RasterOperations/PureRasterOperation/OperationIcon';
import * as PureRasterOperations from "./Warholizer/RasterOperations/PureRasterOperation/";
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
    const groups = PureRasterOperations.defaultOperationsByKind.map(group => ({
        ...group,
        candidates: group.operations.map(op => ({
            op,
            applicators: previewApplicators(operationAsRecord(op))
        }))
    }));
    return (
        <Modal
            onClose={onClose}
            body={(
                <div>
                    {previewImages.length > 1 && (
                        <div className="row">
                            {previewImages.map(img => (
                                <div className="col" key={img.id}>
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
                    {groups.map(group => (
                    <React.Fragment key={group.kind}>
                    <h6 className="mt-3 mb-1" title={group.description}>{group.label}</h6>
                    <div className="row">
                        {group.candidates.map(({op,applicators}) => {
                            return (
                                <div 
                                    key={op.type}
                                    className="col-6 col-sm-4 col-xl-3"
                                    title={`${PureRasterOperations.operationRegistry[op.type].description}\n${PureRasterOperations.stringRepresentation(op)}`}
                                >
                                    <OperationIcon op={op} className="me-2"/>
                                    {PureRasterOperations.operationRegistry[op.type].label}
                                    <WarholizerImage
                                        thumbnail={90}
                                        onClick={() => {
                                            onSelect(operationAsRecord(op));
                                            onClose();
                                        }}
                                        transform={applicators}
                                        src={previewImages.filter(i => selectedImgIds.has(i.id))}
                                        style={{ maxWidth: '100%' }}
                                    />
                                </div>
                            );
                        })}
                    </div>
                    </React.Fragment>
                    ))}
                </div>
            )}
            title="Choose an operation" />
    );
};
