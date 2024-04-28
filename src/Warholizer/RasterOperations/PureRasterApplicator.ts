import { PureRasterOperation, PureRasterOperations } from "./PureRasterOperation"

export type PureRasterApplicator = {
    type: "flatMap" | "zip",
    ops: PureRasterOperation[]
}

const apply = (app: PureRasterApplicator, imgs: OffscreenCanvas[]): Promise<OffscreenCanvas[]> => {
    switch(app.type){
        case 'flatMap':
          return Promise.all(app.ops.map(op =>
            PureRasterOperations.apply(op, imgs)))
            .then(groups => groups.flatMap(g => g));
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

export const PureRasterApplicators = {apply};