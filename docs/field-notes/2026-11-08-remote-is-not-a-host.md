---
date: 2026-11-08
repo: jonashw/Warholizer
kind: correction
area: architecture
---

**Situation:** The knowledge base AA (Decision 4) added a `remote` run hint to Warholizer's registry and described it as running on Modal.

**Jon said:** "Why would you think `remote` exclusively indicates Modal? With respect to the Warholizer app, which presently runs all operations in the browser, wouldn't Cloudflare operations also be considered remote? Also, what good are those Cloudflare operations to the Warholizer app if they are exactly the same implementation?"

**Observed:** The hint had mixed two things: what an operation can do, and which host runs it. ADR 0004 Decision 2 now separates them: `main`/`worker`/`gpu`/`remote` describe capability; the caller picks where to run; the host is a deployment detail.

**Inferred (my reading):** Jon wants model terms that stay true when the deployment changes, and wants each shared implementation justified by what it gives each caller, not assumed.
