# ADR 0003: Composer: compositions over image cubes

- **Status:** Accepted (model and vocabulary); version 1 scope proposed
- **Date:** 2026-10-09
- **Deciders:** @jonashw

## Context

The Pure Editor arranges operations with *applicators* (`pipe`, `flatMap`, `zip`) and, since 2026-10-09, one-level groups (`each`, `all`). Reviewing that model for semantic consistency, expressiveness, and conceptual purity found:

1. "flatMap" names the wrong concept: the applicator is a fan-out; the group's `each` mode is the real flatMap (monadic bind on the image list).
2. Composition is expressed three ways (top level, `pipe`, group `all`).
3. Applicators and groups are one abstraction (a container plus a combining rule) at two levels, with different capabilities.
4. Combinators are not compositional: pipelines cannot be fanned out or distributed.
5. `zip` silently drops images beyond the number of operations.
6. Empty containers and `enabled` flags are handled inconsistently.
7. Words like "per image", "pairwise", and "group by image or by operation first" are all about **which dimension** something acts along, but the model has no dimensions: images flow as a flat list.

The last point is the key. After a fan-out, every image has coordinates (which photo, which variation): the data is a **cube**, and OLAP already has precise vocabulary for it (drill-down, roll-up, slice, dice, pivot). Composer keeps the structure but uses artist-friendly verbs: drill-downs are **Separate** and roll-ups are **Combine**.

The Pure Editor and graph editor stay as they are. The cube model gets its own editor, **Composer**, built on the same image operations and engine (which were deliberately kept separate from how they are combined).

## Decision

### Data: cubes of cells

- A **cube** is what flows between steps: an ordered collection of **cells** plus an ordered list of **dimensions**.
- A **dimension** is an axis (Photo, Gradient map, Channel). A **member** is one value of a dimension (photo 2, plum → mustard, R).
- A **cell** holds one **image** at its coordinates (one member per dimension, or "–" where a dimension does not apply: cubes may be sparse and ragged). In the editor, cells are simply "images".
- The input cube has one dimension, **Photo**.
- **Order:** cells are listed by their dimensions in dimension order: **by photo first**, then later dimensions in the order they were created. **Pivot** reorders dimensions.

### Documents: compositions

A **Composition** is the Composer document: a tree of **nodes**. A node is an **operation** or a **composition** (a container with children). Every node takes a cube and returns a cube.

| Composition | Meaning | FP |
|---|---|---|
| **Sequence** | Each child receives the previous child's output. The document root is a Sequence. | composition |
| **Variations** (*distribution*) | Each variant receives the incoming cube; outputs gain a new dimension whose members are the variants. The variants are a **List** of child nodes or a **Spread** of one operation's parameter (see [Spread](#spread)). | fanout (cross product), or zip with cycling or shuffling |

`distribution: VariationDistribution` is one of:

| Distribution | Meaning |
|---|---|
| `all-per-image` | Every image goes through every variation (full cross product). |
| `one-per-image(in-turn)` | Image *n* goes through variation *n mod k*. |
| `one-per-image(shuffled(seed: 7))` | Each image goes through one variation, assigned by dealing a seeded shuffled deck of the variations (balanced: with 6 images and 3 variations, each variation is used twice). |

The notation nests like the type constructors (`OnePerImage of Order`, `Shuffled of seed`).

### Operations, by what they do to the cube

| Category | Signature | Dimensions | Operations |
|---|---|---|---|
| **Effects** | image → image | unchanged | invert, levels, halftone, crop, rotate, gradient map, … |
| **Separate** | image → parts | adds one (Channel, Ink, Part, Color) | split, RGB channels, separate colors, CMYK |
| **Combine**, *by* dimensions | images → image per group | keeps only the *by* dimensions | **Layout**: tile, line, print sheet, **crosstab**; **Blend**: stack (blend mode); v1.1: mean, median; **Animate** (v1.1) |
| **Pick** | cube → sub-cube | `= member` (slice) removes the dimension; `in [members]` (dice) keeps it, even for a list of one | pick |
| **Pivot** | cube → cube | reorders dimensions | pivot |

