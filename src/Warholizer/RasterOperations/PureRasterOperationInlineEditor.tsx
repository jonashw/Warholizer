import { Angle, Byte, Percentage, PositiveNumber, angle, byte, percentage, positiveNumber } from "./NumberTypes";
import { BlendingMode, BlendingModes, Dimension, Direction, PureRasterOperation, RotationOrigin, RotationOrigins } from "./PureRasterOperation";
import { ButtonRadiosInput } from "./ButtonRadiosInput";
import { OperationIcon } from "./OperationIcon";
import { PureRasterOperationRecord, operationAsRecord } from "./PureRasterApplicator";
import { DropdownSelector } from "./DropdownSelector";
import React from "react";
import { AngleDialInput } from "./AngleDialInput";
import { Add, Remove } from "@mui/icons-material";

const toPrecision = (n: number, fractionalDigits: number) => 
    parseFloat(n.toFixed(fractionalDigits));

export const anglesEvery = (degrees: Angle): Angle[] => {
    const angles: Angle[] = [];
    let lastAngle: Angle = angle(0);
    while(lastAngle < 360){
        angles.push(lastAngle);
        lastAngle += degrees;
    }
    return angles;
};

function NumberSpinnerInput<T extends number>({
    min,
    max,
    step,
    sanitize,
    value,
    onChange,
    circular
} : {
    min:T,
    max:T,
    step:number,
    sanitize:(n:number) => T,
    value: T,
    onChange: (v:T) => void,
    circular?: boolean
}) {
    React.useEffect(
        /* When changing the step from smaller to larger,
        ** it is possible that the current value would become unreachable.
        **
        ** Example: switching from 45 to 90 degrees with a current value of 135
        ** Pressing + would yield 225 degrees, which is not a valid step of 90.
        ** 
        ** To prevent invalid/unintended states, we have to snap to the closest
        ** 'valid' value when the step changes.  */
        () => { 
            const sanitized = sanitize(value - value % step);
            if(value === sanitized){
                //avoid unnecessary updates!
                return; 
            }
            onChange(sanitized); 
        },
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [step/*, sanitize, onChange, value (AVOID INFINITE LOOP)*/]);

    const move = (stepCount: number) => {
        const nextValue = value + (stepCount * step);
        if(nextValue < min){
            if(circular){
                onChange(max);
            } else {
                onChange(min);
            }
        } else if (max < nextValue){
            if(circular){
                onChange(min);
            } else {
                onChange(max);
            }
        } else {
            onChange(sanitize(nextValue));
        }
    };
    return <div className="input-group" style={{width:'unset',flexWrap:'nowrap'}}>
        <button className="btn btn-sm btn-outline-secondary" onClick={() => move(-1)}>
            <Remove/>
        </button>
        <input
            className="form-control form-control-sm border-secondary"
            type="text"
            inputMode="numeric"
            style={{
                textAlign:'center',
                width:'5em'
            }}
            value={value}
            onChange={e => {
                onChange(sanitize(parseFloat(e.target.value)));
            }}
        />
        <button className="btn btn-sm btn-outline-secondary" onClick={() => move(1)}>
            <Add/>
        </button>
    </div>;
};

const AbstractNumberInput = <T extends number>(
    min:T,
    max:T,
    step:number,
    sanitize:(n:number) => T,
    type: "range" | "number"
) => ({
    value,
    onChange,
    stepOverride
}:{
    value: T,
    onChange: (v:T) => void,
    stepOverride?: T
}) => {
    const width = type === "number" ? '3.5em' : '';
    const className = type === "number" ? "ms-2" : "";
    return (
        <input type={type}
            value={value}
            min={min} max={max} step={stepOverride ?? step}
            className={className}
            style={{width}}
            onChange={e => {
                onChange(sanitize(parseFloat(e.target.value)));
            }}
        />
    );
};

