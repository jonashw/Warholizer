import { PureRasterOperation } from "../types";

// Messages between the main thread and engine workers.
// Images cross the boundary as transferable ImageBitmaps (zero-copy transfer).

/** An image sent to or from a worker. Zero-area images cannot be ImageBitmaps, so only their size is sent. */
export type WireImage =
  | { kind: 'bitmap', bitmap: ImageBitmap }
  | { kind: 'empty', width: number, height: number };

export type ApplyRequest = {
  id: number,
  op: PureRasterOperation,
  inputs: WireImage[]
};

/**
 * Each output is either one of the request's inputs passed through unchanged (by index),
 * so the main thread can return the original canvas object, or a new image (by index into `images`).
 * Repeated outputs (e.g. `multiply`) refer to the same index, preserving identity.
 */
export type WireOutput =
  | { kind: 'input', index: number }
  | { kind: 'image', index: number };

export type ApplyResponse =
  | { id: number, ok: true, outputs: WireOutput[], images: WireImage[] }
  | { id: number, ok: false, error: string };

export const transferablesOf = (images: WireImage[]): Transferable[] =>
  images.flatMap(i => i.kind === 'bitmap' ? [i.bitmap] : []);

export const toWireImage = async (c: OffscreenCanvas): Promise<WireImage> =>
  c.width === 0 || c.height === 0
  ? { kind: 'empty', width: c.width, height: c.height }
  : { kind: 'bitmap', bitmap: await createImageBitmap(c) };

/** Draws a received image into a new 2D canvas and releases the bitmap. */
export const fromWireImage = (w: WireImage): OffscreenCanvas => {
  if (w.kind === 'empty') {
    return new OffscreenCanvas(w.width, w.height);
  }
  const c = new OffscreenCanvas(w.bitmap.width, w.bitmap.height);
  c.getContext('2d')!.drawImage(w.bitmap, 0, 0);
  w.bitmap.close();
  return c;
};
