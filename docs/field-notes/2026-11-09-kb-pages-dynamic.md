---
date: 2026-11-09
repo: jonashw/Warholizer
kind: preference
area: architecture
---

**Situation:** Claude offered to "build the knowledge base pages" after the knowledge base tables were in place.

**Jon said:** "These would be dynamic webpages that read our db? I want that."

**Observed:** The site became a Cloudflare Worker that renders each page from D1 on request (apps/art), not a static site generated from the JSON tables.

**Inferred (Claude's reading):** Jon wants the knowledge base to be one live source the pages read, so a change to the data shows without a rebuild step.
