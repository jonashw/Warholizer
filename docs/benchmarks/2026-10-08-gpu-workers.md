# Benchmark: WebGL2 kernels inside workers, 2026-10-08

Question: does running the GPU kernels inside workers (each worker owns a WebGL2 context) remove main-thread freezes without losing GPU speed? Same machine as earlier runs; the browser pane was hidden for this run (timer ticks verified unthrottled, ~3 ms), so compare engines within this document rather than against earlier documents.

## Gallery as the UI renders it: 12 previews at 1024², each drawn into a canvas, no pixel readback

Median of 3. Total ms / longest main-thread stall ms.

| Operation | GPU (main thread) | GPU workers | CPU workers |
|---|---:|---:|---:|
| threshold | **2 / 2** | 5 / 1 | 59 / 5 |
| noise | **1 / 1** | 6 / 3 | 72 / 5 |
| levels | **2 / 2** | 8 / 3 | 50 / 5 |
| quantize | **1 / 1** | 29 / 5 | 568 / 6 |
| halftone | 10 / 10 | **9 / 2** | 72 / 6 |
| rgbChannels | 7 / 7 | **9 / 3** | 127 / 5 |

## `/benchmark` page (forces a pixel readback per output), median ms per `apply`

| Operation | 2048² GPU (main) | 2048² GPU workers | 2048² CPU (main) |
|---|---:|---:|---:|
| threshold | 2.0 | 4.4 | 29.0 |
| noise | 2.1 | 4.6 | 75.0 |
| levels | 1.7 | 4.4 | 26.5 |
| quantize | 2.1 | 11.0 | 79.4 |
| halftone | 8.3 | 9.9 | 39.6 |
| rgbChannels | 5.6 | 10.2 | 115.6 |
| separateColors | 8.1 | 22.1 | 284.9 |

## Findings

- **The main-thread GPU engine barely blocks.** Shader work is queued, not waited on, so for a gallery it stalls the main thread 1–10 ms. The 16–51 ms "froze" numbers in the earlier GPU benchmark were dominated by that page's own `getImageData` readback, which the real UI does not do.
- **GPU workers add latency** (transfer to and from the worker, about 2–9 ms per call at 2048²) and only reduce stalls for operations with substantial Canvas 2D composition or several outputs (`halftone` 10 → 2 ms, `rgbChannels` 7 → 3 ms).
- **Palette caching does not cross the worker boundary**: each request sends a fresh copy of the input, so `quantize` and `separateColors` recompute the palette per call in workers.
- **CPU kernels in workers are slow for palette operations** (quantize 568 ms per gallery), which matters only as the no-WebGL2 fallback.

Decision: keep the main-thread GPU engine as the default for `gpu`-hinted operations. Keep the GPU worker engine available (`getGpuWorkerEngine`, the filter gallery's engine picker, `/benchmark`). Revisit when an operation's Canvas 2D composition grows (e.g. a full halftone shader would remove the main-thread composition instead), or for very large images.
