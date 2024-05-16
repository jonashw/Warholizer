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

export type PureRasterTransformer = {
  applicators: PureRasterApplicator[]
}

export type PureRasterTransformerRecord = {
  id: string,
  applicators: PureRasterApplicatorRecord[]
}

export const transformerAsRecord = (t: PureRasterTransformer | PureRasterApplicator[]): PureRasterTransformerRecord => 
  ({
      id: crypto.randomUUID(),
      applicators: ('length' in t ? t : t.applicators).map(applicatorAsRecord)
  });

export const applicatorAsRecord = (app: PureRasterApplicator): PureRasterApplicatorRecord => 
  ({
      id: crypto.randomUUID(),
      type: app.type,
      ops: app.ops.map(operationAsRecord)
  });

export const operationAsRecord = (op: PureRasterOperation): PureRasterOperationRecord => 
  ({...op, id: crypto.randomUUID()});

const map = function<T>(
  fn: (op: PureRasterOperation, inputs: T[]) => Promise<T[]>,
  app: PureRasterApplicator,
  inputs: T[]
): Promise<T[]> {
  switch (app.type) {
    case 'flatMap':
      return Promise.all(app.ops.map(op =>
        fn(op, inputs)))
        .then(groups => groups.flatMap(g => g));
    case 'pipe':
      if (app.ops.length === 0) {
        return Promise.resolve(inputs);
      }
      return app.ops.reduce(
        async (prevInputs, op) => fn(op, await prevInputs),
        Promise.resolve(inputs));
    case 'zip': {
      const n = Math.min(app.ops.length, inputs.length);
      const zipped =
        Promise.all(
          [...Array(n).keys()]
            .flatMap(i => fn(app.ops[i], [inputs[i]]))
        ).then(groups => groups.flatMap(g => g));
      return zipped;
    }
    default:
      throw new Error(`Unexpected applicator type: ${app.type}`);
  }
}

const apply = (app: PureRasterApplicator, inputs: OffscreenCanvas[]): Promise<OffscreenCanvas[]> => 
  map(
    PureRasterOperations.apply,
    app,
    inputs);

const applyAll = (applicators: PureRasterApplicator[], inputs: OffscreenCanvas[]) =>
  applicators.reduce(
      async (oscs,applicator) => 
          applicator.ops.length > 0 
          ? PureRasterApplicators.apply(applicator, await oscs)
          : oscs,
      Promise.resolve(inputs));

export const PureRasterApplicators = {apply,types,applyAll,map};