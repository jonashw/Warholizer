import { CSSProperties } from "react";
import { Angle, Byte, Percentage, PositiveNumber} from "./NumberTypes";

export type Dimension = 'x'|'y';
export type Direction = 'up' | 'down' | 'left' | 'right';
export type Invert = { type: "invert" };
export type Void = { type: "void" };
export type Fill = { type: "fill", color: CSSProperties["color"] };
export type Noop = { type: "noop" };
export type Crop = { type: "crop", x: number, y: number, width: number, height: number, unit: 'px' | '%' }
export type Threshold = { type: "threshold", value: Byte };
export type Multiply = { type: "multiply", n: number };
export type Split = { type: "split", dimension: Dimension, amount: Percentage };
export type SlideWrap = { type: "slideWrap", dimension: Dimension, amount: Percentage };
export type Blur = { type: "blur", pixels: number };
export type Grayscale = { type: "grayscale", percent: Percentage };
export type Rotate = { type: "rotate", degrees: Angle }
export type RotateHue = { type: "rotateHue", degrees: Angle }
export type Scale = { type: "scale", x: number, y: number };
export type ScaleToFit = { type: "scaleToFit", w: PositiveNumber, h: PositiveNumber };
export type Line = { type: "line", direction: Direction};
export type Tile = { type: "tile", primaryDimension: Dimension, lineLength: number };
export type Grid = { type: "grid", rows: number, cols: number };
export type Stack = {type: "stack", blendingMode: BlendingMode};
export type BlendingMode = 
  | "source-over" | "source-in" | "source-out" | "source-atop"
  | "destination-over" | "destination-in" | "destination-out" | "destination-atop"
  | "lighter" | "copy" | "xor" | "multiply" | "screen" | "overlay" | "darken"
  | "lighten" | "color-dodge" | "color-burn" | "hard-light" | "soft-light"
  | "difference" | "exclusion" | "hue" | "saturation" | "color" | "luminosity";
  
export const BlendingModes: BlendingMode[] = [
  "source-over",
  "source-in",
  "source-out",
  "source-atop",
  "destination-over",
  "destination-in",
  "destination-out",
  "destination-atop",
  "lighter",
  "copy",
  "xor",
  "multiply",
  "screen",
  "overlay",
  "darken",
  "lighten",
  "color-dodge",
  "color-burn",
  "hard-light",
  "soft-light",
  "difference",
  "exclusion",
  "hue",
  "saturation",
  "color",
  "luminosity"
];

export type PureRasterOperation = 
  | Stack
  | Split
  | Void
  | Crop
  | Grid
  | Fill
  | Tile
  | Line
  | SlideWrap 
  | Scale
  | ScaleToFit
  | Noop
  | Blur
  | RotateHue
  | Rotate
  | Grayscale
  | Threshold
  | Multiply
  | Invert;

