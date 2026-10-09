import React from 'react';
import { applicatorAsRecord, Arrangement, IterativeApplication, PureRasterApplicatorRecord, PureRasterApplicators } from './Warholizer/RasterOperations/PureRasterApplicator';
import { PureRasterApplicatorListItemEditor } from './PureRasterApplicatorListItemEditor';
import { useUndo } from './undo/useUndo';
import { UndoRedoToolbar } from './undo/UndoRedoToolbar';
import { defaultApplicator } from './defaultApplicator';
import { DragDropContext } from '@hello-pangea/dnd';
import { DragDropHelper } from './DragDropHelper';
import { imageAsRecord, ImageRecord } from './ImageRecord';
import { Recipe, RecipeSettings, defaultRecipeSettings, recipeApplicators, recipes } from './Warholizer/RasterOperations/recipes';

export function PureRasterApplicatorsEditor({
    defaultArrangement, onChange, previewImages
}: {
    defaultArrangement: Arrangement;
    onChange: (value: Arrangement) => void;
    previewImages: ImageRecord[];
}) {
    // The arrangement (applicators + per-input mode) is the unit of undo.
    const [arrangement, setArrangement, applicatorUndoController] = useUndo(defaultArrangement);
    const applicators = arrangement.applicators;
    const setApplicators = (applicators: PureRasterApplicatorRecord[]) => setArrangement({ ...arrangement, applicators });
    const [previewIterations,setPreviewIterations] = React.useState<IterativeApplication[]>([]);
    const [appliedRecipe, setAppliedRecipe] = React.useState<{ recipe: Recipe, settings: RecipeSettings }>();

    /** Replaces the arrangement with an editable copy of the recipe built from `settings` (undoable). */
    const applyRecipe = (recipe: Recipe, settings: RecipeSettings) => {
        setArrangement({
            applicators: recipeApplicators(recipe, settings).map(applicatorAsRecord),
            perInput: recipe.perInput ?? arrangement.perInput,
        });
        setAppliedRecipe({ recipe, settings });
    };

    React.useEffect(() => {
        let cancelled = false;
        PureRasterApplicators
        .applyArrangementIteratively(arrangement, previewImages.map(i => i.osc))
        .then(iterations => {
            if (!cancelled) {
                setPreviewIterations(iterations);
            }
        });
        return () => { cancelled = true; };
    },[previewImages, arrangement]);

    React.useEffect(() => {
        onChange(arrangement);
    }, [arrangement, onChange]);

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
                        applyRecipe(recipe, defaultRecipeSettings(recipe));
                    }
                }}
            >
                <option value="">Apply recipe…</option>
                {recipes.map(r => <option key={r.id} value={r.id} title={r.description}>{r.name}</option>)}
            </select>
            <UndoRedoToolbar controller={applicatorUndoController} />
        </div>
        <div className="card-header small py-1">
            <span className="form-check form-switch m-0" title="Run all operations on each input image separately and collect the results, instead of on all inputs together">
                <input className="form-check-input" type="checkbox" role="switch" id="per-input"
                    checked={arrangement.perInput}
                    onChange={e => setArrangement({ ...arrangement, perInput: e.target.checked })} />
                <label className="form-check-label" htmlFor="per-input">Each input separately</label>
            </span>
        </div>
        {appliedRecipe && (
            <div className="card-header small py-2 bg-light">
                <div className="d-flex justify-content-between align-items-start">
                    <span>
                        Applied <strong>{appliedRecipe.recipe.name}</strong>. {appliedRecipe.recipe.description}
                        {appliedRecipe.recipe.hint && <span className="text-muted"> {appliedRecipe.recipe.hint}</span>}
                        {' '}Everything below is editable; Undo restores the previous operations.
                    </span>
                    <button className="btn-close btn-sm ms-2" aria-label="Dismiss" onClick={() => setAppliedRecipe(undefined)} />
                </div>
                {(appliedRecipe.recipe.settings ?? []).length > 0 && (
                    <div className="mt-2">
                        {appliedRecipe.recipe.settings!.map(setting => (
                            <div key={setting.key} className="d-flex align-items-center gap-2" title={setting.description}>
                                <label htmlFor={`recipe-${setting.key}`} className="mb-0" style={{ minWidth: '9em' }}>{setting.label}</label>
                                <input type="range" className="form-range flex-grow-1" id={`recipe-${setting.key}`}
                                    min={setting.min} max={setting.max} step={setting.step}
                                    value={appliedRecipe.settings[setting.key]}
                                    onChange={e => applyRecipe(appliedRecipe.recipe, { ...appliedRecipe.settings, [setting.key]: parseFloat(e.target.value) })} />
                                <span style={{ minWidth: '2.5em', textAlign: 'right' }}>{appliedRecipe.settings[setting.key]}</span>
                            </div>
                        ))}
                        <div className="text-muted">Changing a setting rebuilds the operations from the recipe, replacing manual edits.</div>
                    </div>
                )}
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