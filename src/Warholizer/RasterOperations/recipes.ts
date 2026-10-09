import { byte } from "../../NumberTypes";
import { PureRasterApplicator } from "./PureRasterApplicator";
import { PureRasterOperation } from "./PureRasterOperation";

/**
 * A named arrangement of applicators. Applying a recipe gives the editor an ordinary, editable
 * copy; the recipe itself never changes. Built-in for now; saved and shared recipes come with
 * formulas (ADR 0001).
 */
export type Recipe = {
  id: string,
  name: string,
  description: string,
  /** Shown with the recipe, e.g. "Works best with one photo". */
  hint?: string,
  applicators: PureRasterApplicator[]
};

const pipe = (...ops: PureRasterOperation[]): PureRasterApplicator => ({ type: 'pipe', ops, enabled: true });
const flatMap = (...ops: PureRasterOperation[]): PureRasterApplicator => ({ type: 'flatMap', ops, enabled: true });

/** Shadow → background pairs sampled from docs/references/warhol-duotone-grid-giraffe.jpg. */
const warholDuotones: [string, string][] = [
  ['#183a65', '#ff4137'],
  ['#850564', '#f3dd6d'],
  ['#012be5', '#00fcff'],
  ['#891c72', '#00e5c8'],
  ['#980405', '#88dbdf'],
  ['#077942', '#fef08d'],
];

export const recipes: Recipe[] = [
  {
    id: 'warhol-duotone-grid',
    name: 'Warhol duotone grid',
    description: 'Six duotones of the photo in a 3 × 2 grid, after docs/references/warhol-duotone-grid-giraffe.jpg.',
    hint: 'Works best with one high-contrast photo on a light background.',
    applicators: [
      // Flatten near-white (JPEG noise) so each background becomes a perfectly flat color.
      pipe({ type: 'levels', black: byte(0), white: byte(245), gamma: 1 }),
      // One output per duotone.
      flatMap(...warholDuotones.map(([shadow, background]): PureRasterOperation => ({ type: 'gradientMap', stops: [shadow, background] }))),
      pipe({ type: 'tile', primaryDimension: 'x', lineLength: 3 }),
    ],
  },
  {
    id: 'comic-print',
    name: 'Comic print',
    description: 'Punchier tones, then CMYK Ben-Day dots.',
    applicators: [
      pipe(
        { type: 'levels', black: byte(20), white: byte(235), gamma: 1.1 },
        { type: 'colorHalftone', dotDiameter: 6, blurPixels: 1 },
      ),
    ],
  },
  {
    id: 'sticker-cutout',
    name: 'Sticker cutout',
    description: 'Removes the background around the subject and adds a white die-cut border with a cut line.',
    hint: 'Works best on a plain background.',
    applicators: [
      pipe(
        { type: 'colorKey', color: null, tolerance: 40, softness: 20, connected: true },
        { type: 'stickerBorder', width: 12, color: '#ffffff', cutLine: true },
      ),
    ],
  },
  {
    id: 'four-color-screenprint',
    name: 'Four-color screenprint',
    description: 'Flat four-color poster: quantize, then recolor darkest to lightest.',
    applicators: [
      pipe({ type: 'quantize', colors: 4, replacements: ['#1b1b3a', '#e63946', '#f4a261', '#f1faee'] }),
    ],
  },
];
