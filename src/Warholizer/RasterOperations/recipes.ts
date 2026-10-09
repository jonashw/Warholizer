import { byte } from "../../NumberTypes";
import { PureRasterApplicator } from "./PureRasterApplicator";
import { PureRasterOperation } from "./PureRasterOperation";

/**
 * A named arrangement of applicators. Applying a recipe gives the editor an ordinary, editable
 * copy; the recipe itself never changes. Built-in for now; saved and shared recipes come with
 * formulas (ADR 0001).
 */
export type RecipeSetting = {
  key: string,
  label: string,
  description?: string,
  min: number,
  max: number,
  step: number,
  default: number
};

export type RecipeSettings = Record<string, number>;

export type Recipe = {
  id: string,
  name: string,
  description: string,
  /** Shown with the recipe, e.g. "Works best with a light background". */
  hint?: string,
  /** Knobs that rebuild the arrangement; their values are passed to `build`. */
  settings?: RecipeSetting[],
  /** Run the arrangement on each input separately (e.g. one grid per photo). */
  perInput?: boolean,
  build: (settings: RecipeSettings) => PureRasterApplicator[]
};

export const defaultRecipeSettings = (recipe: Recipe): RecipeSettings =>
  Object.fromEntries((recipe.settings ?? []).map(s => [s.key, s.default]));

/** The recipe's applicators for the given settings (defaults for any not given). */
export const recipeApplicators = (recipe: Recipe, settings: RecipeSettings = {}): PureRasterApplicator[] =>
  recipe.build({ ...defaultRecipeSettings(recipe), ...settings });

/**
 * "Subject darkness" 0..100 as Levels settings. 50 leaves tones alone. Higher darkens midtones
 * (gamma < 1) and, above 50, raises the black point, so a light subject close to a white
 * background (e.g. a yellow banana) still separates from it and takes the shadow color.
 * Lower lightens midtones for very dark subjects.
 */
export const darknessToLevels = (darkness: number): { black: number, gamma: number } => ({
  // Up to 235 at full darkness (just under the 245 white point): enough to separate even a pale
  // yellow subject (luminance ~230-240) from a white background.
  black: Math.round(Math.max(0, darkness - 50) * 4.7),
  gamma: Math.round(Math.pow(2, (50 - darkness) / 25) * 100) / 100,
});

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
    hint: 'Works best with a high-contrast subject on a light background; raise subject darkness for light subjects.',
    perInput: true,
    settings: [
      { key: 'darkness', label: 'Subject darkness', description: 'Higher maps more of the subject to the shadow color.', min: 0, max: 100, step: 5, default: 50 },
      { key: 'columns', label: 'Columns', min: 1, max: 6, step: 1, default: 3 },
    ],
    build: ({ darkness, columns }) => [
      // Flatten near-white (JPEG noise) so each background becomes a perfectly flat color;
      // black point and gamma set how much of the subject reads as shadow.
      pipe({ type: 'levels', black: byte(darknessToLevels(darkness).black), white: byte(245), gamma: darknessToLevels(darkness).gamma }),
      // One output per duotone.
      flatMap(...warholDuotones.map(([shadow, background]): PureRasterOperation => ({ type: 'gradientMap', stops: [shadow, background] }))),
      pipe({ type: 'tile', primaryDimension: 'x', lineLength: columns }),
    ],
  },
  {
    id: 'comic-print',
    name: 'Comic print',
    description: 'Punchier tones, then CMYK Ben-Day dots.',
    settings: [{ key: 'dotDiameter', label: 'Dot size', min: 3, max: 20, step: 1, default: 6 }],
    build: ({ dotDiameter }) => [
      pipe(
        { type: 'levels', black: byte(20), white: byte(235), gamma: 1.1 },
        { type: 'colorHalftone', dotDiameter, blurPixels: 1 },
      ),
    ],
  },
  {
    id: 'sticker-cutout',
    name: 'Sticker cutout',
    description: 'Removes the background around the subject and adds a white die-cut border with a cut line.',
    hint: 'Works best on a plain background.',
    settings: [
      { key: 'tolerance', label: 'Background tolerance', description: 'How different from the edge color a pixel can be and still be removed.', min: 5, max: 150, step: 5, default: 40 },
      { key: 'width', label: 'Border width', min: 0, max: 40, step: 1, default: 12 },
    ],
    build: ({ tolerance, width }) => [
      pipe(
        { type: 'colorKey', color: null, tolerance, softness: 20, connected: true },
        { type: 'stickerBorder', width, color: '#ffffff', cutLine: true },
      ),
    ],
  },
  {
    id: 'four-color-screenprint',
    name: 'Four-color screenprint',
    description: 'Flat four-color poster: quantize, then recolor darkest to lightest.',
    build: () => [
      pipe({ type: 'quantize', colors: 4, replacements: ['#1b1b3a', '#e63946', '#f4a261', '#f1faee'] }),
    ],
  },
];