const apply = async (op: PureRasterOperation, inputs: OffscreenCanvas[]): Promise<OffscreenCanvas[]> => {
  const opType = op.type;
  switch(opType){
    case 'stack':
      {
        if(inputs.length === 0){
          return inputs;
        }
        const inp = inputs[0];
        return offscreenCanvasOperation(inp.width, inp.height, (ctx) => {
          ctx.globalCompositeOperation = op.blendingMode;
          for(const inp of inputs){
            ctx.drawImage(inp,0,0);
          }
        }).then(osc => [osc]);
      }
    case 'void': 
      return [];
    case 'noop': 
      return inputs;
    case 'multiply': 
      return Array(op.n).fill(inputs).flatMap(inputs => inputs);
    case 'fill':
      return Promise.all(inputs.map(input => {
        return offscreenCanvasOperation(input.width,input.height,(ctx) => {
          ctx.fillStyle=op.color ?? "#000000";
          ctx.fillRect(0,0,input.width,input.height);
        });
      }));
    case 'crop': 
      return Promise.all(inputs.map(input => {
        const [x,y,w,h] =
          op.unit === "px" 
          ? [op.x, op.y, op.width, op.height] 
          : [
            input.width * op.x / 100,
            input.height * op.y / 100,
            input.width * op.width / 100,
            input.height * op.height / 100
          ];
        return offscreenCanvasOperation(w,h,(ctx) => {
          ctx.drawImage(
            input,
            x, //sx
            y, //sy
            w, //sw
            h,//sh
            0,//dx
            0,//dy
            w,//dw
            h//dh
          );
        });
      }));
    case 'threshold': 
      return Promise.all(inputs.map(input =>
        offscreenCanvasOperation(input.width, input.height,(ctx) => {
          ctx.drawImage(input,0,0);
          const imgData = ctx.getImageData(0,0,input.width,input.height);
          for (let i=0; i<imgData.data.length; i+=4) { // 4 is for RGBA channels
            const currentPixelValue = rgbaValue(
              imgData.data[i+0],
              imgData.data[i+1],
              imgData.data[i+2],
              imgData.data[i+3]);
            const thresholdValue = currentPixelValue < op.value ? 0 : 255;
            imgData.data[i+0] = thresholdValue;//R
            imgData.data[i+1] = thresholdValue;//G
            imgData.data[i+2] = thresholdValue;//B
            imgData.data[i+3] = 255;//A
          }
          ctx.putImageData(imgData, 0, 0);
        })));
    case 'grayscale': 
      return Promise.all(inputs.map(input =>
        offscreenCanvasOperation(input.width, input.height,(ctx) => {
          ctx.filter=`grayscale(${op.percent}%)`
          ctx.drawImage(input,0,0);
        })));
    case 'rotateHue': 
      return Promise.all(inputs.map(input =>
        offscreenCanvasOperation(input.width, input.height,(ctx) => {
          ctx.filter=`hue-rotate(${op.degrees}deg)`
          ctx.drawImage(input,0,0);
        })));
    case 'blur': 
      return Promise.all(inputs.map(input =>
        offscreenCanvasOperation(input.width, input.height,(ctx) => {
          ctx.filter=`blur(${op.pixels}px)`
          ctx.drawImage(input,0,0);
        })));
    case 'invert': 
      return Promise.all(inputs.map(input =>
        offscreenCanvasOperation(input.width, input.height,(ctx) => {
          ctx.filter="invert()";
          ctx.drawImage(input,0,0);
        })));
    case 'split': {
      const proportions = [
        (op.amount)/100,
        (100-op.amount)/100
      ];
      return Promise.all(inputs.flatMap(input =>
        proportions.map((proportion,i) => {
          const [w,h,sx,sy] = 
            op.dimension === 'x' 
            ? [input.width * proportion, input.height,  i===0 ? 0 : input.width * (1-proportion),0]
            : [input.width, input.height * proportion,0,i===0 ? 0 : input.height * (1-proportion)];
          console.log({w,h,sx,sy,proportion,i});
          return offscreenCanvasOperation(w, h, (ctx) => {
            ctx.translate(-sx,-sy);
            ctx.drawImage(input, 0, 0);
          });
        })));
      }
    case 'slideWrap': 
      return Promise.all(inputs.map(input =>
        offscreenCanvasOperation(input.width, input.height,(ctx) => {
          const wrapCoefficient = op.amount/100;
          if(op.dimension === 'x'){
            const x = input.width * wrapCoefficient;
            const xx = input.width - x;
            ctx.drawImage(input,x,0);
            ctx.drawImage(input,-xx,0);
          }
          if(op.dimension === 'y'){
            const y = input.height * wrapCoefficient;
            const yy = input.height - y;
            ctx.drawImage(input,0,-y);
            ctx.drawImage(input,0,yy);
          }
        })));
    case 'scaleToFit':
      return Promise.all(inputs.map(input => {
        const ar = input.width / input.height;
        const wr = op.w / input.width;
        const hr = op.h / input.height;

        const [scaleFactor,width,height] = 
          op.w > input.width && op.h > input.height
          ? [1,input.width,input.height] //do not scale up
          : wr < hr
          ? [wr,op.w,op.w / ar] //width drive
          : [hr,op.h * ar,op.h];
        return offscreenCanvasOperation(width, height, (ctx) => {
          ctx.scale(scaleFactor,scaleFactor);
          ctx.drawImage(input,0,0);
        });
      }));
    case 'rotate':
      return Promise.all(inputs.map(input => {
        const dimensionSwitch = op.degrees === 90 || op.degrees === 270;
        const [width,height] =
          dimensionSwitch
          ? [input.height,input.width]
          : [input.width,input.height];
        const scaleToRetainFullImage = true;
        return offscreenCanvasOperation(width, height, (ctx) => {
          const radians = op.degrees * Math.PI / 180;
          ctx.translate(width/2,height/2);//we want to rotate about the center of the image
          if(scaleToRetainFullImage){
            //reference: https://stackoverflow.com/questions/6657479/aabb-of-rotated-sprite
            const aabb = {
              h: width * Math.abs(Math.sin(radians)) + height * Math.abs(Math.cos(radians)),
              w: height * Math.abs(Math.sin(radians)) + width * Math.abs(Math.cos(radians))
            };
            const scale = {
              x: width/aabb.w,
              y: height/aabb.h
            };
            console.log({radians,aabb,scale});
            ctx.scale(scale.x,scale.y);
          }
          ctx.rotate(radians);
          if(dimensionSwitch){
            ctx.translate(-height/2,-width/2);//we want to rotate about the center of the image
          } else {
            ctx.translate(-width/2,-height/2);//we want to rotate about the center of the image
          }
          ctx.drawImage(input,0,0);
        });
      }));
    case 'scale':
      return Promise.all(inputs.map(input => {
        const scaleWidth = Math.abs(op.x) * input.width;
        const scaleHeight = Math.abs(op.y) * input.height;
        return offscreenCanvasOperation(scaleWidth, scaleHeight, (ctx) => {
          if(op.x < 0){
            ctx.translate(scaleWidth,0);
          }
          if(op.y < 0){
            ctx.translate(0,scaleHeight);
          }
          ctx.scale(op.x, op.y);
          ctx.drawImage(input,0,0);
        });
      }));
    case 'grid': return Promise.all(inputs.map(input => {
      if(op.cols <= 0 || op.cols <= 0){
        return input;
      }
      return offscreenCanvasOperation(op.cols * input.width, op.rows * input.height, (ctx) => {
        for(let r = 0; r < op.rows; r++){
          ctx.save();
          for(let c = 0; c < op.cols; c++){
            ctx.drawImage(input,0,0);
            ctx.translate(input.width,0);
          }
          ctx.restore();
          ctx.translate(0,input.height);
        }
      });
    }));
    case 'tile': {
      if(op.lineLength <= 0){
        return inputs;
      }
      const lineCount = Math.ceil(inputs.length / op.lineLength);
      const lines = 
        Array(lineCount)
        .fill(undefined)
        .map((_,i) => {
          const lineInputs = inputs.slice(i*op.lineLength,(i+1)*op.lineLength);
          const [width,height] = 
          op.primaryDimension === "x"
          ?  [
            lineInputs.map(i => i.width).reduce((a,b) => a + b, 0),
            Math.max(...lineInputs.map(i => i.height))
          ] : [
            Math.max(...lineInputs.map(i => i.width)),
            lineInputs.map(i => i.height).reduce((a,b) => a + b, 0)
          ];
          return {
            inputs: lineInputs,
            width,
            height
          };
        });

      const [width,height] = 
        op.primaryDimension === "x"
        ? [
          Math.max(...lines.map(l => l.width)),
          lines.map(l => l.height).reduce((a,b) => a + b, 0)
        ] : [
          lines.map(l => l.width).reduce((a,b) => a + b, 0),
          Math.max(...lines.map(l => l.height))
        ];
        
      return [await offscreenCanvasOperation(width, height, (ctx) => {
        for(let line of lines){
          ctx.save();
          for(let input of line.inputs){
            ctx.drawImage(input,0,0);

            if(op.primaryDimension === "x"){
              ctx.translate(input.width,0);
            } else {
              ctx.translate(0,input.height);
            }
          }
          ctx.restore();
          if(op.primaryDimension === "x"){
            ctx.translate(0,line.height);
          } else {
            ctx.translate(line.width,0);
          }
        }
      })];
    }
    case 'line': {
      const horizontal = op.direction === "left" || op.direction === "right";
      const [width,height] = 
        horizontal
        ? [
          inputs.map(i => i.width).reduce((a,b) => a + b, 0),
          Math.max(...inputs.map(i => i.height))
        ] : [
          Math.max(...inputs.map(i => i.width)),
          inputs.map(i => i.height).reduce((a,b) => a + b, 0)
        ];
      const orderedInputs = 
        op.direction === "up" || op.direction === "left"
        ? [...inputs].reverse()
        : inputs;
        
      return [await offscreenCanvasOperation(width, height, (ctx) => {
        for(const input of orderedInputs){
          ctx.drawImage(input,0,0);
          ctx.translate(
            horizontal ? input.width : 0,
            !horizontal ? input.height : 0
          );
        }
      })];
    }
    default:
      throw new Error(`Unexpected operation type: ${opType}`);
  }
}

