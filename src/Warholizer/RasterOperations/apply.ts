import { RasterOperation/*, RasterOperationDocument*/ } from "./RasterOperation";
import { Filter } from "./Filter";
import { PureRasterOperation } from "./PureRasterOperation";
import { PureRasterApplicator } from "./PureRasterApplicator";

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

export const apply = async (op: RasterOperation, input: OffscreenCanvas): Promise<OffscreenCanvas> => {
  const opType = op.type;
  switch(opType){
    case 'wrap': return offscreenCanvasOperation(input.width, input.height,(ctx) => {
      const wrapCoefficient = Math.max(0,Math.min(1,op.amount));
      if(op.dimension === 'x'){
        const x = input.width * wrapCoefficient;
        const xx = input.width - x;
        ctx.drawImage(input,-x,0);
        ctx.drawImage(input,xx,0);
      }
      if(op.dimension === 'y'){
        const y = input.height * wrapCoefficient;
        const yy = input.height - y;
        ctx.drawImage(input,0,y);
        ctx.drawImage(input,0,yy);
      }
    });
    
    case 'scale':
      const scaleInput = await apply(op.input, input);
      const scaleWidth = Math.abs(op.x) * scaleInput.width;
      const scaleHeight = Math.abs(op.y) * scaleInput.height;
      return offscreenCanvasOperation(scaleWidth, scaleHeight, (ctx) => {
        if(op.x < 0){
          ctx.translate(scaleWidth,0);
        }
        if(op.y < 0){
          ctx.translate(0,scaleHeight);
        }
        ctx.scale(op.x, op.y);
        ctx.drawImage(scaleInput,0,0);
      });
    case 'stack': 
      const stackInputs = await Promise.all(op.inputs.map(op => apply(op,input)));
      if(op.dimension === 'x'){
        return offscreenCanvasOperation(
          stackInputs.map(i => i.width).reduce((a,b) => a + b, 0),
          Math.max(...stackInputs.map(i => i.height)),
          (ctx) => {
            for(let stackInput of stackInputs){
              ctx.drawImage(stackInput,0,0);
              ctx.translate(stackInput.width,0);
            }
          });
      }
      return offscreenCanvasOperation(
        Math.max(...stackInputs.map(i => i.width)),
        stackInputs.map(i => i.height).reduce((a,b) => a + b, 0),
        (ctx) => {
          for(let stackInput of stackInputs){
            ctx.drawImage(stackInput,0,0);
            ctx.translate(0,stackInput.height);
          }
        });
    case 'originalImage': 
      return input; 
    default:
      throw new Error(`Unexpected operation type: ${opType}`);
  }
};

export const applyFlat = async (filterById: {[id: string]: Filter}, filterId: string, inputs: OffscreenCanvas[]): Promise<OffscreenCanvas[]> => {
  const filter = filterById[filterId];
  if(!filter){
    return Promise.resolve(inputs);
  }
  return applyPureOperation(filter.operation, inputs);
};

export const applyPureOperations = (ops: PureRasterOperation[], inputs: OffscreenCanvas[]): Promise<OffscreenCanvas[]> => 
  Promise.all(ops.map(op => applyPureOperation(op,inputs)))
  .then(groups => groups.flatMap(g => g));

export const applyPureOperationPipeline = async (ops: PureRasterOperation[], inputs: OffscreenCanvas[]): Promise<OffscreenCanvas[]> => {
  var intermediates = inputs; 
  for(let op of ops){
    intermediates = await applyPureOperation(op, intermediates)
  }
  return intermediates;
};

export const applyPureOperation = async (op: PureRasterOperation, inputs: OffscreenCanvas[]): Promise<OffscreenCanvas[]> => {
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

export const applyApplicator = (app: PureRasterApplicator, imgs: OffscreenCanvas[]): Promise<OffscreenCanvas[]> => {
    switch(app.type){
        case 'flatMap':
          return Promise.all(app.ops.map(op =>
            applyPureOperation(op, imgs)))
            .then(groups => groups.flatMap(g => g));
        case 'zip':
          const n = Math.min(app.ops.length,imgs.length);
          const zipped = Promise.all(Array(n).fill(undefined).flatMap((_,i) => 
            applyPureOperation(app.ops[i], [imgs[i]])
          )).then(groups => groups.flatMap(g => g));
          return zipped;
        default:
          throw new Error(`Unexpected applicator type: ${app.type}`);
    }
};

function rgbaValue(r: number, g: number, b: number, a: number) {
  //reference: https://computergraphics.stackexchange.com/a/5114
  //const [rPeakWavelength,gPeakWavelength,bPeakWavelength]=[600,540,450];
  const [rCoeff,gCoeff,bCoeff]=[0.21,0.72,0.07];
  return Math.floor((a/255) * ((r * rCoeff) + (g * gCoeff) + (b * bCoeff)));
}