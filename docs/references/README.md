# Visual references

Looks we want Warholizer to reproduce, with notes on how. Each may become a canned recipe (a saved formula, see ADR 0001) once formulas exist.

## Warhol duotone grid (giraffe)

![Warhol duotone grid](warhol-duotone-grid-giraffe.jpg)

Six duotones of one photo, each with its own shadow ink and flat light background, in a 3 × 2 grid. Provided as a reference on 2026-10-08.

**Observations**
- Each tile is a two-color gradient map: the subject's darks take a saturated or dark ink; the background (white in the source) becomes a flat light or bright color.
- Backgrounds are perfectly flat, so the source tones are clipped at the light end before mapping (or the background was removed and filled).
- The fur has a fine engraved, screen-like texture: likely a line or dot screen at high frequency, or a sharpened high-contrast photo.
- Approximate pairs (shadow → background), left to right, top to bottom: navy → red-orange; plum → mustard; blue → cyan; magenta → teal; maroon → powder blue; forest green → butter yellow. Note the inversions: some tiles put the bright color in the background and the dark one in the subject, and a few pair a saturated ink with a pale ground.

**Recipe with today's operations** (Pure Editor)
1. Pipe: `levels` (raise black point, lower white point so the background clips to pure white), optionally `orderedDither` or `halftone` at a fine size for texture.
2. Pipe: `copies` (n = 6).
3. Zip: six `gradientMap`s with two stops each, as listed above.
4. Pipe: `tile` (line length 3).

**Canned recipe idea: "Warhol grid"**
- Parameters: tile count / columns, a palette set (list of duotone pairs, or generated: complementary or analogous pairs around the hue wheel), texture (none, dither, halftone line screen), background clip strength.
- Expands to the formula above. Natural fit for the filter gallery: sweep palette sets.
- Related: a "line screen" (engraving) halftone variant would match the fur texture better than round dots.
