import { apply } from "../Warholizer/RasterOperations/PureRasterOperation/engine";
import { ImageOps } from "./evaluate";
import { PagePlan, PlacedImage } from "./layoutPlan";

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

/** Draws a planned layout page. */
export const drawPlan = (plan: PagePlan, images: OffscreenCanvas[]): OffscreenCanvas => {
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

/** Image operations on canvases, through the raster engine. */
export const canvasOps: ImageOps<OffscreenCanvas> = {
  apply,
  size: image => [image.width, image.height],
  compose: async (plan, images) => drawPlan(plan, images),
};
