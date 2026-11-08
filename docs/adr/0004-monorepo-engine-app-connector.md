# ADR 0004: Monorepo: one engine for the app and the Art connector

- **Status:** Proposed (the monorepo itself and the hosting split are approved; the choices below are open for review)
- **Date:** 2026-11-08
- **Deciders:** @jonashw

## Context

Warholizer's engine (37 operations in five kinds, [ADR 0002](0002-raster-operation-taxonomy-and-execution.md)) and Composer ([ADR 0003](0003-arrangement-algebra.md)) are wanted outside the app: from any Claude project, through an **Art connector** (an MCP server added once to a claude.ai account), and from pages built on the art knowledge base. These were decided outside this repo, in the alternatives analysis *Knowledge Base Forms* (Decisions 1a, 3, 3 reopened, 4) and approved on 2026-11-08:

1. **Monorepo.** Warholizer becomes a monorepo holding the engine as a shared package, the existing web app, and the connector. The face-blanking scripts from the move library (wipe, sculpt, skin fill, grow, tone match) move in. Warholizer stays a stills tool.
2. **Hosting.** A Cloudflare Worker is the front door: sign-in, the MCP server, job state, and images in the R2 bucket Warholizer already uses. Every CPU operation runs on Cloudflare; WebGL operations run on the CPU through SwiftShader in Cloudflare's headless Chromium (Browser Rendering). Modal runs only the Look B face pass, in the background, and calls back. Canon faces are precomputed; the Look A skin fill is the instant stand-in. The knowledge base database is Cloudflare D1.
3. **First build step.** Confirm WebGL2 works in Cloudflare's headless browser and measure its speed.
4. **One proof record.** [ADR 0001](0001-cloud-storage-for-images-and-formulas.md)'s lineage record (source image hash, formula and version) is the proof record. Warholizer's database holds how a proof was made; the knowledge base holds why.
5. **Vocabulary.** The model's types (Suite, theme, dimension, variant, variation; semantic rewrite) replace Composer's *cube*, and Composer's **Variations** step becomes **Vary**.

This ADR turns that direction into a repo layout, an order of work, and the choices the direction left open. Every choice with real alternatives has its own weighted comparison below, nested under the decision it serves. Scores are 1 (poor) to 5 (best); weights sum to 1.

## Decision 1: repo layout

```
warholizer/
  package.json              # workspace root: scripts that run every package's lint, tests and build
  apps/
    web/                    # today's SPA, Netlify functions (api/), Drizzle schema (db/) and migrations/
  packages/
    engine/                 # operations, kernels, registry, worker and GPU engines, Composer's model
                            # (suite, evaluate, recipes, formats, migrations of saved documents); no React
    engine-host/            # a static page that loads the engine in any headless browser and exposes
                            # apply/evaluate to a driver; used by the connector and by the engine's tests
  services/
    connector/              # Cloudflare Worker: MCP server and OAuth, jobs in Durable Objects,
                            # R2 images, D1 knowledge base, Browser Rendering driving engine-host
    faces/                  # Python on Modal: Look A skin fill (CPU) and Look B pass (GPU), with callback
  docs/                     # ADRs, benchmarks, field notes, setup (stays at the root)
```

What moves where:

| Today | Goes to | Notes |
|---|---|---|
| `src/Warholizer/RasterOperations/PureRasterOperation/` (minus editors, icons, inline editor) | `packages/engine/src/operations/` | Already React-free except one `CSSProperties` type import in `types.ts`, which becomes a local type. |
| `src/Composer/*.ts` (not `ui/`) | `packages/engine/src/composer/` | Already React-free; imports only the engine and `NumberTypes`. |
| `src/NumberTypes.ts`, `src/sampleOperations.ts` | `packages/engine/src/` | Shared by both. |
| Everything else in `src/`, `api/`, `db/`, `migrations/`, `public/`, `index.html`, Vite and Netlify config | `apps/web/` | `netlify.toml` gains `base = "apps/web"`. |
| `palette/subjects/blank_faces/*.py` in the project files | `services/faces/` | Only the scripts the chosen looks use; the FLUX and Qwen experiments stay behind as notes. |

### Decision 1a: workspace tooling

