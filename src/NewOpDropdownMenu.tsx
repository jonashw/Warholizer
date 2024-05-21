import React from 'react';
import { sampleOperations } from './sampleOperations';
import { PureRasterOperation } from './Warholizer/RasterOperations/PureRasterOperation';


export function NewOpDropdownMenu({
    placeholder,
    onSelect
}: {
    placeholder?: string,
    onSelect: (op: PureRasterOperation) => void;
}) {
    const selectRef = React.createRef<HTMLSelectElement>();
    return (
        <select
            className="form-select form-select-sm"
            ref={selectRef}
            value={undefined}
            onChange={e => {
                const op = sampleOperations.filter(op => op.type === e.target.value)[0];
                if (!op) {
                    return;
                }
                //console.log({ op });
                onSelect(op);
                if (selectRef.current) {
                    selectRef.current.value = "";
                }
            }}
        >
            <option value={""}>{placeholder ?? 'Add an operation'}</option>
            {sampleOperations.map(op => <option key={op.type} value={op.type}>{op.type}</option>
            )}
        </select>
    );
}
