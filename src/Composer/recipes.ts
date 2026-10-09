import { byte } from "../NumberTypes";
import { allPerImage, combine, formatNode, layout, operationNode, sequence, variationsList, warholDuotoneGrid, warholDuotones } from "./build";
import { allFormats } from "./formats";
import { Composition, Node } from "./types";

/** A starting point in Composer's library: applying it gives an ordinary, editable composition. */
export type ComposerRecipe = { id: string, name: string, description: string, build: () => Composition };

const formatNamed = (name: string) => allFormats.find(f => f.name === name)!;
const duotones = () => warholDuotones.map(([shadow, background]) => operationNode({ type: 'gradientMap', stops: [shadow, background] }));

/** One composition, several products: each photo laid out for every format at once. */
const merchPack = (): Composition => ({
  version: 1,
  name: 'Merch pack',
  root: sequence(
    operationNode({ type: 'tone', method: { type: 'auto', clip: 1 } }),
    operationNode({ type: 'gradientMap', stops: ['#183a65', '#ff4137'] }),
    variationsList(allPerImage, ...['T-shirt', 'Mug wrap', 'Mouse pad', 'Sticker 3 in', 'Poster 18 × 24'].map(name => formatNode(formatNamed(name)))),
    // Pages keep the Format dimension automatically: one page per photo per product.
    combine(layout({ size: { type: 'across', n: 1 }, frame: { type: 'page', distribution: { type: 'one-cell-per-image', overflow: 'shrink' } } })),
  ),
});

/**
 * One seed, two roles: seed 7 deals each photo a duotone, and the same seed shuffles the
 * wallpaper those duotones fill (ADR 0003: Variations and Layout mirror each other).
 */
const sharedSeed = (): Composition => ({
  version: 1,
  name: 'Shared seed',
  root: sequence(
    operationNode({ type: 'levels', black: byte(0), white: byte(245), gamma: 1 }),
    variationsList({ type: 'one-variant-per-image', order: { type: 'shuffled', seed: 7 } }, ...duotones()),
    combine(layout({
      size: { type: 'width', size: { value: 1.5, unit: 'in' } },
      fit: 'cover',
      pattern: 'half-drop',
      frame: { type: 'page', distribution: { type: 'one-image-per-cell', order: { type: 'shuffled', seed: 7 }, edges: 'bleed' } },
    }), []),
  ),
});

/**
 * Role swap: what one composition varies, another lays out. Instead of a grid per photo, one sheet
 * per duotone, holding every photo, captioned.
 */
const roleSwap = (): Composition => {
  const palettes: Node = variationsList(allPerImage, ...duotones());
  return {
    version: 1,
    name: 'Role swap: a sheet per duotone',
    root: sequence(
      operationNode({ type: 'levels', black: byte(0), white: byte(245), gamma: 1 }),
      palettes,
      combine(layout({ size: { type: 'across', n: 2 }, labels: 'captions', gutter: { value: 0.25, unit: 'in' },
        frame: { type: 'page', distribution: { type: 'one-cell-per-image', overflow: 'shrink' } } }), [palettes.id]),
    ),
  };
};

export const composerRecipes: ComposerRecipe[] = [
  { id: 'warhol-duotone-grid', name: 'Warhol duotone grid', description: 'Six duotones of each photo, tiled three across.', build: warholDuotoneGrid },
  { id: 'merch-pack', name: 'Merch pack', description: 'Each photo as a duotone, laid out for a T-shirt, mug wrap, mouse pad, sticker and poster at once.', build: merchPack },
  { id: 'shared-seed', name: 'Shared seed', description: 'Seed 7 deals each photo a duotone, then shuffles the same images into a half-drop wallpaper sheet.', build: sharedSeed },
  { id: 'role-swap', name: 'Role swap', description: 'One sheet per duotone instead of one grid per photo: what was varied is what gets laid out.', build: roleSwap },
];
