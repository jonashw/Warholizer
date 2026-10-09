import { apply as applyOnMainThread } from "../apply";
import { PureRasterOperation } from "../types";
import { RasterEngine } from "./RasterEngine";
import { createWorkerEngine } from "./workerEngine";

export type { RasterEngine } from "./RasterEngine";
export { createWorkerEngine } from "./workerEngine";

export const mainThreadEngine: RasterEngine = { name: 'main thread', apply: applyOnMainThread };

const workersSupported = () =>
  typeof Worker !== 'undefined'
  && typeof OffscreenCanvas !== 'undefined'
  && typeof createImageBitmap !== 'undefined';

let current: RasterEngine | undefined;

/** The engine used by `apply`. Created lazily: workers when supported, otherwise the main thread. */
export const getEngine = (): RasterEngine => {
  if (!current) {
    current = workersSupported() ? createWorkerEngine() : mainThreadEngine;
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
