import React from 'react';
import {
    allApplicators, applicatorAsRecord, Arrangement, ArrangementStep, GroupMode, isGroup, PureRasterApplicatorGroupRecord,
    PureRasterApplicatorRecord, PureRasterApplicators, StepIteration, stepAsRecord, updateApplicator
} from './Warholizer/RasterOperations/PureRasterApplicator';
import { PureRasterApplicatorListItemEditor } from './PureRasterApplicatorListItemEditor';
import { useUndo } from './undo/useUndo';
import { UndoRedoToolbar } from './undo/UndoRedoToolbar';
import { defaultApplicator } from './defaultApplicator';
import { DragDropContext } from '@hello-pangea/dnd';
import { DragDropHelper } from './DragDropHelper';
import { imageAsRecord, ImageRecord } from './ImageRecord';
import { Recipe, RecipeSettings, defaultRecipeSettings, recipeSteps, recipes } from './Warholizer/RasterOperations/recipes';
import { ButtonRadiosInput } from './FormComponents/ButtonRadiosInput';

const newGroup = (mode: GroupMode, applicators: PureRasterApplicatorRecord[]): PureRasterApplicatorGroupRecord =>
    ({ type: 'group', id: crypto.randomUUID(), mode, enabled: true, applicators });

export function PureRasterApplicatorsEditor({
    defaultArrangement, onChange, previewImages
}: {
    defaultArrangement: Arrangement;
    onChange: (value: Arrangement) => void;
    previewImages: ImageRecord[];
}) {
    // The whole arrangement (applicators and groups) is the unit of undo.
    const [arrangement, setArrangement, applicatorUndoController] = useUndo(defaultArrangement);
    const steps = arrangement.steps;
    const setSteps = (steps: ArrangementStep[]) => setArrangement({ ...arrangement, steps });
    const [previewIterations,setPreviewIterations] = React.useState<StepIteration[]>([]);
    const [appliedRecipe, setAppliedRecipe] = React.useState<{ recipe: Recipe, settings: RecipeSettings }>();

    /** Replaces the arrangement with an editable copy of the recipe built from `settings` (undoable). */
    const applyRecipe = (recipe: Recipe, settings: RecipeSettings) => {
        setArrangement({ steps: recipeSteps(recipe, settings).map(stepAsRecord) });
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

    // Previews may lag the arrangement while recomputing; look them up by id.
    const stepInputs = (id: string) =>
        (previewIterations.find(it => it.step.id === id)?.inputs ?? []).map(imageAsRecord);
    const childInputs = (groupId: string, applicatorId: string) =>
        (previewIterations.find(it => it.step.id === groupId)?.children?.find(c => c.applicator.id === applicatorId)?.inputs ?? []).map(imageAsRecord);

    const replaceStep = (id: string, next: ArrangementStep | undefined) =>
        setSteps(steps.flatMap(s => s.id !== id ? [s] : next ? [next] : []));

    const applicatorEditor = (applicator: PureRasterApplicatorRecord, previews: ImageRecord[], onRemove: () => void) => (
        <PureRasterApplicatorListItemEditor
            previewImages={previews}
            key={applicator.id}
            value={applicator}
            onChange={updated => setSteps(updateApplicator(steps, applicator.id, () => updated))}
            onRemove={onRemove}
        />
    );

    const groupEditor = (group: PureRasterApplicatorGroupRecord) => (
        <div key={group.id} className="list-group-item p-0 border-start border-4 border-primary">
            <div className="d-flex align-items-center gap-2 px-3 py-2 bg-primary-subtle small">
                <strong>Group</strong>
                <ButtonRadiosInput<GroupMode>
                    value={group.mode}
                    options={[{ value: 'each', label: 'For each image' }, { value: 'all', label: 'All together' }]}
                    onChange={mode => replaceStep(group.id, { ...group, mode })}
                />
                <span className="form-check m-0">
                    <input type="checkbox" className="form-check-input" id={`enabled-${group.id}`} checked={group.enabled}
                        onChange={e => replaceStep(group.id, { ...group, enabled: e.target.checked })} />
                    <label className="form-check-label" htmlFor={`enabled-${group.id}`}>Enabled</label>
                </span>
                <button className="btn btn-sm btn-outline-secondary ms-auto" title="Move the group's applicators out of the group"
                    onClick={() => setSteps(steps.flatMap(s => s.id === group.id ? group.applicators : [s]))}>Ungroup</button>
                <button className="btn btn-sm btn-danger" title="Remove this group and its applicators"
                    onClick={() => replaceStep(group.id, undefined)}>&times;</button>
            </div>
            {group.mode === 'each' && (
                <div className="px-3 pt-1 small text-muted">Runs these applicators on each image separately, then collects the results in image order.</div>
            )}
            <div className="list-group list-group-flush ms-3">
                {group.applicators.map(applicator =>
                    applicatorEditor(applicator, childInputs(group.id, applicator.id), () =>
                        replaceStep(group.id, { ...group, applicators: group.applicators.filter(a => a.id !== applicator.id) })))}
                <div className="list-group-item">
                    <button className="btn btn-sm btn-outline-primary w-100"
                        onClick={() => replaceStep(group.id, { ...group, applicators: [...group.applicators, applicatorAsRecord(defaultApplicator)] })}>
                        Add applicator to group
                    </button>
                </div>
            </div>
        </div>
    );

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
            // Operations can move between any applicators, inside groups or not.
            const applicators = allApplicators(steps);
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
                setSteps(updateApplicator(steps, sourceApp.id, a => ({ ...a, ops: updatedOps })));
            } else {
                const [updatedSourceOps,updatedDestinationOps] =
                    DragDropHelper.move(sourceApp     .ops,      source.index,
                                        destinationApp.ops, destination.index);
                setSteps(updateApplicator(
                    updateApplicator(steps, sourceApp.id, a => ({ ...a, ops: updatedSourceOps })),
                    destinationApp.id, a => ({ ...a, ops: updatedDestinationOps })));
            }
        }}>
            <div className="list-group list-group-flush">
                {steps.map(step => isGroup(step)
                    ? groupEditor(step)
                    : applicatorEditor(step, stepInputs(step.id), () => replaceStep(step.id, undefined)))}
            </div>
        </DragDropContext>
        <div className="card-footer d-flex gap-2">
            <button className="btn btn-primary btn-sm flex-grow-1" onClick={() => {
                setSteps([...steps, applicatorAsRecord(defaultApplicator)]);
            }}>Add Applicator</button>
            <button className="btn btn-outline-primary btn-sm flex-grow-1" title="Add a group whose applicators run on each image separately" onClick={() => {
                setSteps([...steps, newGroup('each', [applicatorAsRecord(defaultApplicator)])]);
            }}>Add Group</button>
            <button className="btn btn-outline-secondary btn-sm" title="Put all top-level applicators into one 'for each image' group"
                disabled={steps.length === 0 || steps.some(isGroup)}
                onClick={() => setSteps([newGroup('each', steps as PureRasterApplicatorRecord[])])}>
                Group all
            </button>
        </div>
    </div>;
}
