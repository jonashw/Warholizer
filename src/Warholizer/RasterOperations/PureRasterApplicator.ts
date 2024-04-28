import { PureRasterOperation, PureRasterOperations } from "./PureRasterOperation"

export type PureRasterApplicatorType = "flatMap" | "zip" | "pipe";
const types: PureRasterApplicatorType[] = ["zip", "flatMap", "pipe"];
export type PureRasterApplicator = {
    type: PureRasterApplicatorType,
    ops: PureRasterOperation[]
}


const apply = (app: PureRasterApplicator, imgs: OffscreenCanvas[]): Promise<OffscreenCanvas[]> => {
    switch(app.type){
        case 'flatMap':
          return Promise.all(app.ops.map(op =>
            PureRasterOperations.apply(op, imgs)))
            .then(groups => groups.flatMap(g => g));
        case 'pipe':
          if(app.ops.length === 0){
            return Promise.resolve(imgs);
          }
          return app.ops.reduce(
            async (prevImgs,op) => PureRasterOperations.apply(op, await prevImgs),
            Promise.resolve(imgs));
        case 'zip':
          const n = Math.min(app.ops.length,imgs.length);
          const zipped = Promise.all(Array(n).fill(undefined).flatMap((_,i) => 
            PureRasterOperations.apply(app.ops[i], [imgs[i]])
          )).then(groups => groups.flatMap(g => g));
          return zipped;
        default:
          throw new Error(`Unexpected applicator type: ${app.type}`);
    }
};

export const PureRasterApplicators = {apply,types};