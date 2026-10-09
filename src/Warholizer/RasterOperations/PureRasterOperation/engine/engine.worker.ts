/// <reference lib="webworker" />
import { apply, createApply } from "../apply";
import { createWebglKernels } from "../gpu/webglKernels";
import { ApplyRequest, ApplyResponse, WireImage, WireOutput, WorkerKernels, fromWireImage, toWireImage, transferablesOf } from "./protocol";

declare const self: DedicatedWorkerGlobalScope;

// Each worker owns its own WebGL2 context (OffscreenCanvas supports WebGL2 in workers), created on
// first GPU request, so GPU work, its readback waits, and composition all stay off the main thread.
let gpuApply: typeof apply | undefined;
const applierFor = (kernels: WorkerKernels): typeof apply => {
  if (kernels === 'cpu') {
    return apply;
  }
  if (!gpuApply) {
    const webgl = createWebglKernels();
    gpuApply = webgl ? createApply(webgl) : apply;
  }
  return gpuApply;
};

self.onmessage = async (e: MessageEvent<ApplyRequest>) => {
  const { id, op, inputs, kernels } = e.data;
  try {
    const inputCanvases = inputs.map(fromWireImage);
    const outputCanvases = await applierFor(kernels)(op, inputCanvases);

    const images: WireImage[] = [];
    const imageIndexByCanvas = new Map<OffscreenCanvas, number>();
    const outputs: WireOutput[] = [];
    for (const c of outputCanvases) {
      const inputIndex = inputCanvases.indexOf(c);
      if (inputIndex >= 0) {
        outputs.push({ kind: 'input', index: inputIndex });
        continue;
      }
      let index = imageIndexByCanvas.get(c);
      if (index === undefined) {
        index = images.length;
        imageIndexByCanvas.set(c, index);
        images.push(await toWireImage(c));
      }
      outputs.push({ kind: 'image', index });
    }
    const response: ApplyResponse = { id, ok: true, outputs, images };
    self.postMessage(response, transferablesOf(images));
  } catch (err) {
    const response: ApplyResponse = { id, ok: false, error: err instanceof Error ? err.message : String(err) };
    self.postMessage(response);
  }
};
