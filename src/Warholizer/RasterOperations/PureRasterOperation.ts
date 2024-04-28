import { Angle, Byte, Percentage, PositiveNumber } from "./NumberTypes";

export type Dimension = 'x'|'y';
export type Direction = 'up' | 'down' | 'left' | 'right';

export type Invert = { type: "invert" };
export type Noop = { type: "noop" };

export type Threshold = {
  type: "threshold",
  value: Byte
};

export type Multiply = {
  type: "multiply",
  n: number
};

export type Wrap = {
  type: "wrap",
  dimension: Dimension,
  amount: Percentage
};

export type Blur = {
  type: "blur",
  pixels: number
};

export type Grayscale = {
  type: "grayscale",
  percent: Percentage
};

export type RotateHue = {
  type: "rotateHue",
  degrees: Angle
}

export type Stack = {
  type: "stack",
  dimension: Dimension
};

export type Scale = {
  type: "scale",
  x: number,
  y: number
};
export type ScaleToFit = {
  type: "scaleToFit",
  w: PositiveNumber,
  h: PositiveNumber
};

export type PureRasterOperation = 
  | Wrap 
  | Stack 
  | Scale
  | ScaleToFit
  | Noop
  | Blur
  | RotateHue
  | Grayscale
  | Threshold
  | Multiply
  | Invert;


const offscreenCanvasOperation = async (
  width: number,
  height: number,
  action: (ctx: OffscreenCanvasRenderingContext2D) => void
): Promise<OffscreenCanvas> => {
  const c = new OffscreenCanvas(width,height);
  let ctx = c.getContext('2d')!;
  action(ctx);
  return c;
};

const apply = async (op: PureRasterOperation, inputs: OffscreenCanvas[]): Promise<OffscreenCanvas[]> => {
  const opType = op.type;
  switch(opType){
    case 'noop': 
      return inputs;
    case 'multiply': 
      return Array(op.n).fill(inputs).flatMap(inputs => inputs);
    case 'threshold': 
      return Promise.all(inputs.map(input =>
        offscreenCanvasOperation(input.width, input.height,(ctx) => {
          ctx.drawImage(input,0,0);
          const imgData = ctx.getImageData(0,0,input.width,input.height);
          for (var i=0; i<imgData.data.length; i+=4) { // 4 is for RGBA channels
            var currentPixelValue = rgbaValue(
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
    case 'wrap': 
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
    case 'stack': 
      if(op.dimension === 'x'){
        return [await offscreenCanvasOperation(
          inputs.map(i => i.width).reduce((a,b) => a + b, 0),
          Math.max(...inputs.map(i => i.height)),
          (ctx) => {
            for(let input of inputs){
              ctx.drawImage(input,0,0);
              ctx.translate(input.width,0);
            }
          })
        ];
      }
      return [await offscreenCanvasOperation(
        Math.max(...inputs.map(i => i.width)),
        inputs.map(i => i.height).reduce((a,b) => a + b, 0),
        (ctx) => {
          for(let stackInput of inputs){
            ctx.drawImage(stackInput,0,0);
            ctx.translate(0,stackInput.height);
          }
        })
      ];
    default:
      throw new Error(`Unexpected operation type: ${opType}`);
  }
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
    case 'noop'      : return "noop";
    case 'multiply'  : return `multiply(${op.n})`;
    case 'threshold' : return `threshold(${op.value})`;
    case 'grayscale' : return `grayscale(${op.percent}%)`;
    case 'rotateHue' : return `rotateHue(${op.degrees}deg)`;
    case 'blur'      : return `blur(${op.pixels}px)`;
    case 'invert'    : return "invert";
    case 'wrap'      : return `wrap(${op.dimension},${op.amount}%)`;
    case 'scaleToFit': return `scaleToFit(${op.w},${op.h})`;
    case 'scale'     : return `scale(${op.x},${op.y})`;
    case 'stack'     : return `scale(${op.dimension})`;
    default:
      throw new Error(`Unexpected operation type: ${opType}`);
  }
}

export const PureRasterOperations = {apply, stringRepresentation};