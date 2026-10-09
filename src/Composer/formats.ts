import { Format } from "./types";

const paper = (name: string, width: number, height: number, unit: 'in' | 'mm' = 'in'): Format => ({
  name, width, height, unit, dpi: 300, margin: unit === 'in' ? 0.25 : 6, bleed: 0, safe: 0, background: 'white',
});
const screen = (name: string, width: number, height: number): Format => ({
  name, width, height, unit: 'px', dpi: 300, margin: 0, bleed: 0, safe: 0, background: 'white',
});
const product = (name: string, width: number, height: number, background: Format['background'] = 'white'): Format => ({
  name, width, height, unit: 'in', dpi: 300, margin: 0, bleed: 0.125, safe: 0.25, background,
});

/** The formats offered by name (ADR 0003, Formats). Screens are named by shape, not platform. */
export const formatGroups: { label: string, formats: Format[] }[] = [
  {
    label: 'Paper',
    formats: [
      paper('Letter', 8.5, 11), paper('Legal', 8.5, 14), paper('Tabloid', 11, 17),
      paper('A4', 210, 297, 'mm'), paper('A3', 297, 420, 'mm'),
      paper('4 × 6 photo', 4, 6), paper('5 × 7 photo', 5, 7), paper('Postcard', 4, 6),
    ],
  },
  {
    label: 'Screen',
    formats: [
      screen('Square', 1080, 1080), screen('Portrait', 1080, 1350), screen('Tall', 1080, 1920),
      screen('Wide', 1920, 1080), screen('Banner', 1500, 500), screen('Link preview', 1200, 630),
    ],
  },
  {
    label: 'Products',
    formats: [
      product('T-shirt', 12, 16, 'transparent'), product('Mug wrap', 8.5, 3.5), product('Mouse pad', 9.25, 7.75),
      product('Sticker 2 in', 2, 2, 'transparent'), product('Sticker 3 in', 3, 3, 'transparent'), product('Sticker 4 in', 4, 4, 'transparent'),
      product('Poster 18 × 24', 18, 24), product('Poster 24 × 36', 24, 36),
    ],
  },
];

export const allFormats = formatGroups.flatMap(g => g.formats);

/** Letter, portrait, 300 DPI, 0.25 in margins: the composition default. */
export const defaultFormat: Format = allFormats[0];

const perInch = (unit: Format['unit'], dpi: number) => unit === 'in' ? dpi : unit === 'mm' ? dpi / 25.4 : 1;

/** A length in the format's units, in pixels of the original photo (times `scale` for previews). */
export const formatToPixels = (format: Format, value: number, scale = 1) => value * perInch(format.unit, format.dpi) * scale;

/** The page in pixels at this scale. */
export const pagePixels = (format: Format, scale = 1): [number, number] =>
  [Math.max(1, Math.round(formatToPixels(format, format.width, scale))), Math.max(1, Math.round(formatToPixels(format, format.height, scale)))];

/**
 * The page to lay out on, in pixels: the trim plus bleed on every side. Content stays inside the
 * margin or safe area (whichever is larger); only bleeding layouts reach the outer edge.
 */
export const pageBoxOf = (format: Format, scale = 1) => {
  const bleed = formatToPixels(format, format.bleed, scale);
  const [w, h] = pagePixels(format, scale);
  return {
    width: Math.round(w + 2 * bleed),
    height: Math.round(h + 2 * bleed),
    bleed,
    margin: bleed + formatToPixels(format, Math.max(format.margin, format.safe), scale),
    background: format.background,
  };
};

export const isLandscape = (format: Format) => format.width > format.height;

/** The same format turned: portrait ↔ landscape. */
export const turned = (format: Format): Format => ({ ...format, width: format.height, height: format.width });

/** "8.5 × 11 in · 300 DPI". */
export const formatSummary = (format: Format) =>
  `${format.width} × ${format.height} ${format.unit}${format.unit === 'px' ? '' : ` · ${format.dpi} DPI`}`;
