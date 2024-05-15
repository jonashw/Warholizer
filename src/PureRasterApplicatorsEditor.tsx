import React from 'react';
import { applicatorAsRecord, PureRasterApplicatorRecord } from './Warholizer/RasterOperations/PureRasterApplicator';
import { PureRasterApplicatorListItemEditor } from './PureRasterApplicatorListItemEditor';
import { useUndo } from './undo/useUndo';
import { UndoRedoToolbar } from './undo/UndoRedoToolbar';
import { defaultApplicator } from './defaultApplicator';
import { DragDropContext } from 'react-beautiful-dnd';


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
                const updatedOps = reorder(sourceApp.ops, source.index, destination.index);
                setApplicators(applicators.map(a => 
                    a === sourceApp 
                    ? { ...sourceApp, ops: updatedOps }
                    : a));
            } else {
                const [updatedSourceOps,updatedDestinationOps] = move(
                    sourceApp     .ops,      source.index,
                    destinationApp.ops, destination.index);
                console.log({updatedSourceOps,updatedDestinationOps});
                setApplicators(applicators.map(a => 
                    a === sourceApp 
                    ? { ...sourceApp, ops: updatedSourceOps }
                    : a === destinationApp 
                    ? { ...destinationApp, ops: updatedDestinationOps }
                    : a));
            }
            function move<T>(fromArray: T[], fromIndex: number, toArray:T[], toIndex: number): [T[],T[]] {
                const fromArrayUpdated = [...fromArray];
                const [removed] = fromArrayUpdated.splice(fromIndex, 1);
                const toArrayUpdated = [...toArray];
                toArrayUpdated.splice(toIndex, 0, removed);
                return [fromArrayUpdated,toArrayUpdated];
            }
            function reorder<T>(array: T[], fromIndex: number, toIndex: number): T[] {
                const result = [...array];
                const [removed] = result.splice(fromIndex, 1);
                result.splice(toIndex, 0, removed);
                return result;
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
