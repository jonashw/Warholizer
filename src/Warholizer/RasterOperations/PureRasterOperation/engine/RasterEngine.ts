import { PureRasterOperation } from "../types";

/**
 * Executes one raster operation. Every editing model (applicators, graphs, galleries) composes
 * operations through this interface, so swapping the engine (main thread, workers, GPU) is local.
 */
export type RasterEngine = {
  name: string,
  apply: (op: PureRasterOperation, inputs: OffscreenCanvas[]) => Promise<OffscreenCanvas[]>
};
