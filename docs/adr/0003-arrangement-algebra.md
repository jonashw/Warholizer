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

Replace applicators and groups with one recursive algebra. Every node is a function from images to images: either an **operation** (leaf) or a **container** with a **mode** and children (operations or containers, to any depth).

| Mode | Stored name | FP meaning | Meaning for artists |
|---|---|---|---|
| **Sequence** | `sequence` | composition (`>>>`) | Do these in order; each receives the previous one's output. |
| **Parallel** *(name pending, see below)* | `parallel` | fanout, then concatenate | Each receives the same images; all results are collected. |
| **Pairwise** | `pairwise` | zipWith over children | Child *n* receives image *n*. |
| **For each image** | `perImage` | concatMap (bind) | Runs the inside on each image separately; results in image order. |

Rules:

- **One composition construct.** The arrangement root is a Sequence. There is no separate arrangement, `pipe`, or group-`all` concept.
- **Bypass.** Any node can be bypassed; a bypassed node is the identity. Replaces `enabled` everywhere.
- **Empty containers.** An empty Sequence is the identity (unit of composition). An empty Parallel or Pairwise would yield nothing; the editor marks empty containers and treats them as bypassed until filled, as a visible, documented rule.
- **Pairwise remainder.** When there are more images than children: `cycle` (default; image *n* goes to child *n mod k*), `passThrough`, or `drop`. With fewer images than children, unused children produce nothing.
- **Depth.** Unlimited in the model. The editor renders each container as a card with an indented child list, can collapse deep cards, and supports dragging any node (operation or container) anywhere.
- **No generic "Group" label.** Containers are labeled by their mode in the editor. Code and docs need a term for "operation or container" *(pending, see below)*.

Example, the Warhol duotone grid:

```
For each image
  Sequence
    Levels
    Parallel
      Gradient map (navy → red) … Gradient map (green → yellow)
    Tile (3 per row)
```

### Mapping from the current model

| Current | New |
|---|---|
| `pipe` [ops] | Sequence [ops] |
| `flatMap` [ops] | Parallel [ops] (children may now be containers) |
| `zip` [ops] | Pairwise [ops], remainder `drop` to preserve behavior (new default `cycle`) |
| group `all` | Sequence (disappears) |
| group `each` | For each image |
| arrangement | root Sequence |

Nothing is persisted yet (ADR 0001 pending), so stored names change freely; the formula format in ADR 0001 adopts this algebra from its first version.

### Open naming decisions

- **Fan-out mode:** *Parallel* (preferred: noun, natural opposite of Sequence, circuit analogy is accurate; risk: may read as a performance or concurrency setting, mitigated by a tooltip) versus *Variations* (art-native, names the result) or *Side by side*.
- **Generic node term (code and docs):** *Composition* (preferred: arrangement of elements in art, combining functions in FP) versus *Stage* or *Combinator*.

## Consequences

**Positive**

- One concept (container + mode) instead of two; one composition construct; one bypass rule.
- Fan out and distribute whole pipelines; "for each image" around any part.
- Names that read naturally for artists and map precisely to FP terms (documented in tooltips and this ADR).
- Natural format for saved formulas (ADR 0001); the graph editor's DAG generalizes the same function type, so both can share one evaluator.

**Negative / costs**

- Rewrite of the arrangement editor (recursive cards, node-level drag and drop) and of the evaluator; recipes and tests convert mechanically.
- The local, undeployed groups commit (`e2547e3`) is superseded.