- **Combine grouping:** cells are grouped by the *by* dimensions (like SQL `GROUP BY`); each group becomes one image (or one animation), combined in cube order. `by: []` makes one group. Default: all dimensions except the newest. Example phrasing: "Tile by Photo".
- **Combine** is a sum type of three kinds, each with its own methods: **Layout** (place images side by side: tile, line, print sheet, crosstab), **Blend** (overlay images into one: stack with a blend mode, mean, median), and **Animate** (images become frames). One Combine node is one kind and method (they share the *by* control); Combine nodes compose, e.g. `mean by: [photo, gradient map]` then `tile by: [photo]`.
- **Crosstab:** a two-dimensional tile with **rows** = one dimension and **columns** = another, labeled with member names (a pivot table of images).
- Copies, Noop, and Void are not Composer operations: copies is Variations of identical children; void is a Pick of nothing.

### Alternatives are methods (sum types)

Operations that answer the same question with different tradeoffs are **one operation with a `method` sum type**, and the registry records each method's strengths and weaknesses (shown in tooltips and the Add step menu), so the knowledge that they are alternatives travels with the type. One step chooses one method; steps still chain (e.g. Match histogram, then Manual levels to fine-tune).

**Tone** (which tone curve should this image use?):

```
type Tone =
  | ManualLevels of black: Byte * white: Byte * gamma: float
  | AutoLevels of clip: Percent
  | MatchHistogram of reference: Reference
and Reference = FirstInGroup | GroupMean | Photo of int
```

| Method | Strengths | Weaknesses |
|---|---|---|
| **Manual levels** | Full control; predictable; good for fine-tuning one photo | Manual work; does not adapt to new photos |
| **Auto-levels** | One click; adapts to each image; uses the full tonal range | Straight stretch keeps the curve's shape; outliers distort it (hence `clip`); can amplify noise |
| **Match histogram** | Makes a series behave alike, so one recipe treats every photo the same; copies the whole curve, not only its endpoints | Only as good as the reference; very different sources can band; can pull a photo from its own character |