export const NumberInput = AbstractNumberInput<number>(-Infinity,Infinity,1,n => n,"number");
export const FractionalNumberInput = AbstractNumberInput<number>(-Infinity,Infinity,.1,n => n,"number");
export const AngleInput = AbstractNumberInput<Angle>(0,360,1,angle,"range");
export const PercentageInput = AbstractNumberInput<Percentage>(0,100,1,percentage,"range");
export const ByteInput = AbstractNumberInput<Byte>(0,255,1,byte,"range");
export const PositiveNumberInput = AbstractNumberInput<PositiveNumber>(positiveNumber(0),positiveNumber(Infinity),1,positiveNumber,"number");
const DimensionInput = ({
    value,
    onChange
}:{
    value: Dimension,
    onChange: (d:Dimension) => void
}) =>
    <ButtonRadiosInput<Dimension> 
        value={value}
        options={(["x","y"] as Dimension[]).map(value => ({value, label: value}))}
        onChange={onChange}
    />;

const DirectionInput = ({
    value,
    onChange
}:{
    value: Direction,
    onChange: (d:Direction) => void
}) =>
    <ButtonRadiosInput<Direction> 
        value={value}
        options={(["up","down","left","right"] as Direction[]).map(value => ({value, label: value}))}
        onChange={onChange}
    />;

