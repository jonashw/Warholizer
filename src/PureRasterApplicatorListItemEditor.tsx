import React from 'react';
import { PureRasterApplicator, PureRasterApplicatorType, PureRasterApplicators } from './Warholizer/RasterOperations/PureRasterApplicator';
import { PureRasterOperationInlineEditor } from './Warholizer/RasterOperations/PureRasterOperationInlineEditor';
import { PureRasterOperation } from './Warholizer/RasterOperations/PureRasterOperation';
import { angle, byte, positiveNumber } from './Warholizer/RasterOperations/NumberTypes';
import { ButtonRadiosInput } from './Warholizer/RasterOperations/ButtonRadiosInput';
import { DragDropContext, Draggable, Droppable } from 'react-beautiful-dnd';

export const sampleOperations: PureRasterOperation[] = [
    {"type":"stack", blendingMode:"multiply"},
    {"type":"scale",x:0.5, y:0.5},
    {"type":"crop",width:50,height:50,x:0,y:0,unit:'%'},
    {"type":"scaleToFit",w: positiveNumber(500), h: positiveNumber(500)},
    {"type":"tile",primaryDimension:'x',lineLength:2},
    {"type":"line",direction:'right'},
    {"type":"grid",rows:2,cols:2},
    {"type":"threshold", value: byte(128)},
    {"type":"invert"},
    {"type":"rotateHue",degrees: angle(180)},
    {"type":"rotate",degrees: 90},
    {"type":"multiply",n: 2},
    {"type":"slideWrap",amount:50,dimension:'x'},
    {"type":"grayscale",percent:100},
    {"type":"blur",pixels:5}
];

export const PureRasterApplicatorListItemEditor = ({
    value, onChange, onRemove
}: {
    value: PureRasterApplicator;
    onChange: (a: PureRasterApplicator) => void;
    onRemove?: () => void;
}) => {
    const selectRef = React.createRef<HTMLSelectElement>();
    return (
        <>
            <div className="list-group-item d-flex justify-content-between">
                <ButtonRadiosInput<PureRasterApplicatorType>
                    value={value.type}
                    options={PureRasterApplicators.types.map(value => ({ value, label: value }))}
                    onChange={type => onChange({ ...value, type })}
                />
                {onRemove && (
                    <button
                        className="btn btn-sm btn-danger"
                        title="Remove this applicator"
                        onClick={onRemove}
                    >&times;</button>)}
            </div>
            <DragDropContext onDragEnd={result => {
                function reorder<T>(list:T[], startIndex: number, endIndex:number): T[] {
                    const result = Array.from(list);
                    const [removed] = result.splice(startIndex, 1);
                    result.splice(endIndex, 0, removed);
                    return result;
                }

                if (!result.destination) {
                    return;
                }

                if (result.destination.index === result.source.index) {
                    return;
                }
                const reordered = reorder(
                    value.ops,
                    result.source.index,
                    result.destination.index);
                onChange({...value, ops: reordered});
            }} >
                <Droppable droppableId="list">
                    {provided => (
                        <div ref={provided.innerRef} {...provided.droppableProps}>
                            {value.ops.map((op, i) => (
                                <Draggable draggableId={op.type} index={i} key={op.type}>
                                    {provided => (
                                        <div className="list-group-item" key={`${i}-${op.type}`}
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
            </DragDropContext>
            <div className="list-group-item">
                <select
                    className="form-select form-select-sm"
                    ref={selectRef}
                    value={undefined}
                    onChange={e => {
                        const op = sampleOperations.filter(op => op.type === e.target.value)[0];
                        if (!op) {
                            return;
                        }
                        console.log({ op });
                        onChange({
                            ...value,
                            ops: [...value.ops, { ...op }]
                        });
                        if (selectRef.current) {
                            selectRef.current.value = "";
                        }
                    }}
                >
                    <option value={""}>Add an operation</option>
                    {sampleOperations.map(op => <option key={op.type} value={op.type}>{op.type}</option>
                    )}
                </select>
            </div>
        </>
    );
};