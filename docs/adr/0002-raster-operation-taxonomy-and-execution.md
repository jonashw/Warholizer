# ADR 0002: Raster operation taxonomy and execution strategy

- **Status:** Proposed
- **Date:** 2026-10-08
- **Deciders:** @jonashw

## Context

Warholizer has several editing models (the original `Warholizer.tsx` editor, the pure list editor, the graph editor, the progressive and immersive demos), all powered by the same engine: `PureRasterOperation` in `src/Warholizer/RasterOperations/PureRasterOperation/`. The multiplicity of models is a strength, and more may emerge, so the engine should be a stable foundation.

Problems:

1. **Confusing operation menu.** Layout operations and direct pixel manipulation are mixed together, and some names collide or overlap. For example, `multiply` means "emit n copies," but `multiply` is also a blending mode; `stack`, `line`, `tile`, and `grid` overlap conceptually.
2. **Performance.** Operations run on the main thread via `OffscreenCanvas` and Canvas 2D. Interactive "filter galleries" (previewing an operation across many parameter values or inputs at once) need substantially faster execution.
3. **New operations** (posterize, duotone, ordered and error-diffusion dithering, Ben-Day dots, edge detection) are the main creative goal and should land on a solid foundation.

## Operation taxonomy

Classifying current operations by signature (input count → output count, whether dimensions change, pixel locality):

| Kind | Signature | Operations |
|---|---|---|
| **Tone** | 1→1, same size, per-pixel | `invert`, `threshold`, `grayscale`, `rotateHue`, `fill`, `noise` |
| **Filter** | 1→1, same size, neighborhood | `blur`, `halftone` |
| **Geometry** | 1→1, size changes | `crop`, `scale`, `scaleToFit`, `rotate`, `slideWrap` |
| **Cardinality** | n→m, pixels unchanged | `multiply`, `split`, `rgbChannels`, `void`, `noop` |
| **Layout** | n→1 (or 1→larger) | `stack`, `line`, `tile`, `grid`, `printSet` |

## Decision

1. **Make kind a first-class property of every operation.** Each operation type declares its kind (tone, filter, geometry, cardinality, layout) in a registry alongside its default parameters, editor, and icon. Menus, galleries, and editors group by kind.
2. **Resolve naming collisions.** Rename operations whose names collide with other concepts (starting with `multiply` → e.g. `copies`/`repeat`), with a serialization migration so saved formulas keep working (see ADR 0001, versioned formulas).
3. **Execute off the main thread.** Move `apply`/`applyPipeline` into a Web Worker using transferable `OffscreenCanvas`/`ImageBitmap`. All editing models call the same worker-backed engine interface.
4. **Choose the execution backend by kind:**
   - **Tone** chains are fused into a single GPU fragment-shader pass (WebGL2 now, WebGPU when practical). This is the largest expected win and the enabler for live filter galleries.
   - **Filter** operations also map to GPU shaders (separable blur, halftone).
   - **Inherently sequential algorithms** (error-diffusion dithering) use WebAssembly.
   - **Geometry, cardinality, layout** stay on Canvas 2D; they are cheap and composition-oriented.
   - Canvas 2D remains the reference implementation and fallback.
5. **Measure first.** Before changing algorithms, add a benchmark page and unit tests for `apply.ts` so improvements are measurable and regressions are caught.

## Consequences

**Positive**

- A clearer mental model and menu for the user.
- The engine can plan execution (fuse adjacent tone ops, batch gallery renders).
- New editing models get performance and taxonomy for free.

**Negative / costs**

- A registry refactor touches every operation and editor.
- GPU and WASM paths need parity tests against the Canvas 2D reference.
- Renames require a formula serialization version bump and migration.

## Implementation order

1. Benchmark page plus unit tests for `apply.ts`.
2. Worker-backed engine interface used by all editing models.
3. Operation registry with kind; regroup the menu; rename collisions.
4. GPU path for tone/filter ops; filter gallery.
5. New operations, using WASM where sequential.