| Criterion | Weight | npm workspaces | pnpm workspaces | Turborepo over npm | Nx |
|---|---|---|---|---|---|
| Change from today (npm, `package-lock.json`, Netlify, CI) | 0.30 | **5** | 3 | 4 | 2 |
| Runs one package's tests and build alone | 0.20 | 4 | 4 | **5** | **5** |
| Netlify and Cloudflare build support without extra setup | 0.20 | **5** | 4 | 4 | 3 |
| Speed of CI at this size (four packages) | 0.10 | 3 | 4 | **5** | **5** |
| Fewest new tools and config files | 0.20 | **5** | 4 | 3 | 1 |
| **Weighted total** | 1.00 | **4.60** | 3.70 | 4.10 | 2.90 |

**Choose npm workspaces.** Four packages don't need a build orchestrator; `npm run test --workspace packages/engine` covers running one package alone. Turborepo can be added later on top of npm workspaces without moving anything, if CI gets slow.

### Decision 1b: where Composer's model lives

| Criterion | Weight | One `engine` package (operations + Composer model) | Two packages (`operations`, `composer`) | Composer model stays in the app |
|---|---|---|---|---|
| The connector gets everything it needs from one import | 0.30 | **5** | 4 | 1 |
| Dependency direction is enforced (operations never import Composer) | 0.20 | 3 | **5** | 3 |
| Effort of the move | 0.25 | **5** | 3 | 4 |
| One version for a saved document's format and the code that reads it | 0.25 | **5** | 4 | 2 |
| **Weighted total** | 1.00 | **4.60** | 3.95 | 2.40 |

**Choose one `engine` package**, with `operations/` and `composer/` as folders and a lint rule that `operations/` never imports `composer/`. Split it only if some caller wants operations without Composer.

## Decision 2: what the run hint means

Warholizer's registry gives every operation an execution hint: `main`, `worker` or `gpu`. The knowledge base AA first added `remote` as "runs on Modal". Jon asked why `remote` should mean Modal only, since the connector's Cloudflare operations are also remote to the browser, and what an identical Cloudflare implementation gives the app. Corrected reading, agreed with the knowledge base thread:

- **The hint says what an operation can do, not where it runs.** `main`, `worker` and `gpu` operations can run in a browser, so the app runs them locally and the connector runs the very same code in a headless browser. **`remote`** marks an operation that can only run off the caller's machine; today that is only the Look B face pass. The host (Cloudflare or Modal) is a deployment detail the hint doesn't name.
- **The caller decides where to run.** The app runs locally whenever it can; the connector always runs remotely, because a Claude project has no browser of its own.
- **One implementation, on purpose.** The same formula, seed and model version give the same proof wherever it ran, so a proof made through the connector opens in the app unchanged, and the existing parity tests cover both callers. The Cloudflare copy gives the app nothing for operations it can already run; its gains are the operations it can't run (face blanking), and a **shared proof cache keyed by lineage** (input hash, formula and version, seed, model version), so a proof made once anywhere is instant everywhere.
- A `remote` operation is slow, paid, can fail and is pure only by contract, so it returns a job at once, shows its stand-in (Look A for face blanking) and is counted and deduplicated before a run (count of distinct new inputs after the cache, one batch per job, remote steps before a fan-out, a spending gate).

## Decision 3: how the connector runs engine operations

Approved: on Cloudflare, with WebGL drawn in software. Open: the mechanism.

| Criterion | Weight | Browser Rendering drives `engine-host` | Cloudflare Container with Chromium and Playwright | CPU kernels inside the Worker |
|---|---|---|---|---|
| Same code as the app, so parity tests carry over | 0.30 | **5** | **5** | 2 |
| Runs WebGL operations | 0.20 | 4 (to confirm) | 4 (to confirm) | 1 |
| Start-up time per call | 0.15 | 4 | 3 | **5** |
| Fewest moving parts | 0.15 | 4 | 3 | **5** |
| Cost at Jon's volume | 0.10 | 4 | 3 | **5** |
| Session length for a large suite | 0.10 | 3 | **5** | 2 |
| **Weighted total** | 1.00 | **4.20** | 4.00 | 3.00 |

