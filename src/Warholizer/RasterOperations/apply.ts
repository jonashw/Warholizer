import { RasterOperation } from "./RasterOperation";

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
        if(op.dimension === 'x'){
          ctx.drawImage(input,-input.width/2,0);
          ctx.drawImage(input,input.width/2,0);
        }
        if(op.dimension === 'y'){
          ctx.drawImage(input,0,-input.height/2);
          ctx.drawImage(input,0,input.height/2);
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