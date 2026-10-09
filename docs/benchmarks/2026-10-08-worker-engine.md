# Benchmark: worker engine vs main thread, 2026-10-08

ADR 0002 step 3. Collected from `/benchmark` after the worker-backed engine landed. Same environment as the [baseline](2026-10-08-baseline.md): Chromium 152 (Claude desktop browser pane), macOS, 10 cores, Vite dev server. Worker pool size: 4 (`min(4, cores - 1)`).

## Filter gallery: 12 concurrent previews of one operation at 1024×1024

"Total" is wall time to render all 12. "Froze" is the longest gap between main-thread timer ticks during rendering, i.e. how long the page was unresponsive.

| Operation | Main thread: total / froze (ms) | Workers: total / froze (ms) |
|---|---:|---:|
| noise | 286.7 / 286.8 | **105.0 / 12.6** |
| rgbChannels | 163.9 / 164.1 | **118.2 / 28.4** |
| halftone | 139.4 / 139.5 | **92.4 / 7.5** |
| threshold | 129.6 / 129.7 | **69.7 / 9.0** |
| blur | **19.5** / 19.6 | 30.8 / 19.6 |
| grayscale | **10.3** / 10.3 | 15.2 / 11.4 |

## Single operation, median ms per `apply` (selected)

| Operation | 1024² main | 1024² worker | 2048² main | 2048² worker |
|---|---:|---:|---:|---:|
| noise | 23.9 | 24.8 | 88.9 | 91.8 |
| rgbChannels | 17.1 | 28.0 | 64.7 | 82.7 |
| halftone | 14.1 | 13.2 | 42.2 | 41.4 |
| threshold | 10.2 | 10.6 | 31.9 | 34.7 |
| printSet | 4.4 | 8.0 | 15.8 | 26.2 |
| blur | 2.0 | 2.6 | 4.6 | 6.0 |
| noop | 0.3 | 1.0 | 0.3 | 1.7 |

## Observations

- **Heavy per-pixel operations** (`noise`, `rgbChannels`, `halftone`, `threshold`): with workers, the UI stays responsive (freezes drop from 130–290 ms to 7–28 ms) and galleries finish 1.4–2.7× sooner because previews run in parallel.
- **Transfer overhead** is roughly 0.5–2 ms per call at 1024² and 1.5–6 ms at 2048², more for multi-output operations (`rgbChannels` returns three images). Part of it (creating bitmaps to send, drawing received bitmaps) still runs on the main thread.
- **Cheap GPU-backed operations** (`blur`, `grayscale`, `invert`, geometry, layout) are slower through workers: the transfer costs more than the operation, and the main thread does the conversion work anyway.

Implication: route by operation cost. The step 4 operation registry should carry an execution hint (or kind) so cheap operations run on the main thread and per-pixel operations go to workers, until the GPU path (step 5) makes per-pixel operations cheap too.
