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
   - **JavaScript per-pixel loops** (`getImageData`/`putImageData`) move to GPU fragment shaders (WebGL2 now, WebGPU when practical). The baseline shows these are the bottleneck: `noise`, `rgbChannels`, `threshold`, and `halftone`.
   - **Tone** chains are fused into a single shader pass where practical. Operations already built on `ctx.filter` or compositing (`blur`, `grayscale`, `invert`, `rotateHue`, `fill`) are GPU-accelerated by the browser and stay as they are unless fusion requires otherwise.
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

1. **Testing.** Unit tests for `apply.ts` (Vitest browser mode, real Chromium) plus a benchmark page. *Done 2026-10-08; see below.*
2. **Tech debt.** Dependency upgrades (Vite, MUI, React), replace deprecated `react-beautiful-dnd`, bring `npm run lint` back to passing. The tests from step 1 guard these changes. *Done 2026-10-08.*
3. **Worker-backed engine interface** used by all editing models. *Done 2026-10-08.*
4. **Operation registry** with kind; regroup the menu; rename collisions. *Done 2026-10-08.*
5. **GPU path** for per-pixel operations; filter gallery. *Done 2026-10-08.*
6. **New operations**, using WASM where sequential.

## Progress notes

### 2026-10-08: tests and baseline

- `npm test` runs `src/**/*.test.ts` in headless Chromium via Vitest browser mode. `apply.test.ts` covers every operation, grouped by kind.
- Baseline numbers: [docs/benchmarks/2026-10-08-baseline.md](../benchmarks/2026-10-08-baseline.md). The `/benchmark` route reproduces them.
- Known bugs found, recorded as `it.fails` tests (they will start "failing" once fixed, prompting removal of `.fails`):
  - `rotate` about `center` uses `width/2` for the y origin; 180° on non-square images renders off-canvas.
  - `rotate` 90°/270° on non-square images is squashed and clipped (AABB scaling applied to quarter turns).
  - `grid` guard checks `cols` twice instead of `rows`.
- Observed inconsistency (tested as current behavior, not yet classified as a bug): `slideWrap` shifts right along x but up along y.
- `noise` is non-deterministic (`Math.random`), which blocks exact tests and reproducible formulas. Consider a seed parameter.

### 2026-10-08: lint clean, engine bugs fixed

- `npm run lint` passes with zero errors and zero warnings. Along the way, fixed stale-closure bugs in the `PureGallery` and `InputsEditor` paste handlers (pasting dropped previously added inputs) and in `useContainerSize`.
- Fixed the three known engine bugs above; their tests are now ordinary passing tests. **This changes rendered output**: `rotate` 90°/270° on non-square images, and any non-quarter rotation about `center` on non-square images, now render correctly where they were previously squashed or offset.
- Fixed `line` and `tile` throwing on an empty input list (seen in the graph demos); they now return no outputs, like `stack`.
- Remaining console noise, not yet addressed: React "unique key" warnings in `Warholizer`, `GraphViewerDemo`, and `ProgressiveApplicationDemo`.

### 2026-10-08: tech debt (step 2) done

- Fixed the React "unique key" warnings above.
- Removed unused dependencies; Node 18 → 22 (`.nvmrc`; Vitest 5 and the server libraries need ≥ 22.12).
- Upgraded: Vite 5 → 8, Vitest 3 → 5, ESLint 8 → 10 (flat config), typescript-eslint 6 → 8, eslint-plugin-react-hooks 4 → 7, React 18 → 19, React Router 6 → 7, MUI 5 → 9, TypeScript 5.3 → 6.0, @netlify/functions 2 → 6, google-auth-library 10 → 11.
- Replaced deprecated `react-beautiful-dnd` with `@hello-pangea/dnd` (API-compatible fork).
- react-hooks 7 (React Compiler rules) surfaced effect-driven state updates; these now derive during render or tag async results with their inputs, so stale results can no longer overwrite newer ones.
- `npm run lint` now covers `api/`; `tsc` now covers `api/` and `db/`.
- Auth fixes: invalid token payloads were never rejected (`instanceof String` on a primitive), and malformed tokens returned 500 with a stack trace instead of 401.
- Deferred: TypeScript 7 (typescript-eslint supports < 6.1); `npm audit` reports 4 moderate findings, all via `drizzle-kit`'s bundled esbuild (development-time only).
- Open security question, not changed: `/api/users` is unauthenticated and returns all users' names, emails, and sign-in history.

### 2026-10-08: worker-backed engine (step 3) done

- `PureRasterOperation/engine/`: a `RasterEngine` interface with a main-thread implementation and a worker-pool implementation (up to 4 module workers; each request goes to the least busy one). `PureRasterOperations.apply` (and `applyPipeline`, `applyFlatMap`) now dispatch through the current engine, so applicators, graphs, galleries, and editors all use workers without changes. Falls back to the main thread where workers or `OffscreenCanvas` are unavailable.
- Engine seam is single-operation `apply`: graph and iterative editors display every intermediate result, so intermediates must return to the main thread regardless.
- Protocol: images cross as transferable `ImageBitmap`s; outputs that are inputs passed through (`noop`, `multiply`, ...) are returned by reference, preserving canvas identity; zero-area images are sent by size; worker errors and crashes reject the pending requests.
- Parity tests (`engine.test.ts`) compare worker output to the main-thread reference for every sample operation. They exposed a latent bug: `printSet` drew asynchronously but `apply` resolved before drawing finished (fixed in `offscreenCanvasOperation`; regression test added).
- Results: [docs/benchmarks/2026-10-08-worker-engine.md](../benchmarks/2026-10-08-worker-engine.md). Heavy per-pixel operations no longer freeze the UI and galleries run in parallel; cheap operations pay a transfer cost. Step 4's registry should carry an execution hint so cheap operations stay on the main thread.
- Not covered: the original Warholizer editor (`Warholizer.tsx`) mostly uses its own `ImageUtil` pipeline (threshold, quantize, tiling) and the legacy `RasterOperations` types, not `PureRasterOperation`. Consolidating it onto this engine is future work.

