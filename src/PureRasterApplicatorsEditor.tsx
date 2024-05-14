import React from 'react';
import { applicatorAsRecord, PureRasterApplicatorRecord } from './Warholizer/RasterOperations/PureRasterApplicator';
import { PureRasterApplicatorListItemEditor } from './PureRasterApplicatorListItemEditor';
import { useUndo } from './undo/useUndo';
import { UndoRedoToolbar } from './undo/UndoRedoToolbar';
import { defaultApplicator } from './PureEditor';


export function PureRasterApplicatorsEditor({
    defaultApplicators, onChange
}: {
    defaultApplicators: PureRasterApplicatorRecord[];
    onChange: (value: PureRasterApplicatorRecord[]) => void;
}) {
    const [applicators, setApplicators, applicatorUndoController] = useUndo(defaultApplicators);

    React.useEffect(() => {
        onChange(applicators);
    }, [applicators, onChange]);

    return <div className="card">
        <div className="card-header d-flex justify-content-between align-items-center">
            Operations
            <UndoRedoToolbar controller={applicatorUndoController} />
        </div>
        <div className="list-group list-group-flush">
            {applicators.map((applicator) => <PureRasterApplicatorListItemEditor
                key={applicator.id}
                value={applicator}
                onChange={updatedApplicator => {
                    setApplicators(applicators.map(a => a === applicator ? updatedApplicator : a));
                }}
                onRemove={() => {
                    setApplicators(applicators.filter(a => a !== applicator));
                }} />
            )}
        </div>
        <div className="card-footer">
            <button className="btn btn-primary btn-sm w-100" onClick={() => {
                setApplicators([...applicators, { ...applicatorAsRecord(defaultApplicator) }]);
            }}>Add Applicator</button>
        </div>
    </div>;
}
