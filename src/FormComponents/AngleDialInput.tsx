import { Angle, angle, anglesEvery } from "../NumberTypes";
import React from "react";

export function AngleDialInput({
    value,
    onChange,
    step
}: {
    value: Angle;
    onChange: (newValue: Angle) => void;
    step: Angle;
}) {
    const s = 40;
    const r = s / 2;
    const stepMarkerLength = s / 10;
    const canvasRef = React.createRef<HTMLCanvasElement>();
    const availableAngles = anglesEvery(step);
    const [clickOrTouchInProgress, setClickOrTouchInProgress] = React.useState(false);

    React.useEffect(() => {
        if (!canvasRef.current) {
            return;
        }
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
            return;
        }
        //console.log('draw');
        ctx.clearRect(0, 0, s, s);
        ctx.save();
        ctx.translate(r, r);
        ctx.strokeStyle = '#333';
        ctx.lineWidth = 1;
        {
            ctx.save();
            ctx.beginPath();
            ctx.arc(0, 0, r - 1, 0, 2 * Math.PI);
            ctx.stroke();
            ctx.restore();
        }
        for (const stepAngle of availableAngles) {
            ctx.save();
            ctx.rotate(stepAngle * Math.PI / 180);
            ctx.translate(r - stepMarkerLength, 0);
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.lineTo(stepMarkerLength-1, 0);
            ctx.stroke();
            ctx.restore();
        }
        {
            ctx.save();
            const radians = value * Math.PI / 180;
            const x = r * Math.cos(radians);
            const y = r * Math.sin(radians);
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.lineTo(x, y);
            ctx.stroke();
            ctx.arc(0,0,r-1,radians,0,true);//shadow area
            ctx.closePath();
            ctx.fillStyle = 'rgba(0,0,0,0.20)';
            ctx.fill();
            ctx.restore();
        }
        ctx.beginPath();
        ctx.arc(0,0,s/20,0,Math.PI*2);
        ctx.fillStyle='white';
        ctx.fill();
        ctx.stroke();
        ctx.restore();
    }, [canvasRef, stepMarkerLength, value, r, availableAngles]);

    const bestFitToPoint = (clientX: number, clientY: number) => {
        const rect = canvasRef.current!.getBoundingClientRect();
        const x = clientX - rect.left - r;
        const y = clientY - rect.top - r;
        let deg = Math.atan2(y,x) * 180/Math.PI;
        if(deg < 0){
            deg += 360;
        }
        const closestAngles = 
            [angle(360) as Angle,...availableAngles]
            .sort((a,b) => Math.abs(deg-a) - Math.abs(deg-b));
        //console.log({x,y,deg,closestAngles});
        if(closestAngles.length > 0){
            const newValue = closestAngles[0];
            if(newValue !== value){
                onChange(newValue);
            }
        }
    };

    const handleMouseEvent = (e: React.MouseEvent<HTMLCanvasElement, MouseEvent>) => {
        bestFitToPoint(e.clientX, e.clientY);
    }

    const handleTouchEvent = (e: React.TouchEvent<HTMLCanvasElement>) => {
        bestFitToPoint(e.touches[0].clientX, e.touches[0].clientY);
    }

    return <>
        <canvas 
            ref={canvasRef}
            width={s}
            height={s}
            onTouchStart={() => setClickOrTouchInProgress(true)}
            onTouchEnd={() => setClickOrTouchInProgress(false)}
            onTouchMove={e => {
                if(!clickOrTouchInProgress){
                    return;
                }
                handleTouchEvent(e);
            }}
            onMouseDown={() => setClickOrTouchInProgress(true)}
            onMouseUp={() => setClickOrTouchInProgress(false)}
            onMouseMove={e => {
                if(!clickOrTouchInProgress){
                    return;
                }
                handleMouseEvent(e);
            }}
            onClick={handleMouseEvent}
            style={{
                //border:'1px solid black',
                //width: `${s / 2}px`,
                //height: `${s / 2}px`
            }}
        />
    </>;
}
