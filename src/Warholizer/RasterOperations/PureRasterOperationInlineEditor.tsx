import { Angle, Byte, Percentage, angle, byte, percentage, rightAngles } from "./NumberTypes";
import { Dimension, Direction, PureRasterOperation } from "./PureRasterOperation";
import { ButtonRadiosInput } from "./ButtonRadiosInput";
import { Rotate90DegreesCw } from "@mui/icons-material";
import { OperationIcon } from "./OperationIcon";

const AbstractNumberInput = <T extends number>(
    min:T,
    max:T,
    step:number,
    sanitize:(n:number) => T,
    type: "range" | "number"
) => ({
    value,
    onChange,
}:{
    value: T,
    onChange: (v:T) => void,
}) => {
    const width = type === "number" ? '3.5em' : '';
    const className = type === "number" ? "ms-2" : "";
    return <input type={type}
        value={value}
        min={min} max={max} step={step}
        className={className}
        style={{width}}
        onChange={e => {
            onChange(sanitize(parseInt(e.target.value)));
        }}
    />;
};

const NumberInput = AbstractNumberInput<number>(-Infinity,Infinity,1,n => n,"number");
const AngleInput = AbstractNumberInput<Angle>(0,360,1,angle,"range");
const PercentageInput = AbstractNumberInput<Percentage>(0,100,1,percentage,"range");
const ByteInput = AbstractNumberInput<Byte>(0,255,1,byte,"range");
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
    value: PureRasterOperation,
    onChange:(newOp: PureRasterOperation) => void,
    sampleOperators: PureRasterOperation[];
}) => {
    const op = value;
    const opType = op.type;
    return (
        <>
            <span>
                <OperationIcon op={op} className="me-2"/>
                <select value={opType}
                    onChange={e => {
                        const replacementOp = sampleOperators.filter(o => o.type === e.target.value)[0];
                        onChange(replacementOp);
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
                        const effectiveRightAngles = rightAngles.filter(a => a !== 360);
                        return (
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
                    case 'scaleToFit': return `scaleToFit(${op.w},${op.h})`;
                    case 'scale': return (
                        <></>
                    );
                    case 'line': return (
                        <DirectionInput
                            value={op.direction}
                            onChange={direction => {
                                onChange({...op, direction});
                            }}
                        />
                    );
                    default:
                        throw new Error(`Unexpected operation type: ${opType}`);
                }
            })()}
        </>
    );
};