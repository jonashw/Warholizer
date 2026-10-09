import { apply } from "../Warholizer/RasterOperations/PureRasterOperation/engine";
import { ImageOps } from "./evaluate";

const labelFont = (size: number) => `600 ${size}px system-ui, sans-serif`;

/** Draws a labeled grid of images; each cell is sized to the largest image. */
export const drawCrosstab = (
  grid: (OffscreenCanvas | undefined)[][],
  rowLabels: string[],
  columnLabels: string[],
  labels: boolean,
): OffscreenCanvas => {
  const images = grid.flat().filter((c): c is OffscreenCanvas => c !== undefined);
  const cellWidth = Math.max(1, ...images.map(c => c.width));
  const cellHeight = Math.max(1, ...images.map(c => c.height));
  const columns = Math.max(1, ...grid.map(r => r.length));
  const fontSize = Math.max(12, Math.round(Math.min(cellWidth, cellHeight) * 0.08));
  const gap = Math.max(2, Math.round(fontSize / 4));
  const left = labels ? Math.ceil(fontSize * Math.max(2, ...rowLabels.map(l => l.length)) * 0.62) + gap * 2 : 0;
  const top = labels ? fontSize + gap * 3 : 0;
  const canvas = new OffscreenCanvas(
    left + columns * cellWidth + (columns - 1) * gap,
    top + grid.length * cellHeight + (grid.length - 1) * gap);
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  if (labels) {
    ctx.fillStyle = '#111318';
    ctx.font = labelFont(fontSize);
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'center';
    columnLabels.forEach((label, c) => ctx.fillText(label, left + c * (cellWidth + gap) + cellWidth / 2, top / 2));
    ctx.textAlign = 'right';
    rowLabels.forEach((label, r) => ctx.fillText(label, left - gap * 2, top + r * (cellHeight + gap) + cellHeight / 2));
  }
  grid.forEach((row, r) => row.forEach((image, c) => {
    if (image) {
      const x = left + c * (cellWidth + gap) + (cellWidth - image.width) / 2;
      const y = top + r * (cellHeight + gap) + (cellHeight - image.height) / 2;
      ctx.drawImage(image, x, y);
    }
  }));
  return canvas;
};

/** Image operations on canvases, through the raster engine. */
export const canvasOps: ImageOps<OffscreenCanvas> = {
  apply,
  crosstab: async (grid, rowLabels, columnLabels, labels) => drawCrosstab(grid, rowLabels, columnLabels, labels),
};
