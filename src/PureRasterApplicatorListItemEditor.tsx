import React from 'react';
import { PureRasterApplicatorRecord, operationAsRecord, PureRasterApplicatorType, PureRasterApplicators } from './Warholizer/RasterOperations/PureRasterApplicator';
import { PureRasterOperationInlineEditor } from './Warholizer/RasterOperations/PureRasterOperationInlineEditor';
import { ButtonRadiosInput } from './Warholizer/RasterOperations/ButtonRadiosInput';
import {  Draggable, Droppable } from 'react-beautiful-dnd';
import { sampleOperations } from './sampleOperations';
import { ImageRecord } from './ImageRecord';
import { OperationPreviewModal } from './OperationPreviewModal';
import { NewOpDropdownMenu } from './NewOpDropdownMenu';

export const PureRasterApplicatorListItemEditor = ({
    value,
    onChange,
    onRemove,
    previewImages,
}: {
    value: PureRasterApplicatorRecord;
    onChange: (a: PureRasterApplicatorRecord) => void;
    onRemove?: () => void;
    previewImages: ImageRecord[];
}) => {
    const [operationPreviewModalVisible,setOperationPreviewModalVisible] = React.useState(false);
    return (
        <>
            {operationPreviewModalVisible && 
                <OperationPreviewModal
                    onSelect={op => {
                        onChange({
                            ...value,
                            ops: [...value.ops, operationAsRecord(op)]
                        });
                    }}
                    onClose={() => setOperationPreviewModalVisible(false)}
                    previewImages={previewImages} 
                    previewApplicators={op => 
                        [{
                            ...value,
                            ops: [...value.ops, operationAsRecord(op)]
                        }]
                    }
                />
            }
            <div className="list-group-item d-flex justify-content-between">
                <ButtonRadiosInput<PureRasterApplicatorType>
                    value={value.type}
                    options={PureRasterApplicators.types.map(value => ({ value, label: value }))}
                    onChange={type => onChange({ ...value, type })}
                />
                <div className="form-check">
                    <input
                        type="checkbox"
                        className="form-check-input"
                        checked={value.enabled}
                        id={`enabled-${value.id}`}
                        onChange={e => {
                            onChange({ ...value, enabled: e.target.checked });
                        }}
                    />
                    <label className="form-check-label" htmlFor={`enabled-${value.id}`}>Enabled</label>
                </div>
                {onRemove && (
                    <button
                        className="btn btn-sm btn-danger"
                        title="Remove this applicator"
                        onClick={onRemove}
                    >&times;</button>)}
            </div>
            <Droppable droppableId={value.id}>
                {provided => (
                    <div ref={provided.innerRef} {...provided.droppableProps}>
                        {value.ops.map((op, i) => (
                            <Draggable draggableId={op.id} index={i} key={op.id}>
                                {provided => (
                                    <div className="list-group-item" key={op.id}
                                        ref={provided.innerRef}
                                        {...provided.draggableProps}
                                        {...provided.dragHandleProps}
                                    >
                                        <div className="d-flex justify-content-between">
                                            <PureRasterOperationInlineEditor
                                                sampleOperators={sampleOperations}
                                                value={op}
                                                onChange={newOp => {
                                                    onChange({
                                                        ...value,
                                                        ops: value.ops.map(o => o == op ? newOp : o)
                                                    });
                                                }}
                                            />
                                            <button className="btn btn-sm btn-outline-danger"
                                                onClick={() => {
                                                    onChange({
                                                        ...value,
                                                        ops: value.ops.filter(o => o !== op)
                                                    });
                                                }}
                                                title="Remove this filter"
                                            >Remove</button>
                                        </div>
                                    </div>
                                )}
                            </Draggable>
                        ))}
                        {provided.placeholder}
                    </div>
                )}
            </Droppable>
            
            <div className="list-group-item d-flex justify-content-between gap-2">
                <NewOpDropdownMenu 
                    onSelect={op => {
                        onChange({
                            ...value,
                            ops: [...value.ops, operationAsRecord(op)]
                        });
                    }}
                />
                
                <button className="btn btn-sm btn-primary"
                onClick={() => setOperationPreviewModalVisible(true)}
                >Explore</button>
            </div>
        </>
    );
};