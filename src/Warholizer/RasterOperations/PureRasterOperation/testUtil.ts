// Helpers for building small, known canvases and reading pixels back in tests.

export type RGBA = [number, number, number, number];

export const RED: RGBA = [255, 0, 0, 255];
export const GREEN: RGBA = [0, 255, 0, 255];
export const BLUE: RGBA = [0, 0, 255, 255];
export const BLACK: RGBA = [0, 0, 0, 255];
export const WHITE: RGBA = [255, 255, 255, 255];

const css = ([r, g, b, a]: RGBA) => `rgba(${r},${g},${b},${a / 255})`;

export const solid = (width: number, height: number, color: RGBA): OffscreenCanvas => {
  const c = new OffscreenCanvas(width, height);
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = css(color);
  ctx.fillRect(0, 0, width, height);
  return c;
};

/** Canvas split into equal vertical bands, one per color, left to right. */
export const bands = (width: number, height: number, colors: RGBA[]): OffscreenCanvas => {
  const c = new OffscreenCanvas(width, height);
  const ctx = c.getContext('2d')!;
  const bandWidth = width / colors.length;
  colors.forEach((color, i) => {
    ctx.fillStyle = css(color);
    ctx.fillRect(i * bandWidth, 0, bandWidth, height);
  });
  return c;
};

/** Canvas split into equal horizontal bands, one per color, top to bottom. */
export const rows = (width: number, height: number, colors: RGBA[]): OffscreenCanvas => {
  const c = new OffscreenCanvas(width, height);
  const ctx = c.getContext('2d')!;
  const bandHeight = height / colors.length;
  colors.forEach((color, i) => {
    ctx.fillStyle = css(color);
    ctx.fillRect(0, i * bandHeight, width, bandHeight);
  });
  return c;
};

export const pixel = (c: OffscreenCanvas, x: number, y: number): RGBA => {
  const d = c.getContext('2d')!.getImageData(x, y, 1, 1).data;
  return [d[0], d[1], d[2], d[3]];
};

export const allPixels = (c: OffscreenCanvas): RGBA[] => {
  const d = c.getContext('2d')!.getImageData(0, 0, c.width, c.height).data;
  const out: RGBA[] = [];
  for (let i = 0; i < d.length; i += 4) {
    out.push([d[i], d[i + 1], d[i + 2], d[i + 3]]);
  }
  return out;
};

export const size = (c: OffscreenCanvas) => [c.width, c.height];

/** Max per-channel difference between two colors. */
export const colorDistance = (a: RGBA, b: RGBA) =>
  Math.max(...a.map((v, i) => Math.abs(v - b[i])));
