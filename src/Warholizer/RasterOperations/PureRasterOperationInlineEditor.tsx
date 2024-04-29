import { Angle, Byte, Percentage, angle, byte, percentage } from "./NumberTypes";
import { Dimension, Direction, PureRasterOperation } from "./PureRasterOperation";
import { ButtonRadiosInput } from "./ButtonRadiosInput";

const NumberInput = <T extends number>(
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

const AngleInput = NumberInput<Angle>(0,360,1,angle,"range");
const PercentageInput = NumberInput<Percentage>(0,100,1,percentage,"range");
const ByteInput = NumberInput<Byte>(0,255,1,byte,"range");
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
    onChange
}:{
    value: PureRasterOperation,
    onChange:(newOp: PureRasterOperation) => void
}) => {
    const op = value;
    const opType = op.type;
    return (
        <>
            {op.type}
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
                    case 'wrap': return (
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
                    case 'stack': return (
                        <DimensionInput
                            value={op.dimension}
                            onChange={dimension => {
                                onChange({...op, dimension});
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