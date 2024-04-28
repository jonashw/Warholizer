import React from 'react';
import { PureRasterApplicator, PureRasterApplicators } from './Warholizer/RasterOperations/PureRasterApplicator';
import { PureRasterOperationInlineEditor } from './Warholizer/RasterOperations/PureRasterOperationInlineEditor';
import { PureRasterOperation } from './Warholizer/RasterOperations/PureRasterOperation';
import { angle, byte } from './Warholizer/RasterOperations/NumberTypes';

export const sampleOperations: PureRasterOperation[] = [
    {"type":"invert"},
    {"type":"stack",dimension:'x'},
    {"type":"threshold", value: byte(128)},
    {"type":"rotateHue",degrees: angle(180)},
    {"type":"multiply",n: 2},
    {"type":"wrap",amount:50,dimension:'x'},
    {"type":"grayscale",percent:100},
    {"type":"blur",pixels:5}
];

export const PureRasterApplicatorCardEditor = ({
    id, value, onChange, onRemove
}: {
    id: string,
    value: PureRasterApplicator;
    onChange: (a: PureRasterApplicator) => void;
    onRemove?: () => void;
}) => {
    const selectRef = React.createRef<HTMLSelectElement>();
    return <div className="card">
        <div className="card-header d-flex justify-content-between">
            Operations
            <div>
                {PureRasterApplicators.types.map(t => <label key={t} className="ms-3">
                    <input
                        type="radio"
                        name={"applicatorType-" + id}
                        value={t}
                        checked={value.type === t}
                        onChange={e => {
                            if (e.target.value === t) {
                                onChange({ ...value, type: t });
                            }
                        }} />
                    {' '}{t}
                </label>
                )}
            </div>
            {onRemove && (
                <button
                    className="btn btn-sm btn-danger"
                    title="Remove this applicator"
                    onClick={onRemove}
                >&times;</button>)}
        </div>

        <div className="list-group list-group-flush">
            {value.ops.map((op, i) => <div className="list-group-item" key={`${i}-${op.type}`}>
                <div className="d-flex justify-content-between">
                    <PureRasterOperationInlineEditor id={i.toString()} value={op} onChange={newOp => {
                        onChange({
                            ...value,
                            ops: value.ops.map(o => o == op ? newOp : o)
                        });
                    }} />
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
        </div>

        <div className="card-footer">
            <div className="d-flex justify-content-between">
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
        </div>
    </div>;
};