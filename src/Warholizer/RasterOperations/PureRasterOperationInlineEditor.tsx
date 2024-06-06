import { Angle, Byte, Percentage, PositiveNumber, angle, byte, percentage, positiveNumber } from "./NumberTypes";
import { BlendingMode, BlendingModes, Dimension, Direction, PureRasterOperation, RotationOrigin, RotationOrigins } from "./PureRasterOperation";
import { ButtonRadiosInput } from "./ButtonRadiosInput";
import { Rotate90DegreesCw } from "@mui/icons-material";
import { OperationIcon } from "./OperationIcon";
import { PureRasterOperationRecord, operationAsRecord } from "./PureRasterApplicator";
import { DropdownSelector } from "./DropdownSelector";
import React from "react";
import { AngleDialInput } from "./AngleDialInput";

export const anglesEvery = (degrees: Angle): Angle[] => {
    const angles: Angle[] = [];
    let lastAngle: Angle = angle(0);
    while(lastAngle < 360){
        angles.push(lastAngle);
        lastAngle += degrees;
    }
    return angles;
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
    return <input type={type}
        value={value}
        min={min} max={max} step={stepOverride ?? step}
        className={className}
        style={{width}}
        onChange={e => {
            onChange(sanitize(parseFloat(e.target.value)));
        }}
    />;
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
    sampleOperators: PureRasterOperation[];
}) => {
    const [angleStep,setAngleStep] = React.useState<Angle>(90);
    const op = value;
    const opType = op.type;
    return (
        <>
            <span>
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
            </span>
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
                        <input type="number"
                            value={op.n}
                            min="1" max="5" step="1" 
                            className="ms-2"
                            style={{width:'2.5em'}}
                            onChange={e => {
                                onChange({...op, n: parseInt(e.target.value)});
                            }}/>
                        );
                    case 'rotate': {
                        const effectiveRightAngles = anglesEvery(angle(22.5));
                        return (
                            <>
                            <AngleDialInput 
                                value={op.degrees}
                                step={angleStep}
                                onChange={degrees => onChange({...op, degrees})}
                            />
                            <span>
                                <DropdownSelector<string> 
                                    value={angleStep.toString()}
                                    options={([5,10,15,22.5,45,90].map(n => n.toString()))
                                        .map(value => ({value, label: `${value}°`}))}
                                    onChange={step => setAngleStep(angle(parseFloat(step)))}
                                />
                                {' '}
                                step
                                <AngleInput
                                    value={op.degrees}
                                    stepOverride={angleStep}
                                    onChange={degrees => onChange({...op, degrees})}
                                />
                            </span>
                            <span>
                                <button className="btn btn-sm btn-outline-secondary" onClick={() => {
                                    const nextIndex = effectiveRightAngles.indexOf(op.degrees) + 1;
                                    const degrees = 
                                        nextIndex > effectiveRightAngles.length - 1
                                        ? effectiveRightAngles[0]
                                        : effectiveRightAngles[nextIndex];
                                    onChange({...op, degrees});
                                }}>
                                    <Rotate90DegreesCw fontSize="small" />
                                </button>
                                {' '}
                                {op.degrees.toString().padStart(3,"0")}&deg;
                            </span>
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
                        <input type="number"
                            value={op.pixels}
                            min="0" max="100" step="1" 
                            className="ms-2"
                            style={{width:'3.5em'}}
                            onChange={e => {
                                onChange({...op, pixels: parseInt(e.target.value)});
                            }}/>);
                    case 'invert': return;
                    case 'scale': return (
                        <>
                            <FractionalNumberInput
                                value={op.x}
                                onChange={x => onChange({...op, x})}
                            />
                            &times;
                            <FractionalNumberInput
                                value={op.y}
                                onChange={y => onChange({...op, y})}
                            />
                        </>
                    );
                    case 'scaleToFit': return (
                        <>
                            <PositiveNumberInput
                                value={op.w}
                                onChange={w => onChange({...op, w})}
                            />
                            &times;
                            <PositiveNumberInput
                                value={op.h}
                                onChange={h => onChange({...op, h})}
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
                            <NumberInput
                                value={op.cols}
                                onChange={cols => onChange({...op, cols})}
                            />
                            <NumberInput
                                value={op.rows}
                                onChange={rows => onChange({...op, rows})}
                            />
                        </>
                    );
                    case 'tile': return (
                        <>
                            <DimensionInput
                                value={op.primaryDimension}
                                onChange={primaryDimension => onChange({...op, primaryDimension})}
                            />
                            <NumberInput
                                value={op.lineLength}
                                onChange={lineLength => onChange({...op, lineLength})}
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