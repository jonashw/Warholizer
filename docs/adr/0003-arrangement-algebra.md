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

The last point is the key. After a fan-out, every image has coordinates (which photo, which variation): the data is a **cube**, and OLAP already has precise vocabulary for it (drill-down, roll-up, slice, dice, pivot).

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
| **Variations** (*distribution*) | Each child receives the incoming cube; outputs gain a new dimension whose members are the children. | fanout (cross product), or zip with cycling or shuffling |

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
| **Drill-downs** | image → parts | adds one (Channel, Ink, Part, Color) | split, RGB channels, separate colors, CMYK |
| **Roll-ups**, *by* dimensions | images → image per group | keeps only the *by* dimensions | tile, line, stack, print sheet, **crosstab**; v1.1: **mean**, **median** |
| **Pick** | cube → sub-cube | `= member` (slice) removes the dimension; `in [members]` (dice) keeps it, even for a list of one | pick |
| **Pivot** | cube → cube | reorders dimensions | pivot |

- **Roll-up grouping:** cells are grouped by the *by* dimensions (like SQL `GROUP BY`); each group becomes one image, combined in cube order. `by: []` makes one group. Default: all dimensions except the newest. Example phrasing: "Tile by Photo".
- A roll-up node is exactly one of these kinds (they share the *by* control); separate roll-up nodes compose, e.g. `mean by: [photo, gradient map]` then `tile by: [photo]`.
- **Crosstab:** a two-dimensional tile with **rows** = one dimension and **columns** = another, labeled with member names (a pivot table of images).
- Copies, Noop, and Void are not Composer operations: copies is Variations of identical children; void is a Pick of nothing.

### Dimension names

- Variations of one operation type: named after the operation; members labeled by the differing parameter (Gradient map: navy → red, …; Halftone: 15°, 75°, 0°).
- Variations of different operations: **Variation**, members labeled by each child (Invert, Grayscale; a nested sequence by its contents).
- Drill-downs name their dimension (Channel: R, G, B; Ink: C, M, Y, K; Part; Color).
- Identical children are numbered; a repeated dimension name gets a suffix (Gradient map 2).
- Dimensions are identified internally by the node that created them, so they can be renamed without breaking *by* or Pick references.

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
    | Variations of distribution: VariationDistribution * Node list
    | Sweep of op: Operation * parameters: (string * Values) list * distribution: VariationDistribution
  and VariationDistribution =
    | AllPerImage
    | OnePerImage of Order
  and Order = InTurn | Shuffled of seed: int
  and Values =
    | Range of from: float * to: float * steps: int * spacing: Spacing
    | List of Value list
  and Spacing = Linear | Geometric
  ```

### Sweep

A **Sweep** generates Variations of one operation across values of one or more of its parameters (values: a range with linear or geometric spacing, or a list, which covers non-numeric parameters such as shapes or palettes). It stays a Sweep in the document, so editing the range regenerates its children; **Expand** converts it to plain Variations. Its dimension is named after the operation and parameter (*Halftone cell*), with the values as members; with several parameters it adds one dimension per parameter (their cross product). Distributions apply as for Variations.
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

### Laws

- Effects never change coordinates or order.
- A drill-down followed by a roll-up by all other dimensions returns one image per original cell.
- Variations of identical children is Copies; Pick of one member after Variations equals that child alone.
- A roll-up only behaves differently "per photo" because of its *by* dimensions; there is no separate per-image wrapper.

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

Per-ink screen angles (drill-down, distribution in turn, roll-up):
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

Systematic exploration (a two-parameter sweep in a crosstab, per photo):
```
sequence
  sweep halftone cell: range(4, 16, steps: 4, spacing: geometric) angle: list(0, 15, 30, 45) all-per-image
  crosstab rows: [halftone cell] columns: [halftone angle] by: [photo]
```

## Scope

| Version | Scope |
|---|---|
| **v1** | Composer route; Composition document; types, canonical JSON, read-only text view; Sequence; Variations with all three distributions; **Sweep** (Variations generated from a parameter range); Effects and Drill-downs from the registry; Tile, Line, Stack, Print sheet with *by*; Crosstab with labels; Pick; Pivot; live dimension and count inference; seeds and Reroll; the Warhol duotone grid as a sample Composition |
| **v1.1** | Animate (a roll-up to animation frames); group-aware effects (shared palette, auto-levels by group); Match histogram; Mean and Median roll-ups; caching, Pick pushdown, effect fusion |
| **v2** | Per-cell measures and data-driven arrangement: constraint-based selection (pick where, e.g. best contrast per photo), sort by (e.g. brightness), assignment by measurement (e.g. light photos get dark palettes), derived dimensions (e.g. hue bucket in a crosstab); editable text with round-tripping |

## Future directions (from treating compositions as an AST)

1. Dimension inference: show dimensions and counts at every step without rendering; catch invalid references.
2. Incremental, content-addressed caching (shared with ADR 0001): re-render only what changed.
3. Query-style rewrites: Pick pushdown, hoisting shared effects above Variations, deduplicating identical children.
4. Effect fusion: consecutive effects compile into one GPU pass.
5. Resolution independence: evaluate at preview resolution while editing, full resolution for output.
6. The filter gallery as a cube view: a Sweep plus a Crosstab; systematic exploration across any parameters and photos.
7. Text form and round-tripping.
8. Canonical forms: recipe equivalence, deduplication, structural search.

## Consequences

**Positive**
- One small algebra (two compositions, five operation categories) with exact, OLAP-grounded vocabulary.
- Expressiveness the list model lacks: fanned-out pipelines, per-dimension roll-ups, crosstabs, slicing.
- Deterministic, testable randomness; a natural saved-formula format.
- Existing editors keep working; operations and engine are shared.

**Negative / costs**
- A new editor and evaluator (cells carry coordinates; roll-ups group by them).
- Two composition models coexist until one supersedes the other.
