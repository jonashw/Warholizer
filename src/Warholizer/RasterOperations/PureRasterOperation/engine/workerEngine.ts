import { PureRasterOperation } from "../types";
import { RasterEngine } from "./RasterEngine";
import { ApplyRequest, ApplyResponse, WorkerKernels, fromWireImage, toWireImage, transferablesOf } from "./protocol";

type Pending = {
  worker: PooledWorker,
  inputs: OffscreenCanvas[],
  resolve: (outputs: OffscreenCanvas[]) => void,
  reject: (err: Error) => void
};

type PooledWorker = {
  worker: Worker,
  inFlight: number
};

export const defaultPoolSize = () =>
  Math.max(1, Math.min(4, (navigator.hardwareConcurrency ?? 2) - 1));

/**
 * Runs operations in a pool of module workers. Each request goes to the least busy worker,
 * so independent operations (e.g. a gallery of previews) run in parallel.
 */
export const createWorkerEngine = (
  poolSize = defaultPoolSize(),
  kernels: WorkerKernels = 'cpu'
): RasterEngine & { terminate: () => void } => {
  const pending = new Map<number, Pending>();
  let nextId = 0;
  const pool: PooledWorker[] = [];

  const spawn = (): PooledWorker => {
    const worker = new Worker(new URL('./engine.worker.ts', import.meta.url), { type: 'module' });
    const pooled: PooledWorker = { worker, inFlight: 0 };
    worker.onmessage = (e: MessageEvent<ApplyResponse>) => {
      const res = e.data;
      const p = pending.get(res.id);
      if (!p) {
        return;
      }
      pending.delete(res.id);
      pooled.inFlight--;
      if (!res.ok) {
        p.reject(new Error(res.error));
        return;
      }
      const images = res.images.map(fromWireImage);
      p.resolve(res.outputs.map(o => o.kind === 'input' ? p.inputs[o.index] : images[o.index]));
    };
    // A worker that fails to load or crashes would otherwise leave its requests pending forever.
    worker.onerror = (e: ErrorEvent) => {
      e.preventDefault();
      for (const [id, p] of pending) {
        if (p.worker === pooled) {
          pending.delete(id);
          p.reject(new Error(`Raster engine worker failed: ${e.message}`));
        }
      }
      pooled.inFlight = 0;
    };
    return pooled;
  };

  const leastBusy = (): PooledWorker => {
    if (pool.length < poolSize && pool.every(w => w.inFlight > 0)) {
      const w = spawn();
      pool.push(w);
      return w;
    }
    return pool.reduce((a, b) => b.inFlight < a.inFlight ? b : a);
  };

  const apply = async (op: PureRasterOperation, inputs: OffscreenCanvas[]): Promise<OffscreenCanvas[]> => {
    const wireInputs = await Promise.all(inputs.map(toWireImage));
    const id = nextId++;
    const target = leastBusy();
    target.inFlight++;
    return new Promise((resolve, reject) => {
      pending.set(id, { worker: target, inputs, resolve, reject });
      const request: ApplyRequest = { id, op, inputs: wireInputs, kernels };
      target.worker.postMessage(request, transferablesOf(wireInputs));
    });
  };

  const terminate = () => {
    pool.forEach(w => w.worker.terminate());
    pool.length = 0;
    pending.forEach(p => p.reject(new Error('Engine terminated')));
    pending.clear();
  };

  return { name: kernels === 'gpu' ? 'gpu workers' : 'worker', apply, terminate };
};
