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

/** How a group applies its applicators: to each input image separately, or to all inputs together. */
export type GroupMode = 'each' | 'all';

/**
 * A group of applicators, one level deep (groups never contain groups). In `each` mode the
 * group's pipeline runs on every input image separately and the outputs are concatenated in
 * input order: e.g. one grid per photo.
 */
export type PureRasterApplicatorGroup = {
  type: 'group',
  mode: GroupMode,
  enabled: boolean,
  applicators: PureRasterApplicator[]
};

export type PureRasterApplicatorGroupRecord = {
  type: 'group',
  id: string,
  mode: GroupMode,
  enabled: boolean,
  applicators: PureRasterApplicatorRecord[]
};

/** A top-level step of an arrangement: an applicator or a group of applicators. */
export type ArrangementStep = PureRasterApplicatorRecord | PureRasterApplicatorGroupRecord;
export type ArrangementStepTemplate = PureRasterApplicator | PureRasterApplicatorGroup;

/** Everything the Pure Editor arranges. */
export type Arrangement = { steps: ArrangementStep[] };

export const isGroup = (step: ArrangementStep | ArrangementStepTemplate): step is PureRasterApplicatorGroupRecord | PureRasterApplicatorGroup =>
  step.type === 'group';

export const stepAsRecord = (step: ArrangementStepTemplate): ArrangementStep =>
  isGroup(step)
  ? { type: 'group', id: crypto.randomUUID(), mode: step.mode, enabled: step.enabled, applicators: step.applicators.map(applicatorAsRecord) }
  : applicatorAsRecord(step);

/** Every applicator in the arrangement, inside groups included. */
export const allApplicators = (steps: ArrangementStep[]): PureRasterApplicatorRecord[] =>
  steps.flatMap(step => isGroup(step) ? step.applicators : [step]);

/** Replaces the applicator with the given id, wherever it is. */
export const updateApplicator = (steps: ArrangementStep[], id: string, update: (a: PureRasterApplicatorRecord) => PureRasterApplicatorRecord): ArrangementStep[] =>
  steps.map(step => isGroup(step)
    ? { ...step, applicators: step.applicators.map(a => a.id === id ? update(a) : a) }
    : step.id === id ? update(step) : step);

const applyGroup = async (group: PureRasterApplicatorGroup, inputs: OffscreenCanvas[]): Promise<OffscreenCanvas[]> =>
  !group.enabled
  ? inputs
  : group.mode === 'all'
  ? applyAll(group.applicators, inputs)
  : (await Promise.all(inputs.map(input => applyAll(group.applicators, [input])))).flat();

const applyStep = (step: ArrangementStep | ArrangementStepTemplate, inputs: OffscreenCanvas[]): Promise<OffscreenCanvas[]> =>
  isGroup(step) ? applyGroup(step, inputs) : applyAll([step], inputs);

const applyArrangement = (steps: (ArrangementStep | ArrangementStepTemplate)[], inputs: OffscreenCanvas[]): Promise<OffscreenCanvas[]> =>
  steps.reduce(async (prev, step) => applyStep(step, await prev), Promise.resolve(inputs));

/** What flowed into and out of one applicator, for previews and visual editors. */
export type ApplicatorIteration = { applicator: PureRasterApplicatorRecord, inputs: OffscreenCanvas[], outputs: OffscreenCanvas[] };

/** What flowed into and out of one step; groups also report their applicators (concatenated across images in `each` mode). */
export type StepIteration = {
  step: ArrangementStep,
  inputs: OffscreenCanvas[],
  outputs: OffscreenCanvas[],
  children?: ApplicatorIteration[]
};

const toChildIterations = (applicators: PureRasterApplicatorRecord[], runs: IterativeApplication[][]): ApplicatorIteration[] =>
  applicators.map((applicator, i) => ({
    applicator,
    inputs: runs.flatMap(run => run[i]?.inputs ?? []),
    outputs: runs.flatMap(run => run[i]?.outputs ?? []),
  }));

const applyArrangementIteratively = async (arrangement: Arrangement, inputs: OffscreenCanvas[]): Promise<StepIteration[]> => {
  const iterations: StepIteration[] = [];
  let current = inputs;
  for (const step of arrangement.steps) {
    if (!isGroup(step)) {
      const outputs = await applyAll([step], current);
      iterations.push({ step, inputs: current, outputs });
      current = outputs;
      continue;
    }
    const runs = !step.enabled
      ? []
      : step.mode === 'all'
      ? [await applyAllIteratively(step.applicators, current)]
      : await Promise.all(current.map(input => applyAllIteratively(step.applicators, [input])));
    const children = step.enabled
      ? toChildIterations(step.applicators, runs)
      : step.applicators.map(applicator => ({ applicator, inputs: current, outputs: current }));
    const outputs = step.enabled ? await applyGroup(step, current) : current;
    iterations.push({ step, inputs: current, outputs, children });
    current = outputs;
  }
  return iterations;
};

export const PureRasterApplicators = {apply,types,applyAll,applyAllIteratively,map,inputsForOp,applyArrangement,applyArrangementIteratively};