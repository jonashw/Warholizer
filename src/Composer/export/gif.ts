import { applyPalette, GIFEncoder, quantize } from 'gifenc';

/** The frames in playing order: forward, or forward then back without repeating the ends. */
export const playOrder = <T,>(frames: T[], bounce: boolean): T[] =>
  bounce && frames.length > 2 ? [...frames, ...frames.slice(1, -1).reverse()] : frames;

/** An animated GIF that loops forever, each frame quantized to its own 256-color palette. */
export const gifOf = (frames: OffscreenCanvas[], frameMs: number, bounce: boolean): Blob => {
  const gif = GIFEncoder();
  for (const frame of playOrder(frames, bounce)) {
    const { data } = frame.getContext('2d')!.getImageData(0, 0, frame.width, frame.height);
    const palette = quantize(data, 256);
    gif.writeFrame(applyPalette(data, palette), frame.width, frame.height, { palette, delay: frameMs, repeat: 0 });
  }
  gif.finish();
  return new Blob([gif.bytes() as BlobPart], { type: 'image/gif' });
};
