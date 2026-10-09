import { PureRasterOperation } from "./types";
import { OperationIcon } from "./OperationIcon";
import { OperationTypeOptions } from "./OperationTypeOptions";
import { PureRasterOperationRecord, operationAsRecord } from "../PureRasterApplicator";
import { SettingsEditor } from "../../../Composer/ui/SettingsEditor";

/**
 * Edits one operation in the Pure Editor, graph editor and filter gallery: an optional type picker,
 * then the registry-driven settings editor Composer uses, so every operation (Tone included) has
 * labeled controls.
 */
export const PureRasterOperationInlineEditor = ({
    value,
    onChange,
    sampleOperators,
    inputs
}:{
    value: PureRasterOperationRecord,
    onChange:(newOp: PureRasterOperationRecord) => void,
    sampleOperators?: PureRasterOperation[];
    /** Loads the images flowing into this operation, enabling visual editors (crop, palettes). */
    inputs?: () => Promise<OffscreenCanvas[]>;
}) => {
    const op = value;
    return (
        <>
            {sampleOperators && <span>
                <OperationIcon op={op} className="me-2"/>
                <select value={op.type}
                    onChange={e => {
                        const replacementOp = sampleOperators.filter(o => o.type === e.target.value)[0];
                        onChange(operationAsRecord(replacementOp));
                    }}
                >
                    <OperationTypeOptions operations={sampleOperators} />
                </select>
            </span>}
            <div className="composer composer-embedded">
                <SettingsEditor
                    op={op}
                    inputs={inputs}
                    onChange={next => onChange({ ...next, id: value.id } as PureRasterOperationRecord)} />
            </div>
        </>
    );
};
