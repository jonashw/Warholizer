import React from "react";
import { PureRasterOperation, Scale, SlideWrap } from "./PureRasterOperation/";
import { Filter } from "./Filter";
import { percentage } from "../../NumberTypes";


export const NewFilterForm = ({
    input,
    onApply
}: {
    input: Filter;
    onApply: (r: PureRasterOperation) => void;
}) => {
    const [wrap,setWrap] = React.useState<SlideWrap>({type:'slideWrap',amount: 50,dimension:'x'});
    const [scale,setScale] = React.useState<Scale>({type:'scale',x:1,y:1});
    return <div>
        Create parent:
        <div>
            X: <input
                type="range"
                min={0.1}
                max={2}
                step={0.1}
                value={scale.x}
                className="me-3"
                onChange={e => setScale({...scale, x: parseFloat(e.target.value)})} />
            Y: <input
                type="range"
                //style={{transform:'rotate(90deg)'}}
                min={0.1}
                max={2}
                step={0.1}
                value={scale.y}
                onChange={e => setScale({...scale,y:parseFloat(e.target.value)})} />
            <button
                onClick={() => onApply(scale)}>
                Scale
            </button>
        </div>
        <div>
            {['x','y'].map(dim => {
                const name =`wrap_dim_${dim}`;
                const id= `${name}_${input.id}`;
                return <label>
                    {dim} 
                    <input 
                    type="radio"
                    name={name}
                    value={dim}
                    checked={wrap.dimension === dim}
                    id={id} 
                    onChange={e => {
                        setWrap({...wrap, dimension: e.target.value as any})
                    }}/>
                </label>;
            })}
            <input
                type="range"
                min={1}
                max={99}
                value={wrap.amount}
                onChange={e => setWrap({...wrap, amount: percentage(parseInt(e.target.value))})} />
            <button
                onClick={() => onApply(wrap) }>
                Wrap
            </button>
        </div>
    </div>;
};