import React from 'react';
import { applicatorAsRecord, PureRasterApplicatorRecord } from './Warholizer/RasterOperations/PureRasterApplicator';
import { PureRasterApplicatorListItemEditor } from './PureRasterApplicatorListItemEditor';
import { useUndo } from './undo/useUndo';
import { UndoRedoToolbar } from './undo/UndoRedoToolbar';
import { defaultApplicator } from './defaultApplicator';
import { DragDropContext } from 'react-beautiful-dnd';
import { DragDropHelper } from './DragDropHelper';

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
        <DragDropContext onDragEnd={result => {
            if (!result.destination) {
                return;
            }
            const destination = result.destination!;
            const source = result.source;
            const sourceApp = applicators.find(a => a.id === source.droppableId);
            const destinationApp = applicators.find(a => a.id === destination.droppableId);
            if(!sourceApp || !destinationApp){
                return;
            }
            if(sourceApp === destinationApp){
                if(destination.index === source.index){
                    return;
                }
                const updatedOps = DragDropHelper.reorder(sourceApp.ops, source.index, destination.index);
                setApplicators(applicators.map(a => 
                    a === sourceApp 
                    ? { ...sourceApp, ops: updatedOps }
                    : a));
            } else {
                const [updatedSourceOps,updatedDestinationOps] = 
                    DragDropHelper.move(sourceApp     .ops,      source.index,
                                        destinationApp.ops, destination.index);
                console.log({updatedSourceOps,updatedDestinationOps});
                setApplicators(applicators.map(a => 
                    a === sourceApp 
                    ? { ...sourceApp, ops: updatedSourceOps }
                    : a === destinationApp 
                    ? { ...destinationApp, ops: updatedDestinationOps }
                    : a));
            }
        }}>
            <div className="list-group list-group-flush">
                {applicators.map((applicator) => (
                    <PureRasterApplicatorListItemEditor
                        key={applicator.id}
                        value={applicator}
                        onChange={updatedApplicator => {
                            setApplicators(applicators.map(a => a === applicator ? updatedApplicator : a));
                        }}
                        onRemove={() => {
                            setApplicators(applicators.filter(a => a !== applicator));
                        }}
                    />
                ))}
            </div>
        </DragDropContext>
        <div className="card-footer">
            <button className="btn btn-primary btn-sm w-100" onClick={() => {
                setApplicators([...applicators, { ...applicatorAsRecord(defaultApplicator) }]);
            }}>Add Applicator</button>
        </div>
    </div>;
}
