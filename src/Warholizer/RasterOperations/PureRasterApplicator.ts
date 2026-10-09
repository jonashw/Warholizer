import { PureRasterOperation} from "./PureRasterOperation/"
import * as PureRasterOperations from "./PureRasterOperation/";

export type PureRasterApplicatorType = "flatMap" | "zip" | "pipe";
const types: PureRasterApplicatorType[] = ["zip", "flatMap", "pipe"];
export type PureRasterApplicator = {
    type: PureRasterApplicatorType,
    ops: PureRasterOperation[],
    enabled: boolean
}

//TODO: use Record<T> instead of specific Record types
//export type Record<T> = T & {id:'string'};
//export function asRecord<T>(value: T) { return {...value, id: crypto.randomUUID()}; }
export type PureRasterOperationRecord = PureRasterOperation & {id:string};
export type PureRasterApplicatorRecord = {
  id: string,
  type: PureRasterApplicatorType,
  ops: PureRasterOperationRecord[],
  enabled: boolean
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
      ops: app.ops.map(operationAsRecord),
      enabled: true
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
  !app.enabled
  ? Promise.resolve(inputs)
  : map(
    PureRasterOperations.apply,
    app,
    inputs);

const applyAll = (applicators: PureRasterApplicator[], inputs: OffscreenCanvas[]) =>
  applicators
  .filter(a => a.enabled)
  .reduce(
      async (oscs,applicator) => 
          applicator.ops.length > 0 
          ? apply(applicator, await oscs)
          : oscs,
      Promise.resolve(inputs));


export type IterativeApplication = {
  inputs: OffscreenCanvas[];
  applied: PureRasterApplicatorRecord[];
  outputs: OffscreenCanvas[];
};

const applyAllIteratively = (applicators: PureRasterApplicatorRecord[], inputs: OffscreenCanvas[]): Promise<IterativeApplication[]> => 
  applicators.reduce(
    async (iterations$, applicator) => {
      const iterations = await iterations$;
      const last = iterations[iterations.length - 1];
      const nextInputs = last.outputs;
      return PureRasterApplicators.apply(applicator, nextInputs).then(outputs => 
        [
          ...iterations,
          {
            inputs: nextInputs,
            outputs,
            applied: [...last.applied, applicator]
          }
        ]);
    },
    Promise.resolve([{ inputs, applied: [], outputs: inputs } as IterativeApplication]))
  .then(apps => apps.slice(1)); //exclude seed

/**
 * The images that flow into `app.ops[index]` when `app` is applied to `inputs`: for `pipe`, the
 * outputs of the preceding ops; for `flatMap`, the applicator's inputs; for `zip`, the matching input.
 */
const inputsForOp = async (app: PureRasterApplicator, index: number, inputs: OffscreenCanvas[]): Promise<OffscreenCanvas[]> => {
  switch (app.type) {
    case 'pipe':
      return app.ops.slice(0, index).reduce(
        async (prev, op) => PureRasterOperations.apply(op, await prev),
        Promise.resolve(inputs));
    case 'flatMap':
      return inputs;
    case 'zip':
      return inputs[index] ? [inputs[index]] : [];
    default:
      throw new Error(`Unexpected applicator type: ${app.type}`);
  }
};

/**
 * Everything the Pure Editor arranges: the applicators, and whether to run them on each input
 * image separately (outputs concatenated in input order) or on all inputs together.
 */
export type Arrangement = {
  applicators: PureRasterApplicatorRecord[],
  perInput: boolean
};

const applyArrangement = async ({ applicators, perInput }: Arrangement, inputs: OffscreenCanvas[]): Promise<OffscreenCanvas[]> =>
  !perInput
  ? applyAll(applicators, inputs)
  : (await Promise.all(inputs.map(input => applyAll(applicators, [input])))).flat();

/** Like applyAllIteratively; per input, each step's inputs and outputs are concatenated across inputs. */
const applyArrangementIteratively = async ({ applicators, perInput }: Arrangement, inputs: OffscreenCanvas[]): Promise<IterativeApplication[]> => {
  if (!perInput) {
    return applyAllIteratively(applicators, inputs);
  }
  const perImage = await Promise.all(inputs.map(input => applyAllIteratively(applicators, [input])));
  return applicators.map((_, step) => ({
    applied: perImage[0]?.[step]?.applied ?? applicators.slice(0, step + 1),
    inputs: perImage.flatMap(iterations => iterations[step].inputs),
    outputs: perImage.flatMap(iterations => iterations[step].outputs),
  }));
};

export const PureRasterApplicators = {apply,types,applyAll,applyAllIteratively,map,inputsForOp,applyArrangement,applyArrangementIteratively};