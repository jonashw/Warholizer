import { PureRasterOperation, PureRasterOperations } from "./PureRasterOperation"

export type PureRasterApplicatorType = "flatMap" | "zip" | "pipe";
const types: PureRasterApplicatorType[] = ["zip", "flatMap", "pipe"];
export type PureRasterApplicator = {
    type: PureRasterApplicatorType,
    ops: PureRasterOperation[]
}
export type PureRasterOperationRecord = PureRasterOperation & {id:string};
export type PureRasterApplicatorRecord = {
  id: string,
  type: PureRasterApplicatorType,
  ops: PureRasterOperationRecord[]
};

export const applicatorAsRecord = (app: PureRasterApplicator): PureRasterApplicatorRecord => 
  ({
      id: crypto.randomUUID(),
      type: app.type,
      ops: app.ops.map(operationAsRecord)
  });

export const operationAsRecord = (op: PureRasterOperation): PureRasterOperationRecord => 
  ({...op, id: crypto.randomUUID()});

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


const applyAll = (applicators: PureRasterApplicator[], inputs: OffscreenCanvas[]) =>
  applicators.reduce(
      async (oscs,applicator) => 
          applicator.ops.length > 0 
          ? PureRasterApplicators.apply(applicator, await oscs)
          : oscs,
      Promise.resolve(inputs));

export const PureRasterApplicators = {apply,types,applyAll};