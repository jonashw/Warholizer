import { hexToHsluv, hsluvToHex } from 'hsluv-ts';
import React from 'react';
import './HSLuvColorPicker.css';

const [H,S,L] = [255,100,100]
const hsluvColorSpace = 
    Array(H).fill(null).map((_,h) => 
    Array(S).fill(null).map((_,s) =>
    Array(L).fill(null).map((_,l) =>
        hsluvToHex([h,s,l])
    )));

//console.log(hsluvColorSpace);
type PickerMode = "H" | "S" | "L";
const modes: PickerMode[] = ["H","S","L"];
const modeName = (m: PickerMode) =>
      m === "H" ? "Hue constant (control Saturation x Lightness)"
    : m === "S" ? "Saturation constant (control Hue x Lightness)"
    : m === "L" ? "Lightness constant (control Hue x Saturation)"
    : (() => { throw Error("Unexpected PickerMode: " + m)})();

const HSLuvColorPicker = () => {
    const [h,setH] = React.useState<number>(Math.floor(H/2));
    const [s,setS] = React.useState<number>(Math.floor(S/2));
    const [l,setL] = React.useState<number>(Math.floor(L/2));
    const [mouseDown,setMouseDown] = React.useState<boolean>(false);
    const [color,setColor] = React.useState<string>(hsluvToHex([h,s,l]));
    const canvasRef = React.createRef<HTMLCanvasElement>();
    const [mode,setMode] = React.useState<PickerMode>("H");

    React.useEffect(() => {
        console.log('canvasRef',canvasRef.current);
        if(!canvasRef.current){
            return;
        }
        let c = canvasRef.current;
        c.width=H;
        c.height=S;
        let ctx = c.getContext('2d');
        if(!ctx){
            return;
        }
        switch(mode){
            case "H":
                for(let l=0; l<L; l++)
                for(let s=0; s<S; s++){
                    let ss = hsluvColorSpace[h];
                    if(!ss){ continue; }
                    let ls = ss[s];
                    if(!ls){ continue; }
                    let color = hsluvColorSpace[h][s][l];
                    ctx.fillStyle = color;
                    ctx.fillRect(s,L-1-l,1,1);
                }
                break;
            case "S":
                for(let h=0; h<H; h++)
                for(let l=0; l<L; l++){
                    let color = hsluvColorSpace[h][s][l];
                    ctx.fillStyle = color;
                    ctx.fillRect(h,L-1-l,1,1);
                }
                break;
            case "L":
                for(let h=0; h<H; h++)
                for(let s=0; s<S; s++){
                    let color = hsluvColorSpace[h][s][l];
                    ctx.fillStyle = color;
                    ctx.fillRect(h,S-1-s,1,1);
                }
                break;
        }

    },[canvasRef,h,s,l,mode]);

    React.useEffect(() => {
        if(!color){
            return;
        }
        document.body.style.background = color;
    }, [color]);

    React.useEffect(() => {
        if(!color){
            return;
        }
        let [h,s,l] = hexToHsluv(color);
        setH(Math.floor(h));
        setS(Math.floor(s));
        setL(Math.floor(l));
    }, [color]);

    const handleCanvasCursor = (e:React.MouseEvent) => {
        if(!canvasRef.current){
            return;
        }
        let rect = canvasRef.current.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        let color = 
            mode === "H" ? hsluvColorSpace[h][x][L-y-1]
            : mode === "S" ? hsluvColorSpace[x][s][L-y-1]
            : mode === "L" ? hsluvColorSpace[x][S-y-1][l]
            : (() => {throw Error("Unexpectected color mode: " + mode )})();
        console.log(x,y,color);
        setColor(color);
    };

    const sliders: [
        PickerMode,
        number,
        () => number,
        React.Dispatch<React.SetStateAction<number>>
    ][] = 
    [
        ["H",H,() => h, setH],
        ["S",S,() => s, setS],
        ["L",L,() => l, setL],
    ];

    return <div>
        {modes.map(m => 
            <label style={{display:'block'}}>
                <input 
                    type="radio"
                    name="mode"
                    defaultChecked={m === mode}
                    onChange={e => {
                        if(!e.target.checked){
                            return;
                        }
                        setMode(m);
                    }}
                />
                {" "}
                {modeName(m)}
            </label>)}
        <div>
            {sliders.filter(([m]) => m === mode).map(([_,max,get,set],i) =>
                <div>
                <input
                    key={i}
                    type="range"
                    min="0"
                    max={max-1}
                    onChange={e => {
                        let value = parseInt(e.target.value);
                        if(isNaN(value)){
                            return;
                        }
                        set(value);
                    }}
                />
                ({get()})
                </div>
            )}
        </div>
        <canvas
            ref={canvasRef} 
            onMouseDown={_ => setMouseDown(true)}
            onMouseUp  ={_ => setMouseDown(false)}
            onMouseMove={e => {
                if(!mouseDown){
                    return;
                }
                handleCanvasCursor(e);
            }}
            onClick={handleCanvasCursor}
        />
        {color && <div>
            <div style={{
                background:color,
                display:'inline-block',
                width:'250px',
                height:'50px',
            }}>
            </div>
        </div>}
    </div>;

/*
    return <div>
    <div style={{
        width:'255px',
    }}>
        <input
            type="range"
            min="0"
            max="100"
            onChange={e => {
                let l = parseInt(e.target.value);
                if(isNaN(l)){
                    return;
                }
                setL(l);
            }}
        />
        {colorSlices.l[l].map(colors =>
            <div style={{height:'1px'}}>
                {colors.map((c,i) => 
                    <span key={i} style={{
                        display: 'inline-block',
                        width:'1px',
                        height:'1px',
                        background: c
                    }} />
                )}
            </div>)}
        </div>
    </div>;
    */
};
export default HSLuvColorPicker;