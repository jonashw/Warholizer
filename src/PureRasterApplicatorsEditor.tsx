import React from 'react';
import { applicatorAsRecord, IterativeApplication, PureRasterApplicatorRecord, PureRasterApplicators } from './Warholizer/RasterOperations/PureRasterApplicator';
import { PureRasterApplicatorListItemEditor } from './PureRasterApplicatorListItemEditor';
import { useUndo } from './undo/useUndo';
import { UndoRedoToolbar } from './undo/UndoRedoToolbar';
import { defaultApplicator } from './defaultApplicator';
import { DragDropContext } from '@hello-pangea/dnd';
import { DragDropHelper } from './DragDropHelper';
import { imageAsRecord, ImageRecord } from './ImageRecord';
import { Recipe, recipes } from './Warholizer/RasterOperations/recipes';

export function PureRasterApplicatorsEditor({
    defaultApplicators, onChange, previewImages
}: {
    defaultApplicators: PureRasterApplicatorRecord[];
    onChange: (value: PureRasterApplicatorRecord[]) => void;
    previewImages: ImageRecord[];
}) {
    const [applicators, setApplicators, applicatorUndoController] = useUndo(defaultApplicators);
    const [previewIterations,setPreviewIterations] = React.useState<IterativeApplication[]>([]);
    const [appliedRecipe, setAppliedRecipe] = React.useState<Recipe>();

    /** Replaces the arrangement with an editable copy of the recipe (undoable). */
    const applyRecipe = (recipe: Recipe) => {
        setApplicators(recipe.applicators.map(applicatorAsRecord));
        setAppliedRecipe(recipe);
    };

    React.useEffect(() => {
        PureRasterApplicators
        .applyAllIteratively(applicators, previewImages.map(i => i.osc))
        .then(setPreviewIterations);
    },[previewImages, applicators]);

    React.useEffect(() => {
        onChange(applicators);
    }, [applicators, onChange]);

    return <div className="card">
        <div className="card-header d-flex justify-content-between align-items-center gap-2">
            Operations
            <select
                className="form-select form-select-sm w-auto ms-auto"
                value=""
                title="Replace the operations with a recipe (undoable)"
                onChange={e => {
                    const recipe = recipes.find(r => r.id === e.target.value);
                    if (recipe) {
                        applyRecipe(recipe);
                    }
                }}
            >
                <option value="">Apply recipe…</option>
                {recipes.map(r => <option key={r.id} value={r.id} title={r.description}>{r.name}</option>)}
            </select>
            <UndoRedoToolbar controller={applicatorUndoController} />
        </div>
        {appliedRecipe && (
            <div className="card-header small py-1 d-flex justify-content-between align-items-center bg-light">
                <span>
                    Applied <strong>{appliedRecipe.name}</strong>. {appliedRecipe.description}
                    {appliedRecipe.hint && <span className="text-muted"> {appliedRecipe.hint}</span>}
                    {' '}Everything below is editable; Undo restores the previous operations.
                </span>
                <button className="btn-close btn-sm ms-2" aria-label="Dismiss" onClick={() => setAppliedRecipe(undefined)} />
            </div>
        )}
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
                {previewIterations.map((it) => {
                    const applicator = it.applied[it.applied.length - 1];
                    return (
                        <PureRasterApplicatorListItemEditor
                            previewImages={it.inputs.map(imageAsRecord)}
                            key={applicator.id}
                            value={applicator}
                            onChange={updatedApplicator => {
                                setApplicators(applicators.map(a => a === applicator ? updatedApplicator : a));
                            }}
                            onRemove={() => {
                                setApplicators(applicators.filter(a => a !== applicator));
                            }}
                        />
                    );
                })}
            </div>
        </DragDropContext>
        <div className="card-footer">
            <button className="btn btn-primary btn-sm w-100" onClick={() => {
                setApplicators([...applicators, { ...applicatorAsRecord(defaultApplicator) }]);
            }}>Add Applicator</button>
        </div>
    </div>;
}