export const PureRasterOperationInlineEditor = ({
    value,
    onChange,
    sampleOperators
}:{
    value: PureRasterOperationRecord,
    onChange:(newOp: PureRasterOperationRecord) => void,
    sampleOperators?: PureRasterOperation[];
}) => {
    const angleStep: Angle = angle(22.5);
    const op = value;
    const opType = op.type;
    return (
        <>
            {sampleOperators && <span>
                <OperationIcon op={op} className="me-2"/>
                <select value={opType}
                    onChange={e => {
                        const replacementOp = sampleOperators.filter(o => o.type === e.target.value)[0];
                        onChange(operationAsRecord(replacementOp));
                    }}
                >
                    {sampleOperators.map(op =>
                        <option value={op.type} key={op.type}>
                            {op.type}
                        </option>
                    )}
                </select>
            </span>}
            {(() => {
                switch (opType) {
                    case 'noop': return;
                    case 'void': return;
                    case 'fill': return (
                        <input type="color"
                            value={op.color}
                            className="ms-2"
                            onChange={e => {
                                onChange({...op, color: e.target.value ?? "#000000"});
                            }}/>
                        );
                    case 'multiply': return (
                        <NumberSpinnerInput
                            value={op.n}
                            min={1}
                            max={5}
                            step={1}
                            sanitize={n => n}
                            onChange={n => {
                                onChange({...op, n });
                            }}
                        />
                        );
                    case 'rotate': {
                        return (
                            <>
                            <AngleDialInput 
                                value={op.degrees}
                                step={angleStep}
                                onChange={degrees => onChange({...op, degrees})}
                            />
                            <NumberSpinnerInput<Angle>
                                value={op.degrees}
                                onChange={degrees => onChange({...op, degrees})}
                                min={0}
                                max={angle(360-angleStep)}
                                sanitize={n => angle(n % 360)}
                                step={angleStep}
                                circular
                            />
                            
                            <span>
                                about: 
                                {' '}
                                <DropdownSelector<RotationOrigin> 
                                    value={op.about}
                                    options={RotationOrigins.map(value => ({value, label: value}))}
                                    onChange={about => onChange({...op, about})}
                                />
                            </span>
                            </>
                        );
                    }
                    case 'threshold': return (
                        <ByteInput
                            value={op.value}
                            onChange={value => onChange({...op, value}) }
                        />
                    );
                    case 'grayscale': return (
                        <PercentageInput
                            value={op.percent}
                            onChange={percent => onChange({...op, percent }) }
                        />
                    );
                    case 'rotateHue': return (
                        <AngleInput
                            value={op.degrees}
                            onChange={degrees => onChange({...op, degrees}) }
                        />
                    );
                    case 'blur': return (
                        <NumberSpinnerInput
                            value={op.pixels}
                            min={0}
                            max={100}
                            step={1}
                            sanitize={n => n}
                            onChange={pixels => {
                                onChange({...op, pixels });
                            }}
                        />
                    );
                    case 'invert': return;
                    case 'scale': return (
                        <>
                            <NumberSpinnerInput
                                value={op.x}
                                onChange={x => onChange({ ...op, x })}
                                min={0}
                                max={1}
                                step={0.1}
                                sanitize={n=> toPrecision(n,1)}                           
                            />
                            &times;
                            <NumberSpinnerInput
                                value={op.y}
                                onChange={y => onChange({ ...op, y })}
                                min={0.1}
                                max={1}
                                step={0.1}
                                sanitize={n => toPrecision(n,1)}
                            />
                        </>
                    );
                    case 'scaleToFit': return (
                        <>
                            <NumberSpinnerInput<PositiveNumber>
                                value={op.w}
                                min={positiveNumber(0)}
                                max={positiveNumber(1000)}
                                step={1}
                                onChange={w => onChange({ ...op, w })}
                                sanitize={positiveNumber}
                            />
                            &times;
                            <NumberSpinnerInput<PositiveNumber>
                                value={op.h}
                                min={positiveNumber(0)}
                                max={positiveNumber(1000)}
                                step={1}
                                onChange={h => onChange({ ...op, h })}
                                sanitize={positiveNumber}
                            />
                        </>
                    );
                    case 'crop': return (
                        <>
                            <NumberInput
                                value={op.x}
                                onChange={x => onChange({...op, x})}
                            />
                            <NumberInput
                                value={op.y}
                                onChange={y => onChange({...op, y})}
                            />
                            <NumberInput
                                value={op.width}
                                onChange={width => onChange({...op, width})}
                            />
                            <NumberInput
                                value={op.height}
                                onChange={height => onChange({...op, height})}
                            />
                            <ButtonRadiosInput<'px' | '%'> 
                                value={op.unit}
                                options={(["px","%"] as ("px"|"%")[]).map(value => ({value, label: value}))}
                                onChange={unit => onChange({...op, unit})}
                            />
                        </>
                    );
                    case 'stack': return(
                        <select value={op.blendingMode} onChange={e => {
                            onChange({...op, blendingMode: e.target.value as BlendingMode})
                        }}>
                            {BlendingModes.map(bm => 
                                <option value={bm} key={bm}>
                                    {bm}
                                </option>
                            )}
                        </select>
                        );
                    case 'grid': return (
                        <>
                            <NumberSpinnerInput
                                value={op.cols}
                                min={1}
                                max={10}
                                step={1}
                                sanitize={n => n}
                                onChange={cols => {
                                    onChange({...op, cols});
                                }}
                            />
                            &times;
                            <NumberSpinnerInput
                                value={op.rows}
                                min={1}
                                max={10}
                                step={1}
                                sanitize={n => n}
                                onChange={rows => {
                                    onChange({...op, rows});
                                }}
                            />
                        </>
                    );
                    case 'tile': return (
                        <>
                            <DimensionInput
                                value={op.primaryDimension}
                                onChange={primaryDimension => onChange({...op, primaryDimension})}
                            />
                            <NumberSpinnerInput
                                value={op.lineLength}
                                min={1}
                                max={10}
                                step={1}
                                sanitize={n => n}
                                onChange={lineLength => {
                                    onChange({...op, lineLength });
                                }}
                            />
                        </>
                    );
                    case 'split': return (
                        <>
                            <DimensionInput
                                value={op.dimension}
                                onChange={dimension => onChange({...op, dimension})}
                            />
                            <PercentageInput
                                value={op.amount}
                                onChange={amount => onChange({...op, amount})}
                            />
                        </>
                    );
                    case 'slideWrap': return (
                        <>
                            <DimensionInput
                                value={op.dimension}
                                onChange={dimension => onChange({...op, dimension})}
                            />
                            <PercentageInput
                                value={op.amount}
                                onChange={amount => onChange({...op, amount})}
                            />
                        </>
                    );
                    case 'line': return (<>
                        <DirectionInput
                            value={op.direction}
                            onChange={direction => {
                                onChange({...op, direction});
                            }}
                        />
                        <span className="form-check">
                            <input
                                type="checkbox"
                                checked={op.squish}
                                className="form-check-input" id="squish" 
                                onChange={e => onChange({...op,squish:e.target.checked})}
                            />
                            <label htmlFor="squish" className="form-check-label">Squish</label>
                        </span>
                    </>);
                    default:
                        throw new Error(`Unexpected operation type: ${opType}`);
                }
            })()}
        </>
    );
};