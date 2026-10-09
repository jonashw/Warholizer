import { apply } from "../Warholizer/RasterOperations/PureRasterOperation/engine";
import { ImageOps } from "./evaluate";
import { PagePlan, PlacedImage, scalePlan } from "./layoutPlan";

const labelFont = (size: number) => `600 ${size}px system-ui, sans-serif`;

const alignOffset = (align: PlacedImage['align'], space: number) =>
  align === 'start' ? 0 : align === 'center' ? space / 2 : space;

/** Draws one image into its cell: contained (whole image), covered (cropped) or filled. */
const drawPlaced = (ctx: OffscreenCanvasRenderingContext2D, image: OffscreenCanvas, p: PlacedImage) => {
  if (image.width === 0 || image.height === 0 || p.w <= 0 || p.h <= 0) return;
  let { x, y, w, h } = p;
  let [sx, sy, sw, sh] = [0, 0, image.width, image.height];
  if (p.fit === 'contain') {
    const s = Math.min(p.w / image.width, p.h / image.height);
    w = image.width * s; h = image.height * s;
    x += alignOffset(p.align, p.w - w); y += alignOffset(p.align, p.h - h);
  } else if (p.fit === 'cover') {
    const s = Math.max(p.w / image.width, p.h / image.height);
    sw = p.w / s; sh = p.h / s;
    sx = alignOffset(p.align, image.width - sw); sy = alignOffset(p.align, image.height - sh);
  }
  ctx.save();
  ctx.translate(x + (p.flipX ? w : 0), y + (p.flipY ? h : 0));
  ctx.scale(p.flipX ? -1 : 1, p.flipY ? -1 : 1);
  ctx.drawImage(image, sx, sy, sw, sh, 0, 0, w, h);
  ctx.restore();
};

/**
 * The largest canvas to allocate, in pixels. Phones run out of memory long before their browsers'
 * nominal limits (iPhone Safari refuses canvases over about 16.7 megapixels; Android Chrome tabs
 * are killed when memory runs out), so phones stay at 16 megapixels; desktops allow far more.
 */
export const canvasAreaLimit = (): number => {
  if (typeof navigator === 'undefined') return 120_000_000;
  const phone = /Android|iPhone|iPad|iPod/.test(navigator.userAgent)
    || (navigator.maxTouchPoints > 0 && typeof window !== 'undefined' && Math.min(window.screen.width, window.screen.height) < 900);
  return phone ? 16_000_000 : 120_000_000;
};

/** Draws a planned layout page, smaller if it would exceed the device's canvas limit. */
export const drawPlan = (unlimited: PagePlan, images: OffscreenCanvas[]): OffscreenCanvas => {
  const limit = canvasAreaLimit();
  const area = unlimited.width * unlimited.height;
  const plan = area > limit ? scalePlan(unlimited, Math.sqrt(limit / area)) : unlimited;
  const canvas = new OffscreenCanvas(Math.max(1, Math.round(plan.width)), Math.max(1, Math.round(plan.height)));
  const ctx = canvas.getContext('2d')!;
  if (plan.background === 'white') {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
  ctx.save();
  if (plan.clip) {
    ctx.beginPath();
    ctx.rect(plan.clip.x, plan.clip.y, plan.clip.w, plan.clip.h);
    ctx.clip();
  }
  plan.images.forEach(p => { const image = images[p.index]; if (image) drawPlaced(ctx, image, p); });
  ctx.restore();
  ctx.fillStyle = '#111318';
  ctx.textBaseline = 'middle';
  plan.texts.forEach(t => {
    ctx.font = labelFont(t.size);
    ctx.textAlign = t.align;
    ctx.fillText(t.text, t.x, t.y);
  });
  return canvas;
};

/** Each pixel's mean or median across images drawn at the first image's size. */
export const averageImages = (images: OffscreenCanvas[], kind: 'mean' | 'median'): OffscreenCanvas => {
  const { width, height } = images[0];
  const data = images.map(image => {
    const c = new OffscreenCanvas(width, height);
    const ctx = c.getContext('2d')!;
    ctx.drawImage(image, 0, 0, width, height);
    return ctx.getImageData(0, 0, width, height).data;
  });
  const out = new OffscreenCanvas(width, height);
  const ctx = out.getContext('2d')!;
  const result = ctx.createImageData(width, height);
  const n = data.length;
  const values = new Float64Array(n);
  for (let i = 0; i < result.data.length; i++) {
    if (kind === 'mean') {
      let sum = 0;
      for (let k = 0; k < n; k++) sum += data[k][i];
      result.data[i] = sum / n;
    } else {
      for (let k = 0; k < n; k++) values[k] = data[k][i];
      values.sort();
      result.data[i] = n % 2 ? values[(n - 1) / 2] : (values[n / 2 - 1] + values[n / 2]) / 2;
    }
  }
  ctx.putImageData(result, 0, 0);
  return out;
};

/** Frames of one size (the largest), each image contained and centered on white. */
export const framesOf = (images: OffscreenCanvas[]): OffscreenCanvas[] => {
  const width = Math.max(...images.map(i => i.width));
  const height = Math.max(...images.map(i => i.height));
  return images.map(image => {
    const c = new OffscreenCanvas(width, height);
    const ctx = c.getContext('2d')!;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);
    const s = Math.min(width / image.width, height / image.height);
    ctx.drawImage(image, (width - image.width * s) / 2, (height - image.height * s) / 2, image.width * s, image.height * s);
    return c;
  });
};

/** Image operations on canvases, through the raster engine. */
export const canvasOps: ImageOps<OffscreenCanvas> = {
  apply,
  size: image => [image.width, image.height],
  compose: async (plan, images) => drawPlan(plan, images),
  average: async (images, kind) => averageImages(images, kind),
  frames: async images => framesOf(images),
};
