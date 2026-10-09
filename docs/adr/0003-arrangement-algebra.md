# ADR 0003: Arrangement algebra

- **Status:** Proposed
- **Date:** 2026-10-09
- **Deciders:** @jonashw

## Context

The Pure Editor arranges operations with *applicators* (`pipe`, `flatMap`, `zip`), and since 2026-10-09 with one-level *groups* (`each`, `all`). Reviewing the model for semantic consistency, expressiveness, and conceptual purity:

**The domain.** Every operation is a function from a list of images to a list of images. Operations already have three list behaviors:

| Behavior | FP shape | Examples |
|---|---|---|
| Per image, one in, one out | `map f` | invert, levels, halftone, crop, rotate, grid, printSet |
| Per image, one in, several out | `concatMap f` | split, rgbChannels, separateColors, cmykChannels |
| Whole list | list function or fold | copies, void, noop, stack, line, tile |

**Current combining constructs.**

| Construct | Combines | Actual semantics |
|---|---|---|
| Arrangement (top level) | steps | composition |
| `pipe` applicator | operations | composition |
| `flatMap` applicator | operations | each operation applied to the same list, results concatenated: `concat (map ($ xs) ops)` (Arrow fanout, then concat) |
| `zip` applicator | operations | operation *i* on image *i*: `concat (zipWith ($) ops (map pure xs))`; extra images dropped |
| group `all` | applicators | composition |
| group `each` | applicators | `concatMap pipeline xs`: the real flatMap (monadic bind on the image list) |

**Problems.**

1. "flatMap" names the wrong concept: the applicator is a fan-out; the group's `each` mode is the actual flatMap.
2. Composition is expressed three ways (top level, `pipe`, group `all`).
3. Applicators and groups are the same abstraction (a container plus a combining rule) at two levels, with different capabilities: only operations can be dragged; applicators cannot move between groups.
4. Combinators are not compositional: `flatMap` and `zip` combine only single operations, so pipelines cannot be fanned out or distributed.
5. The one-level limit on groups is an editor convenience, not a semantic rule.
6. Empty containers are inconsistent: an empty fan-out should yield nothing, but empty applicators are silently skipped (identity).
7. `zip` silently drops images beyond the number of operations, which is rarely what an artist wants.
8. `enabled` exists separately on applicators and groups with the same meaning.

**When "for each image" matters.** Per-image operations behave the same with or without it. It matters only when the inside contains whole-list operations (tile, stack, copies, line): the mode decides which list those operations see.

## Decision

Replace applicators and groups with one recursive algebra. Every node is a function from images to images: either an **operation** (leaf) or a **composition**: a container with a **mode** and children (operations or compositions, to any depth). In code and docs, "node" means operation or composition.

Modes answer *how* the children apply, so they are named as adverbial phrases ("a composition, in sequence"):

| Mode | Stored name | FP meaning | Meaning for artists |
|---|---|---|---|
| **In sequence** | `sequence` | composition (`>>>`) | Do these in order; each receives the previous one's output. |
| **In parallel** | `parallel` | fanout, then concatenate | Each receives the same images; all results are collected. |
| **Pairwise** | `pairwise` | zipWith over children | Child *n* receives image *n*. |
| **Per image** | `perImage` | concatMap (bind) | Runs the inside on each image separately; results in image order. |

### Operation shapes

Orthogonal to an operation's *kind* (what it does to pixels: tone, texture, shape and size), every operation declares its **shape** (what it does to the list):

| Shape | FP | Friendly | Operations |
|---|---|---|---|
| `map` | image → image, per image | **Per image** | invert, levels, halftone, crop, rotate, grid, printSet, … |
| `expand` | image → images, per image (concatMap) | **Splits** | split, rgbChannels, separateColors, cmykChannels |
| `combine` | images → image (fold) | **Combines** | stack, line, tile |
| `list` | images → images | **Whole set** | copies, void, noop |

Uses:
- **Laws.** *Per image* around only `map` and `expand` operations is the identity; it matters exactly when the inside contains `combine` or `list` operations, deciding which list they see. The editor can explain or flag this.
- **Counts before running.** Shapes determine output counts, so the editor can show image counts through the arrangement and catch mistakes such as combining nothing.
- **Safe optimizations.** Fuse consecutive `map`s into one GPU pass; run maps per image concurrently; skip *Per image* around maps only.
- **Registry.** The current "image count" and "layout" kinds conflate pixels and list behavior; they become derivable from shape.

Rules:

- **One composition construct.** The arrangement root is a Sequence. There is no separate arrangement, `pipe`, or group-`all` concept.
- **Bypass.** Any node can be bypassed; a bypassed node is the identity. Replaces `enabled` everywhere.
- **Empty containers.** An empty Sequence is the identity (unit of composition). An empty Parallel or Pairwise would yield nothing; the editor marks empty containers and treats them as bypassed until filled, as a visible, documented rule.
- **Pairwise remainder.** When there are more images than children: `cycle` (default; image *n* goes to child *n mod k*), `passThrough`, or `drop`. With fewer images than children, unused children produce nothing.
- **Depth.** Unlimited in the model. The editor renders each container as a card with an indented child list, can collapse deep cards, and supports dragging any node (operation or container) anywhere.
- **No generic "Group" label.** Compositions are labeled by their mode in the editor ("In parallel"); "Composition" names the concept in code and docs.

Example, the Warhol duotone grid:

```
Per image
  In sequence
    Levels
    In parallel
      Gradient map (navy → red) … Gradient map (green → yellow)
    Tile (3 per row)
```

### Mapping from the current model

| Current | New |
|---|---|
| `pipe` [ops] | In sequence [ops] |
| `flatMap` [ops] | In parallel [ops] (children may now be compositions) |
| `zip` [ops] | Pairwise [ops], remainder `drop` to preserve behavior (new default `cycle`) |
| group `all` | In sequence (disappears) |
| group `each` | Per image |
| arrangement | root composition, in sequence |

Nothing is persisted yet (ADR 0001 pending), so stored names change freely; the formula format in ADR 0001 adopts this algebra from its first version.

### Naming decisions

- **Composition** (accepted): the container node; means arrangement of elements in art and combining functions in FP.
- **Mode names as adverbial phrases** (proposed): *In sequence*, *In parallel*, *Pairwise*, *Per image*. Considered and rejected: *Parallel* alone (adjective beside the noun *Sequence*), *Branching* (in programming it means conditionals, choosing one path, the opposite of this mode), *Branches* (reads as a verb), *Group* (generic). Noun alternatives if phrases are not wanted: *Sequence / Ensemble*, *Sequence / Array* (collides with the programming term), *Sequence / Juxtaposition* (precise art term, long).

## Consequences

**Positive**

- One concept (composition + mode) instead of two; one composition construct; one bypass rule.
- Operation shapes make the combinators' effects predictable (laws, counts) and enable safe optimizations.
- Fan out and distribute whole pipelines; "for each image" around any part.
- Names that read naturally for artists and map precisely to FP terms (documented in tooltips and this ADR).
- Natural format for saved formulas (ADR 0001); the graph editor's DAG generalizes the same function type, so both can share one evaluator.

**Negative / costs**

- Rewrite of the arrangement editor (recursive cards, node-level drag and drop) and of the evaluator; recipes and tests convert mechanically.
- The local, undeployed groups commit (`e2547e3`) is superseded.
