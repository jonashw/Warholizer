# Benchmark: WebGL2 pixel kernels, 2026-10-08

ADR 0002 step 5. Same environment as the [baseline](2026-10-08-baseline.md) (Chromium 152 in the Claude desktop browser pane, macOS, 10 cores, hardware GPU, Vite dev server). Engines: main thread (CPU kernels), workers (CPU kernels, pool of 4), GPU (WebGL2 kernels, main thread), routed (default: hint per operation).

## Single operation, median ms per `apply`

| Operation | 1024² CPU | 1024² GPU | 2048² CPU | 2048² GPU | Speedup at 2048² |
|---|---:|---:|---:|---:|---:|
| noise | 20.1 | 1.3 | 75.8 | 2.0 | 38× |
| rgbChannels | 29.8 | 4.3 | 112.8 | 5.7 | 20× |
| threshold | 9.6 | 1.3 | 29.7 | 1.7 | 17× |
| halftone | 12.1 | 3.8 | 40.3 | 8.6 | 4.7× |

`halftone` keeps its Canvas 2D composition (grayscale, blur, rotated dot pattern, color-burn) and only its final threshold moved to the GPU, so its gain is smaller.

## Filter gallery: 12 concurrent previews at 1024²

| Operation | Main: total / froze | Workers: total / froze | GPU: total / froze | Routed: total / froze |
|---|---:|---:|---:|---:|
| noise | 239.0 / 239.0 | 84.0 / 19.5 | 18.9 / 19.0 | 19.4 / 19.4 |
| threshold | 111.5 / 111.5 | 62.0 / 12.0 | 18.5 / 18.5 | 17.3 / 17.6 |
| halftone | 138.3 / 138.7 | 86.5 / 9.7 | 44.8 / 45.0 | 44.5 / 44.5 |
| rgbChannels | 339.6 / 339.6 | 138.1 / 25.5 | 43.4 / 43.4 | 46.3 / 46.6 |

## Observations

- The GPU makes per-pixel operations 4–38× faster and galleries 3–7× faster than workers.
- GPU kernels run on the main thread, so a gallery still blocks briefly (up to ~45 ms for 12 halftone or rgbChannels previews at 1024²). Workers keep the page responsive but finish later. Running the WebGL2 kernels inside workers (OffscreenCanvas WebGL2 is available there) would combine both; not done yet.
- The filter gallery (`/filter-gallery`) renders typical sweeps of 6–26 previews at 512² in roughly 1–11 ms of apply time.