**Choose Browser Rendering driving `engine-host`.** The Worker opens `engine-host` in Cloudflare's headless Chromium, passes R2 addresses and a formula, and gets back R2 hashes; pixels never pass through the Worker, which has no canvas. **CPU kernels inside the Worker** loses because Workers have no `OffscreenCanvas`, so it means a second implementation that drifts. A **Container** is the fallback if Browser Rendering's session limits or WebGL support fall short. The first build step (below) decides this.

## Decision 4: databases

| Criterion | Weight | Keep Neon for the app; D1 for the knowledge base; the Worker reads Neon through Hyperdrive | Move the app's tables to D1 too | Put the knowledge base in Neon |
|---|---|---|---|---|
| Effort now | 0.30 | **5** | 2 | 4 |
| Agrees with approved Decision 1a (knowledge base in D1) | 0.20 | **5** | **5** | 1 |
| One place to query proofs (how) next to the knowledge base (why) | 0.20 | 3 | **5** | **5** |
| The app's existing API keeps working on Netlify | 0.20 | **5** | 2 | **5** |
| Fewest platforms | 0.10 | 3 | 4 | 4 |
| **Weighted total** | 1.00 | **4.40** | 3.40 | 3.80 |

**Choose two databases for now.** Proofs stay in Neon, where the app writes them today; the Worker reads them through Hyperdrive, Cloudflare's Postgres connection pool. Moving the app's tables to D1 is worth revisiting once the app's API moves behind the Worker, which this ADR doesn't propose.

## Decision 5: web app hosting

| Criterion | Weight | Stay on Netlify | Move to Cloudflare (Workers static assets) |
|---|---|---|---|
| Effort now | 0.35 | **5** | 2 |
| Deploys and previews keep working | 0.25 | **5** | 3 |
| One platform for app and connector | 0.20 | 2 | **5** |
| Same sign-in for app and connector | 0.20 | 3 | **5** |
| **Weighted total** | 1.00 | **4.00** | 3.45 |

**Stay on Netlify.** The connector's OAuth uses Google sign-in, as the app does, so one Google account is one person in both, even on two platforms.

## Order of work

Each step is its own pull request, with CI green and no change in what the app does unless the step says so.

1. **WebGL2 spike** (needs a Cloudflare API token): bundle `engine-host` from today's code, open it in Browser Rendering, run the GPU kernels and the full test sample, and record speed at 1024² and 2048² next to [docs/benchmarks](../benchmarks). Settles Decision 3 before anything moves.
2. **Workspaces move**: `git mv` into the layout above, npm workspaces, CI and Netlify pointed at `apps/web`. Same app, same tests, same deploy preview.
3. **Suite vocabulary**: cube → suite, member → variant, cell → variation, Variations → Vary, in code, UI and ADR 0003 (marked superseded in wording). Saved compositions use `kind: 'variations'`, so `migrate.ts` gains a version that renames it; old public links keep opening.
4. **Run hints**: add `remote` to `ExecutionHint` as in Decision 2; the engine refuses to run a `remote` operation locally and asks the caller for a job instead.
5. **Connector skeleton**: Worker with Cloudflare's MCP server kit and OAuth provider (Google sign-in); tools `list_operations` (from the registry), `apply` and `evaluate` (through `engine-host`); proofs written as lineage records; the proof cache.
6. **Faces service**: scripts into `services/faces/`; a `removeFace` operation (`remote`), jobs in Durable Objects, Modal callback, Look A stand-in; canon faces precomputed in one batch.
7. **Principle 1 wording**: face detection a person asks for on their own image is processing, not the product analysis the principle forbids. Change the wording before face blanking reaches the app.

## Consequences

**Positive**

- One implementation of every operation serves the app, the connector and pages, so a proof is the same wherever it was made.
- Claude projects run Warholizer operations without a browser, and never wait for a GPU except for Look B, which runs in the background.
- The engine is testable and versioned on its own.

**Negative / costs**

- Three platforms (Netlify, Cloudflare, Modal) and two databases (Neon, D1).
- Moving files breaks `git blame` continuity for the engine unless read with `--follow`.
- A Cloudflare API token and a Modal endpoint key live in the connector's deployment settings (never in a project).

**Revisit if**

- WebGL2 is missing or too slow in Browser Rendering: Decision 3 falls to a Container, or to CPU reference kernels for those operations.
- The app's API moves behind the Worker: revisit Decisions 4 and 5 together.
