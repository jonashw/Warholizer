/// <reference lib="webworker" />
import { apply } from "../apply";
import { ApplyRequest, ApplyResponse, WireImage, WireOutput, fromWireImage, toWireImage, transferablesOf } from "./protocol";

declare const self: DedicatedWorkerGlobalScope;

self.onmessage = async (e: MessageEvent<ApplyRequest>) => {
  const { id, op, inputs } = e.data;
  try {
    const inputCanvases = inputs.map(fromWireImage);
    const outputCanvases = await apply(op, inputCanvases);

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