### 2026-10-08: operation registry (step 4) done

- `PureRasterOperation/registry.ts` is the single source of operation metadata: kind, label, description, default parameters, and execution hint. Its type requires an entry for every operation type, so a new operation cannot compile without one. `sampleOperations` now derives from it.
- Menus (add-operation dropdown, inline type picker, Explore modal) are grouped by kind and use human labels and descriptions instead of type names.
- Renamed `multiply` to `copies` (it emits n copies; "multiply" is also a blend mode). No operations are persisted yet, so no data migration was needed; ADR 0001's versioned formula format will start from the new names.
- The default engine routes by execution hint: per-pixel loop operations (`threshold`, `noise`, `halftone`, `rgbChannels`) to workers, the rest on the main thread. See the addendum in [docs/benchmarks/2026-10-08-worker-engine.md](../benchmarks/2026-10-08-worker-engine.md).
- The icon map is now complete (`halftone`, `noise`, `rgbChannels`, `printSet` previously fell back to a generic icon). Icons stay in `OperationIcon.tsx` so the registry remains plain data, usable outside React (e.g. formula validation on the server).
- `registry.test.ts` pins the taxonomy above, defaults, ordering, and routing.

### 2026-10-08: GPU kernels and filter gallery (step 5) done

- Split `apply` into shared Canvas 2D composition plus swappable **pixel kernels** (`kernels.ts`: `threshold`, `noise`, `rgbChannels`; `halftone` uses `threshold`). `createApply(kernels)` builds an engine; `cpuKernels` remain the reference implementation and fallback.
- `gpu/webglKernels.ts`: WebGL2 fragment-shader kernels on one shared OffscreenCanvas context, straight alpha end to end, `texelFetch` for exact per-pixel sampling, PCG hash for noise. Zero-area inputs and context loss fall back to the CPU kernels per call.
- New execution hint `gpu` for the four kernel-backed operations; the routed engine uses the GPU engine, or workers when WebGL2 is unavailable.
- Parity tests compare GPU against CPU kernels (threshold mismatches < 0.5% of pixels, only at rounding boundaries; rgbChannels within 2 units; halftone < 1%; noise checked statistically).
- Results: [docs/benchmarks/2026-10-08-gpu-kernels.md](../benchmarks/2026-10-08-gpu-kernels.md): 4–38× faster per-pixel operations at 2048².
- **Filter gallery** (`/filter-gallery`): pick an image and an operation; a live grid renders the operation across one parameter's values (registry `sweeps`); clicking a tile adopts the value. Previews draw through `CanvasView` (direct canvas copy, no data URLs).
- Fixed along the way: `byte`, `angle`, and `percentage` in `NumberTypes.ts` were accidentally generic (`<Byte>(input) => ...` declares a type parameter shadowing the type), so their return types were unchecked. Noted, not fixed: `PositiveNumber` resolves to `never`.
- Follow-ups: run WebGL2 kernels inside workers (GPU speed without main-thread blocking); port `halftone`'s composition to a single shader; new operations (posterize, duotone, dithering, Ben-Day dots, edge detection) as kernels, using WASM for error-diffusion dithering.

### 2026-10-08: new operations: quantize, separate colors, levels; visual crop

- **Quantize** (tone): median-cut palette (`palette.ts`; any color count, not only powers of two) mapped per pixel to the nearest palette color. Optional `replacements` recolor palette entries, ordered darkest to lightest so a replacement palette applies predictably. Carries over the original editor's quantizer as a composable operation.
- **Separate colors** (cardinality): one layer per palette color, others transparent; screenprint or stencil separations, recombinable with `stack`.
- **Levels** (tone): black point, white point, gamma.
- New "analysis then map" kernel pattern: the palette is computed on the CPU from a 128 px sample (histogram median split, O(n) per split) and cached per input canvas; mapping runs as a GPU kernel (`mapToPalette`, up to 64 colors) with a CPU reference. Engine canvases are treated as immutable, which makes the cache safe.
- **Visual crop**: the inline editor takes an optional `inputs` loader for the images flowing into the operation (`PureRasterApplicators.inputsForOp` for pipe/flatMap/zip, graph `inputsFor`, gallery input). With it, crop offers "Crop visually…", a `react-image-crop` dialog over those images, as in the original editor. Crops are stored in percent so they hold across resolutions and inputs.
- Gallery sweeps: quantize color count and five replacement palettes; separate colors count; levels gamma, black, and white.

### 2026-10-08: GPU kernels inside workers (evaluated)

- Workers can now run the WebGL2 kernels (`createWorkerEngine(size, 'gpu')`, `getGpuWorkerEngine`); requests carry which kernels to use. Parity tests confirm results match the main-thread GPU engine.
- Measured: [docs/benchmarks/2026-10-08-gpu-workers.md](../benchmarks/2026-10-08-gpu-workers.md). The main-thread GPU engine already stalls only 1–10 ms per 12-preview gallery; GPU workers add 2–9 ms latency per call and help only operations with heavy Canvas 2D composition. Default routing is unchanged; GPU workers remain selectable (filter gallery engine picker, `/benchmark`).