async function offscreenCanvasOperation(
  width: number,
  height: number,
  action: (ctx: OffscreenCanvasRenderingContext2D) => void
): Promise<OffscreenCanvas> {
  const c = new OffscreenCanvas(width,height);
  const ctx = c.getContext('2d')!;
  action(ctx);
  return c;
}

function rgbaValue(r: number, g: number, b: number, a: number) {
  //reference: https://computergraphics.stackexchange.com/a/5114
  //const [rPeakWavelength,gPeakWavelength,bPeakWavelength]=[600,540,450];
  const [rCoeff,gCoeff,bCoeff]=[0.21,0.72,0.07];
  return Math.floor((a/255) * ((r * rCoeff) + (g * gCoeff) + (b * bCoeff)));
}

const stringRepresentation = (op: PureRasterOperation): string => {
  const opType = op.type;
  switch(opType){
    case 'stack'     : return `stack(${op.blendingMode})`;
    case 'noop'      : return "noop";
    case 'multiply'  : return `multiply(${op.n})`;
    case 'threshold' : return `threshold(${op.value})`;
    case 'grayscale' : return `grayscale(${op.percent}%)`;
    case 'rotateHue' : return `rotateHue(${op.degrees}deg)`;
    case 'rotate'    : return `rotate(${op.degrees}deg)`;
    case 'blur'      : return `blur(${op.pixels}px)`;
    case 'invert'    : return "invert";
    case 'crop'      : return `crop(${op.x},${op.y},${op.width},${op.height},${op.unit})`;
    case 'grid'      : return `grid(${op.rows},${op.cols})`;
    case 'split'     : return `split(${op.dimension},${op.amount}%)`;
    case 'slideWrap' : return `slideWrap(${op.dimension},${op.amount}%)`;
    case 'scaleToFit': return `scaleToFit(${op.w},${op.h})`;
    case 'scale'     : return `scale(${op.x},${op.y})`;
    case 'line'      : return `line(${op.direction})`;
    case 'tile'      : return `tile(${op.primaryDimension},${op.lineLength})`;
    case 'void'      : return `void`;
    case 'fill'      : return `fill(${op.color})`;
    default: {
      throw new Error(`Unexpected operation type: ${opType}`);
    }
  }
}

const applyFlatMap = async (ops: PureRasterOperation[], inputs: OffscreenCanvas[]): Promise<OffscreenCanvas[]> => {
  return (await Promise.all(ops.flatMap(op => apply(op, inputs)))).flatMap(d => d);
};

const applyPipeline = async (ops: PureRasterOperation[], inputs: OffscreenCanvas[]): Promise<OffscreenCanvas[]> => {
  const pipeds = await Promise.all(inputs.flatMap(input => {
    const piped = ops.reduce(
      async (oscs,op) => apply(op, await oscs),
      Promise.resolve([input]));
    return piped;
  }));
  return pipeds.flatMap(p => p);
};

export const PureRasterOperations = {apply, stringRepresentation, applyPipeline, applyFlatMap};