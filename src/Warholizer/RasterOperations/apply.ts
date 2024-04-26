import { RasterOperation/*, RasterOperationDocument*/ } from "./RasterOperation";
import { Filter } from "./Filter";
import { PureRasterOperation } from "./PureRasterOperation";

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
    case 'invert': 
      return Promise.all(inputs.map(input =>
        offscreenCanvasOperation(input.width, input.height,(ctx) => {
          ctx.filter="invert()";
          ctx.drawImage(input,0,0);
        })));
    case 'wrap': 
      return Promise.all(inputs.map(input =>
        offscreenCanvasOperation(input.width, input.height,(ctx) => {
          const wrapCoefficient = Math.max(0,Math.min(1,op.amount));
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