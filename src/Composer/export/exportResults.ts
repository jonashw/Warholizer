import { defaultFormat } from "../formats";
import { isGroupAware } from "../../Warholizer/RasterOperations/PureRasterOperation/registry";
import { childrenOf } from "../tree";
import { Cell, Cube, ExportSettings, Format, Node, PHOTO } from "../types";
import { gifOf } from "./gif";
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

/** A result's physical size in points: its page format (with bleed), or its pixels at the composition's DPI. */
export const pointsOf = (cell: Cell<OffscreenCanvas>, format: Format = defaultFormat): [number, number, number] => {
  const frame = cell.frame;
  if (frame) {
    const perInch = frame.unit === 'in' ? 1 : frame.unit === 'mm' ? 1 / 25.4 : 1 / frame.dpi;
    const bleed = frame.bleed * perInch * 72;
    return [frame.width * perInch * 72 + 2 * bleed, frame.height * perInch * 72 + 2 * bleed, bleed];
  }
  return [cell.image.width / format.dpi * 72, cell.image.height / format.dpi * 72, 0];
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
/** A result as a PDF page: its JPEG and physical size (small, so many can be collected). */
export const pdfPageOf = async (cube: Cube<OffscreenCanvas>, i: number, format: Format = defaultFormat): Promise<PdfPage> => {
  const cell = cube.cells[i];
  const [widthPt, heightPt, bleedPt] = pointsOf(cell, format);
  return { jpeg: await jpegOf(cell.image), pixelWidth: cell.image.width, pixelHeight: cell.image.height, widthPt, heightPt, bleedPt };
};

export const pdfDocument = (name: string, pages: PdfPage[]): ExportFile =>
  ({ name: `${slug(name)}.pdf`, blob: new Blob([buildPdf(pages) as BlobPart], { type: 'application/pdf' }) });

export const exportFiles = async (
  name: string, cube: Cube<OffscreenCanvas>, indexes: number[], settings: ExportSettings, format: Format = defaultFormat,
): Promise<ExportFile[]> => {
  const page = (i: number) => pdfPageOf(cube, i, format);
  const pdfBlob = (pages: PdfPage[]) => new Blob([buildPdf(pages) as BlobPart], { type: 'application/pdf' });
  // Animations are GIFs whatever the file type; everything else follows the settings.
  const animated = indexes.filter(i => cube.cells[i].animation);
  const gifs = animated.map(i => {
    const a = cube.cells[i].animation!;
    return { name: fileNameOf(resultAddress(name, cube, i), 'gif'), blob: gifOf(a.frames, a.frameMs, a.bounce) };
  });
  const still = indexes.filter(i => !cube.cells[i].animation);
  return [...gifs, ...(still.length ? await stillFiles(name, cube, still, settings, page, pdfBlob) : [])];
};

const stillFiles = async (
  name: string, cube: Cube<OffscreenCanvas>, indexes: number[], settings: ExportSettings,
  page: (i: number) => Promise<PdfPage>, pdfBlob: (pages: PdfPage[]) => Blob,
): Promise<ExportFile[]> => {
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

/**
 * Whether results can be rendered one photo at a time (memory-safe export): every result keeps
 * its photo, and no step looks across photos (group-aware steps grouped without Photo, a match to
 * another photo, or distributions that deal variants across images).
 */
export const separableByPhoto = (root: Node, output: Cube<unknown>): boolean => {
  if (output.cells.length === 0 || !output.cells.every(c => c.coords[PHOTO] !== undefined)) return false;
  const nodes = (node: Node): Node[] => [node, ...childrenOf(node).flatMap(nodes)];
  return nodes(root).every(node => {
    if (node.kind === 'variations') return node.distribution.type === 'all-variants-per-image';
    if (node.kind === 'operation' && isGroupAware(node.op)) {
      const photoReference = node.op.type === 'tone' && node.op.method.type === 'match' && typeof node.op.method.reference === 'object';
      return !photoReference && (node.by ?? []).includes(PHOTO);
    }
    return true;
  });
};