Match histogram keeps each pixel's brightness rank and assigns the reference's brightness at that rank. Auto-levels and Match histogram are **group-aware**: with *by*, statistics are computed per group ("Match histogram by Photo" makes each photo's variations consistent with each other). All three methods compile to a per-channel 256-entry curve applied by one GPU kernel.

Other operations following the principle: **Halftone** (`smooth` | `classic`), **Dither** (`ordered` with Bayer size | `error-diffusion` with Floyd–Steinberg or Atkinson; consolidates two current operations), **Combine** (Layout | Blend | Animate), and **Spread** (Count | Skip by).

### Dimension names

- Variations of one operation type: named after the operation; members labeled by the differing parameter (Gradient map: navy → red, …; Halftone: 15°, 75°, 0°).
- Variations of different operations: **Variation**, members labeled by each child (Invert, Grayscale; a nested sequence by its contents).
- Separate operations name their dimension (Channel: R, G, B; Ink: C, M, Y, K; Part; Color).
- Identical children are numbered; a repeated dimension name gets a suffix (Gradient map 2).
- Dimensions are identified internally by the node that created them, so they can be renamed without breaking *by* or Pick references.
- Variations (List or Spread) may **bind** its dimension's name explicitly, like a comprehension variable: `spread cell <- halftone.cell 4..16 count: 4`. Without a binder, the derived name applies; writing a binder is the rename.

Spreads and Combines read as comprehensions: a two-parameter spread then a crosstab is `[halftone(photo, cell, angle) | photo <- photos, cell <- cells, angle <- angles] |> groupBy photo |> pivot rows: cell, columns: angle`. Dimensions are the comprehension's bound variables.

### Randomness

All randomness is seeded and therefore deterministic, testable, and cacheable:

- Seeds are chosen when a step is added and stored in the document; **Reroll** picks a new one.
- Per-cell randomness (e.g. noise) derives from (seed, cell coordinates), so adding a photo does not change other cells.
- Applies to Shuffled distributions and to Noise (the CPU kernel moves from `Math.random` to a seeded generator).

### Representations

- **Types** (documentation and checking), ML style:
  ```
  type Node =
    | Operation of Operation
    | Sequence of Node list
    | Variations of distribution: VariationDistribution * variants: Variants
  and Variants =
    | List of Node list
    | Spread of op: Operation * parameters: Spread list
  and Spread =
    | Count of param: string * range: Range * n: int
    | SkipBy of param: string * range: Range * by: float
    (* roadmap: | Distinct of param: string * range: Range * n: int *)
  and Range = { from: float; to: float }
  and VariationDistribution =
    | AllPerImage
    | OnePerImage of Order
  and Order = InTurn | Shuffled of seed: int
  ```
- **Storage:** canonical JSON (the formula format of ADR 0001).
- **Text view:** indentation-based s-expressions with named arguments, one node per line, children indented:
  ```
  sequence
    levels white: 245
    variations all-per-image
      gradient-map stops: [#183a65 #ff4137]
      gradient-map stops: [#850564 #f3dd6d]
      gradient-map stops: [#012be5 #00fcff]
      gradient-map stops: [#891c72 #00e5c8]
      gradient-map stops: [#980405 #88dbdf]
      gradient-map stops: [#077942 #fef08d]
    tile by: [photo] columns: 3
  ```

### Spread

Variations has two forms of variants:

- **List:** child nodes chosen one by one (`variations all-per-image` with children). A list may also hold values of one parameter that has choices rather than a range (halftone shape: round, square, line); the editor's **All** chip lists every choice.
- **Spread:** one operation, varied across a numeric range of one or more of its parameters. **Spread is itself a sum type**, by how the range is divided:

| Spread | Meaning | Example (0°..90°) |
|---|---|---|
| `count n` | *n* evenly spaced values; always includes both ends | count 5: 0, 22.5, 45, 67.5, 90 |
| `skip-by d` | every *d*, starting at the low end, up to the high end | skip-by 15: 0, 15, 30, 45, 60, 75, 90 |

- Each variant carries only the fields it uses. Spread covers numeric parameters only; parameters with choices use List.
- With several parameters, a Spread adds one dimension per parameter (their cross product). Its dimension is named after the operation and parameter (*Halftone cell*), with the values as members.
- A Spread stays a Spread in the document, so editing its range regenerates its variants; **Expand** converts it to a List.
- **Optional when written, complete when saved.** The editor and text view accept `spread halftone angle` alone: the range defaults to the parameter's useful range from the registry (`sweeps`) and the division to `count 5`. The saved document always stores the resolved range and division, so a later change to registry defaults never alters a saved or shared composition. Canonical JSON is tagged by variant: `{ "spread": "count", "param": "angle", "range": [0, 90], "n": 5 }`.
- **Editor:** long-press any slider in an effect's sheet for a peek of a default spread around the current value; **Spread this** converts the step into Variations · Spread. The full sheet edits the range with two handles and a **Count | Skip by** toggle.
- Spacing is linear in v1; geometric spacing (useful for sizes) and **Distinct** are on the roadmap.

### Lengths

Sizes are pixels today, so a preview (512 px) and an export (the original photo) look different. Every size-like setting becomes a **Length**:

```
type Length =
  | Px of float
  | Relative of percent        (* of the image's short side *)
  | In of float | Mm of float | Pt of float   (* physical: resolved through the cell's frame DPI *)
```

- Existing documents read as `Px`, so nothing breaks.
- Halftone takes its screen in **lines per inch** (about 45 lpi for chunky pop art, 85 for newsprint, 150 for magazines).
- In text, the unit follows the value or the whole range: `width: 2 in`, `spread halftone screen: 30..90 lpi count: 4`, `spread layout width: 1..3 in count: 3`.
- **Planning before rendering:** because a composition is data, inference knows each image's final size on paper ("a 2 in cell at 300 DPI is 600 px"), so photos are loaded at exactly their print resolution, and too-small photos are flagged ("photo 2 prints at 140 effective DPI").

### Formats and frames

- A **format** is a named frame: size, units, DPI, bleed and safe area. Paper (Letter, Legal, Tabloid, A4, A3, 4 × 6, 5 × 7, Postcard), screens named by shape (**Square** 1080 × 1080, **Portrait** 1080 × 1350, **Tall** 1080 × 1920, **Wide** 1920 × 1080, **Banner** 1500 × 500, **Link preview** 1200 × 630), products (T-shirt 12 × 16 in on transparent, mug wrap 8.5 × 3.5 in, mouse pad 9.25 × 7.75 in, stickers 2, 3 and 4 in, posters 18 × 24 and 24 × 36 in), **Match photo** and **Custom**.
- The composition has a **default format**: Letter, portrait, 300 DPI, 0.25 in printer margins.
- Every cube cell has a **frame**: free (just pixels) or a format. Steps can read it, inference checks it (a crop or rotate after a page is flagged), and export honors it.
- A **Format** step sets the frame for the cells after it. **Variations of Format** make Format a dimension: one composition exports the same work for several formats at once (a "Merch pack" is a recipe, not a model term).

### Layout

Tile, Line, Crosstab and Sheet are one operation, **Layout** (a Combine), which places images into a grid of **layout cells** ("cells" in the UI, where cube cells are called images):

```
type Layout = {
  placement:    Flow                                              (* cube order *)
              | ByDimensions of rows: Dimension list * columns: Dimension list   (* crosstab; nested headers *)
  size:         Across of int | Down of int | Width of Length | Height of Length
  fit:          Contain | Cover | Natural | Match                  (* default Contain *)
  align:        Start | Center | End
  pattern:      Normal | HalfDrop | HalfBrick | Mirror | Wacky    (* Flow only *)
  gutter:       Length
  labels:       None | Headers | Captions
  frame:        Free                                              (* grows with its content *)
              | Page of LayoutDistribution                        (* the cell's format *)
}
```

- **Fit** when an image's shape differs from its cell's: **Contain** shows the whole image with bands; **Cover** fills and crops; **Natural** keeps each image's size (rows as tall as their tallest image); **Match** sizes cells to images along the layout's axis: equal heights per row filling the width when Across (justified rows), equal widths per column when Down. Line's old "squish" is Match. **Align** places an image within a row or column it does not fill.
- **Line** is `Across: all` (or `Down: all`); reading direction belongs to every Layout.
- **Crosstab** is ByDimensions with Headers. Each axis takes a list of dimensions, combined in cube order (outer first) with spanning headers, like a pivot table. Positions with no image stay blank (for example after a one-variant-per-image distribution). Patterns are disabled for labeled grids. On a page, spill breaks between rows (at outer members where possible) and repeats the column headers.
- **Tile**, **Sheet**, **Line** and **Crosstab** remain the names in the UI as entry points; switching between them keeps shared settings.
- Laws: a Layout with a free frame has exactly one cell per image. On a page, the frame and size fix the number of cells, independent of the image count.

### Distributions: Variations and Layout mirror each other

Variations assigns **variants to images**; Layout assigns **images to cells**. Named with both nouns, each distribution pairs with its converse, and the two families line up:

| Variations (variants, images) | Layout (images, cells) |
|---|---|
| `all-variants-per-image` | `all-images-per-cell` (Blend) |
| `one-variant-per-image(order)` | `one-image-per-cell(order, edges)` (fill the page, cycling images) |
| `one-image-per-variant(order, overflow)` | `one-cell-per-image(overflow)` (each image once) |

```
Order          = InTurn | Shuffled of seed          (* shared *)
Edges          = WholeCopies | Bleed
LayoutOverflow = Spill | Shrink                     (* Spill adds a Page dimension *)
VariantOverflow = Spill | Drop | Keep               (* Spill adds a Round dimension; Keep passes leftover images through *)
```

- Mismatched counts mirror too: extra cells stay empty; extra variants go unused.
- The shared vocabulary is meant to inspire work as well as describe it: one seed can drive both a palette assignment and a sheet's arrangement, and a composition can swap roles, laying out what another varies.
- Status: the both-noun names are proposed (they rename today's `all-per-image` and `one-per-image`); `one-image-per-variant` is accepted.

### Export and addresses

- Every result has a stable **address made of its dimension members** (`warhol-duotone-grid / photo 2 / letter / page 1`), so each can be linked and served from cache. Download filenames are that address flattened (`warhol-duotone-grid_photo-2_letter_p1.pdf`); naming is not a user setting.
- A set of results is a **slice**: a partial address in a URL (`/c/7Kq2xd/results?format=letter`) is a Pick.
- **Export settings** say how results are written, not how they look: PNG | JPEG | PDF (one file per page, or one multi-page document), proof or final resolution, and later a color profile.

### Laws

- Effects never change coordinates or order.
- A Separate followed by a Combine by all other dimensions returns one image per original cell.
- Variations of identical children is Copies; Pick of one member after Variations equals that child alone.
- A Combine only behaves differently "per photo" because of its *by* dimensions; there is no separate per-image wrapper.
- A Spread equals its Expand: a List of the same operation with each resolved value.

### Examples

Simple:
```
variations all-per-image
  invert
  grayscale
tile by: [photo]
```
| Photo | Variation | after `tile by: [photo]` |
|---|---|---|
| 1 | Invert | photo 1: Invert and Grayscale tiled |
| 1 | Grayscale | |
| 2 | Invert | photo 2: Invert and Grayscale tiled |
| 2 | Grayscale | |

Per-ink screen angles (Separate, distribution in turn, Combine):
```
sequence
  rgb-channels
  variations one-per-image(in-turn)
    halftone angle: 15
    halftone angle: 75
    halftone angle: 0
  stack mode: multiply by: [photo]
```

Nested (ragged):
```
sequence
  variations all-per-image
    sequence
      posterize
      variations all-per-image
        gradient-map stops: [A]
        gradient-map stops: [B]
    halftone
  tile by: [photo, variation]
  tile by: [photo]
```
| Photo | Variation | Gradient map |
|---|---|---|
| 1 | Posterize + Gradient map | A |
| 1 | Posterize + Gradient map | B |
| 1 | Halftone | – |

Systematic exploration (a two-parameter spread in a crosstab, per photo):
```
sequence
  variations all-per-image
    spread halftone
      cell: 4..16 count: 4
      angle: 0..45 skip-by: 15
  crosstab rows: [halftone cell] columns: [halftone angle] by: [photo]
```

## Scope

| Version | Scope |
|---|---|
| **v1** | Composer route; Composition document; types, canonical JSON, read-only text view; Sequence; Variations with all three distributions; Variations as **List** or **Spread** (Count, Skip by) with Expand and long-press "Spread this"; dimension binders; Effects and Separate operations from the registry; **Tone** (manual levels, auto-levels, match histogram; group-aware via *by*); Combine: Layout (Tile, Line, Print sheet, Crosstab with labels) and Blend (Stack) with *by*; Pick; Pivot; live dimension and count inference; seeds and Reroll; the Warhol duotone grid as a sample Composition |
| **v1.1** | Combine · Animate (images to animation frames); other group-aware effects (shared palette quantize); Dither consolidation; Blend · Mean and Median; geometric Spread spacing; caching, Pick pushdown, effect fusion |
| **v1.2** (in order) | Length (px, relative, physical; lpi for halftone) and plan-before-render resolution; Formats, frames and the Format step; Layout (Flow and ByDimensions with nested headers, fit, align, patterns, pages with both distributions and overflow), replacing Tile, Line, Crosstab and print set in Composer; one-image-per-variant; multi-page PDF and export settings; recipes: Merch pack, shared seed, role swap |
| **v2** | Per-cell measures and data-driven arrangement: constraint-based selection (pick where, e.g. best contrast per photo), sort by (e.g. brightness), assignment by measurement (e.g. light photos get dark palettes), **Classify** (a derived dimension from a measurement, e.g. sort photos into brightness or hue buckets for a crosstab); **Spread · Distinct** (render many values, keep the *n* most visually different, so steps land where the image visibly changes); editable text with round-tripping |

## Future directions (from treating compositions as an AST)

1. Dimension inference: show dimensions and counts at every step without rendering; catch invalid references.
2. Incremental, content-addressed caching (shared with ADR 0001): re-render only what changed.
3. Query-style rewrites: Pick pushdown, hoisting shared effects above Variations, deduplicating identical children.
4. Effect fusion: consecutive effects compile into one GPU pass.
5. Resolution independence: evaluate at preview resolution while editing, full resolution for output.
6. The filter gallery as a cube view: a Spread plus a Crosstab; systematic exploration across any parameters and photos.
7. Text form and round-tripping.
8. Canonical forms: recipe equivalence, deduplication, structural search.
9. Usage analysis: compositions saved to the cloud are analyzed by structure (never images, aggregate only, stated in the sign-in and sharing copy) to find patterns (duplicated variants, Pick right after Variations, Spread then Expand then edits) that inform design and power in-app suggestions.
10. Imposition: pages in a known order arranged for folding (a mini-zine from one Letter sheet).

## Consequences

**Positive**
- One small algebra (two compositions, five operation categories) with exact, OLAP-grounded structure and artist-friendly names.
- Expressiveness the list model lacks: fanned-out pipelines, per-dimension Combines, crosstabs, slicing.
- Deterministic, testable randomness; a natural saved-formula format.
- Existing editors keep working; operations and engine are shared.

**Negative / costs**
- A new editor and evaluator (cells carry coordinates; Combines group by them).
- Two composition models coexist until one supersedes the other.
