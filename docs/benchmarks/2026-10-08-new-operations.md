# Benchmark: new operations, 2026-10-08

Gradient map, posterize, ordered dither, edges, color key, CMYK channels, color halftone (GPU kernels), and error-diffusion dither, sticker border, connected color key (sequential CPU in workers).

## GPU operations, median ms per `apply` (browser pane, includes a pixel readback)

| Operation | 1024² CPU kernels | 1024² GPU | 2048² CPU kernels | 2048² GPU |
|---|---:|---:|---:|---:|
| gradientMap | 108.6 | 1.3 | 327.5 | 2.0 |
| posterize | 9.6 | 1.2 | 30.8 | 1.7 |
| orderedDither | 21.3 | 1.5 | 64.5 | 2.2 |
| edges | 81.1 | 1.2 | 267.5 | 1.9 |
| cmykChannels | 185.2 | 5.1 | 593.6 | 7.3 |
| colorHalftone | 324.6 | 15.4 | 981.3 | 31.0 |

## Sequential CPU operations (run in workers), headless Chromium, median ms

The browser pane was hidden during the in-app runs, and Chromium deprioritizes hidden renderers: the same operations measured 2–8× slower and inconsistently there. These numbers come from headless Chromium at normal priority.

| Operation | 1024² | 2048² |
|---|---:|---:|
| errorDiffusion, mono, 2 levels | 31 | 111 |
| errorDiffusion, color, 3 levels | 61 | 253 |
| colorKey, connected (flood fill) | 16 | 55 |
| stickerBorder (exact distance transform) | 42 | 165 |

Routed through workers, main-thread stalls stay around 5–15 ms. A typed-array rewrite of the error-diffusion loop measured within noise of the straightforward version (V8 optimizes it well), which suggests WebAssembly's headroom here is modest.

## Decisions

- No WebAssembly for now: the per-pixel operations are already on the GPU (WebAssembly would be 10–50× slower there), composition uses GPU-accelerated Canvas 2D, and the sequential algorithms are fast enough in workers at typical sizes. Revisit for error diffusion or the distance transform if 2048²+ interactivity matters, or consider WebGPU compute (e.g. jump flooding for distance transforms).
- `colorKey` runs on the GPU in global mode and in a worker in connected mode (parameter-dependent execution hint).
