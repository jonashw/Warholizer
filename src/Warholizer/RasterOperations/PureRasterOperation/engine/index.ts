import { apply as applyOnMainThread } from "../apply";
import { PureRasterOperation } from "../types";
import { ExecutionHint, operationRegistry } from "../registry";
import { RasterEngine } from "./RasterEngine";
import { createWorkerEngine } from "./workerEngine";

export type { RasterEngine } from "./RasterEngine";
export { createWorkerEngine } from "./workerEngine";

export const mainThreadEngine: RasterEngine = { name: 'main thread', apply: applyOnMainThread };

const workersSupported = () =>
  typeof Worker !== 'undefined'
  && typeof OffscreenCanvas !== 'undefined'
  && typeof createImageBitmap !== 'undefined';

/** Sends each operation to the engine its registry entry's execution hint names. */
export const createRoutingEngine = (
  engines: Record<ExecutionHint, RasterEngine>,
  route: (op: PureRasterOperation) => ExecutionHint = op => operationRegistry[op.type].execution
): RasterEngine => ({
  name: 'routed',
  apply: (op, inputs) => engines[route(op)].apply(op, inputs),
});

let workerEngine: RasterEngine | undefined;

/** The shared worker pool, created on first use; the main thread where workers are unavailable. */
export const getWorkerEngine = (): RasterEngine => {
  if (!workerEngine) {
    workerEngine = workersSupported() ? createWorkerEngine() : mainThreadEngine;
  }
  return workerEngine;
};

let current: RasterEngine | undefined;

/**
 * The engine used by `apply`: per-pixel operations go to workers, operations the browser already
 * accelerates stay on the main thread (see the registry's execution hints).
 */
export const getEngine = (): RasterEngine => {
  if (!current) {
    current = createRoutingEngine({ main: mainThreadEngine, worker: getWorkerEngine() });
  }
  return current;
};

export const setEngine = (engine: RasterEngine) => {
  current = engine;
};

export const apply = (op: PureRasterOperation, inputs: OffscreenCanvas[]): Promise<OffscreenCanvas[]> =>
  getEngine().apply(op, inputs);

/** Applies each op to all inputs and concatenates the results. */
export const applyFlatMap = async (ops: PureRasterOperation[], inputs: OffscreenCanvas[]): Promise<OffscreenCanvas[]> =>
  (await Promise.all(ops.map(op => apply(op, inputs)))).flat();

/** Threads each input through the ops in sequence. */
export const applyPipeline = async (ops: PureRasterOperation[], inputs: OffscreenCanvas[]): Promise<OffscreenCanvas[]> =>
  (await Promise.all(inputs.map(input =>
    ops.reduce(async (oscs, op) => apply(op, await oscs), Promise.resolve([input]))
  ))).flat();
