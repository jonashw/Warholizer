import { defaultFormat } from "../formats";
import { Cell, Cube, ExportSettings, Format } from "../types";
import { buildPdf, PdfPage } from "./pdf";

export const defaultExportSettings: ExportSettings = { fileType: 'png', pdf: 'one-document', resolution: 'final' };

const slug = (s: string) => s.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'untitled';

/**
 * A result's address: the composition, then each dimension's name and member
 * (`warhol-duotone-grid / photo 2 / page 1`). Filenames flatten it.
 */
export const resultAddress = <Img>(name: string, cube: Cube<Img>, index: number): string[] => [
  slug(name),
  ...cube.dimensions.flatMap(d => {
    const key = cube.cells[index].coords[d.id];
    const label = d.members.find(m => m.key === key)?.label;
    return label === undefined ? [] : [slug(`${d.name} ${label}`)];
  }),
];

export const fileNameOf = (address: string[], extension: string) => `${address.join('_')}.${extension}`;

/** A result's physical size in points: its page format, or its pixels at the composition's DPI. */
export const pointsOf = (cell: Cell<OffscreenCanvas>, format: Format = defaultFormat): [number, number] => {
  const frame = cell.frame;
  if (frame) {
    const perInch = frame.unit === 'in' ? 1 : frame.unit === 'mm' ? 1 / 25.4 : 1 / frame.dpi;
    return [frame.width * perInch * 72, frame.height * perInch * 72];
  }
  return [cell.image.width / format.dpi * 72, cell.image.height / format.dpi * 72];
};

/** JPEG has no transparency: flatten onto white. */
const onWhite = (image: OffscreenCanvas) => {
  const c = new OffscreenCanvas(image.width, image.height);
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.drawImage(image, 0, 0);
  return c;
};

const jpegOf = async (image: OffscreenCanvas) =>
  new Uint8Array(await (await onWhite(image).convertToBlob({ type: 'image/jpeg', quality: 0.92 })).arrayBuffer());

export type ExportFile = { name: string, blob: Blob };

/** The files for some results of a cube, named by their addresses. */
export const exportFiles = async (
  name: string, cube: Cube<OffscreenCanvas>, indexes: number[], settings: ExportSettings, format: Format = defaultFormat,
): Promise<ExportFile[]> => {
  const page = async (i: number): Promise<PdfPage> => {
    const cell = cube.cells[i];
    const [widthPt, heightPt] = pointsOf(cell, format);
    return { jpeg: await jpegOf(cell.image), pixelWidth: cell.image.width, pixelHeight: cell.image.height, widthPt, heightPt };
  };
  const pdfBlob = (pages: PdfPage[]) => new Blob([buildPdf(pages) as BlobPart], { type: 'application/pdf' });
  switch (settings.fileType) {
    case 'pdf':
      if (settings.pdf === 'one-document') {
        return [{ name: `${slug(name)}.pdf`, blob: pdfBlob(await Promise.all(indexes.map(page))) }];
      }
      return Promise.all(indexes.map(async i => ({ name: fileNameOf(resultAddress(name, cube, i), 'pdf'), blob: pdfBlob([await page(i)]) })));
    case 'jpeg':
      return Promise.all(indexes.map(async i => ({
        name: fileNameOf(resultAddress(name, cube, i), 'jpg'),
        blob: await onWhite(cube.cells[i].image).convertToBlob({ type: 'image/jpeg', quality: 0.92 }),
      })));
    case 'png':
      return Promise.all(indexes.map(async i => ({
        name: fileNameOf(resultAddress(name, cube, i), 'png'),
        blob: await cube.cells[i].image.convertToBlob({ type: 'image/png' }),
      })));
  }
};
