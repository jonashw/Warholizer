import React from "react";
import { Angle, Byte, Percentage, angle, byte, percentage } from "./NumberTypes";
import { Dimension, PureRasterOperation } from "./PureRasterOperation";

const NumberInput = <T extends number>(min:T,max:T,step:number,sanitize:(n:number) => T) => ({
    value,
    onChange
}:{
    value: T,
    onChange: (v:T) => void
}) =>
    <input type="number"
        value={value}
        min={min} max={max} step={step}
        className="ms-2"
        style={{width:'3.5em'}}
        onChange={e => {
            onChange(sanitize(parseInt(e.target.value)));
        }}
    />;

const AngleInput = NumberInput<Angle>(0,360,1,angle);
const PercentageInput = NumberInput<Percentage>(0,100,1,percentage);
const ByteInput = NumberInput<Byte>(0,255,1,byte);
const DimensionInput = ({
    id,
    value,
    onChange
}:{
    id: string,
    value: Dimension,
    onChange: (d:Dimension) => void
}) =>
    <span>
        {(["x","y"] as Dimension[]).map(dim => 
            <label key={dim} className="ms-2">
                <input
                    type="radio"
                    name={"dimension-" + id}
                    value={dim}
                    checked={value === dim}
                    onChange={e => {
                        if(e.target.value === dim){
                            onChange(dim);
                        }
                    }}
                />
                {' '}{dim}
            </label>
        )}
    </span>;

export const PureRasterOperationInlineEditor = ({
    id,
    value,
    onChange
}:{
    id: string,
    value: PureRasterOperation,
    onChange:(newOp: PureRasterOperation) => void
}) => {
    const op = value;
    const opType = op.type;
    const rando = React.useMemo(() => crypto.randomUUID,[]);
    return (
        <div>
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
                        <span>
                            <DimensionInput
                                id={id + '-' + rando}
                                value={op.dimension}
                                onChange={dimension => onChange({...op, dimension})}
                            />
                            <PercentageInput
                                value={op.amount}
                                onChange={amount => onChange({...op, amount})}
                            />
                        </span>
                    );
                    case 'scaleToFit': return `scaleToFit(${op.w},${op.h})`;
                    case 'scale': return (
                        <></>
                    );
                    case 'stack': return (
                        <DimensionInput
                            id={id + '-' + rando}
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
        </div>
    );
};