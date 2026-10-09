# ADR 0001: Cloud storage for source images and formulas

- **Status:** Proposed
- **Date:** 2026-10-08
- **Deciders:** @jonashw

## Context

Warholizer is moving from a purely local, in-browser tool to one with a cloud layer. Goals:

1. **Continuity between devices.** Start something on the phone, continue on the laptop (and vice versa).
2. **Immutable source images.** Originals are retained exactly as captured; derived images are always reproducible.
3. **Persisted "formulas."** Raster operation pipelines/graphs are saved, versioned, and associated with the images they were applied to.
4. **Room to open the app to other users** later without re-architecting.

Current state (as of `c643147`):

- Netlify hosts the SPA and serverless functions (`api/`).
- Neon serverless Postgres via Drizzle (`db/schema.ts`) holds `users`, `user_logins`, and `uploads`.
- Google sign-in is implemented (test pages only).
- `api/upload_post.mts` stores uploads as **base64 text in Postgres**.

Key constraint discovered during analysis: Netlify Functions accept a maximum request payload of 6 MB, and binary payloads are base64-encoded in transit, so the **effective upload limit through a function is about 4.5 MB** ([Netlify forum](https://answers.netlify.com/t/maximum-body-size-for-netlify-function-post/22607)). Ordinary phone photos frequently approach or exceed this. Because originals must be kept unmodified, downscaling before upload is not an acceptable workaround.

## Options considered

| Option | Summary |
|---|---|
| **A. Neon only** (status quo) | Bytes as base64 (or bytea) in Postgres alongside metadata. |
| **B. Neon + Netlify Blobs** | Metadata in Neon; bytes in Netlify Blobs, written and read through functions. |
| **C. Neon + Cloudflare R2** | Metadata in Neon; bytes in R2 via presigned direct uploads from the browser. |
| **D. Supabase** | Replace Neon with Supabase Postgres + Storage (+ optionally Auth, Realtime). |
| **E. Firebase** | Replace Neon and auth with Firestore + Cloud Storage + Firebase Auth. |

AWS S3 was considered and set aside: it offers the same S3 API as R2, with egress fees and IAM overhead that buy nothing extra at this scale.

## Decision matrix

Scores: 1 (poor) to 5 (best). Weights in parentheses.

| Criterion | A. Neon only | B. Neon + Blobs | C. Neon + R2 | D. Supabase | E. Firebase |
|---|---|---|---|---|---|
| Image bytes: large files, uploads from a phone (×3) | 1 | 3 | **5** | 4 | 4 |
| Formulas and relational metadata (×2) | 5 | 5 | 5 | 5 | 3 |
| Cost now and with more users (×2) | 2 | 4 | **5** | 3 | 3 |
| Effort from current code (×2) | 5 | **5** | 3 | 2 | 1 |
| Phone ↔ laptop continuity (×2) | 3 | 3 | 3 | 4 | **5** |
| Portability / lock-in (×1) | 5 | 2 | 4 | 4 | 1 |
| Serving images: CDN, caching (×1) | 1 | 3 | **5** | 4 | 4 |
| **Weighted total** | 41 | 48 | **56** | 48 | 41 |

### Rationale per option

- **A. Neon only.** Excellent for formulas, poor for pixels. Base64 adds 33% overhead, every image is served through a function, uploads are capped at ~4.5 MB, and the free plan has 1 GB per project ([Neon](https://neon.com/blog/neon-free-plan-1-gb-per-project)).
- **B. Neon + Netlify Blobs.** No new vendor or credentials; minimal setup from inside functions. The browser cannot upload to Blobs directly, so uploads remain subject to the function payload limit unless chunked uploads are built. Images are served through a function (cacheable with immutable headers).
- **C. Neon + Cloudflare R2.** The browser uploads directly to a presigned URL, so the function payload limit doesn't apply. Standard S3 API (portable), free tier, no egress fees, can be fronted by a custom domain and CDN. Costs: a new account, API keys, CORS configuration, and a small function that issues upload URLs.
- **D. Supabase.** Strong all-in-one (Postgres, storage with row-level security, signed uploads, realtime). Requires migrating off Neon; free projects pause when idle.
- **E. Firebase.** Best continuity story (offline persistence, realtime listeners). Requires rewriting auth and data access; a document store fits lineage queries ("which images used this formula?") poorly. Cloud Storage now requires the pay-as-you-go Blaze plan, even within the free tier ([Firebase FAQ](https://firebase.google.com/docs/storage/faqs-storage-changes-announced-sept-2024)).

## Decision

Adopt **Option C: Neon for metadata and formulas, Cloudflare R2 for image bytes.**

Regardless of vendor, apply these design rules, which matter more than the vendor choice:

1. **Content-addressed images.** Image bytes are keyed by their SHA-256 hash (e.g. `images/<sha256>`). This gives immutability, deduplication, and safe `Cache-Control: immutable` serving for free. Postgres holds an `images` table keyed by hash with metadata (owner, MIME type, dimensions, original filename, created_at).
2. **Storage behind a narrow interface.** Server code talks to an `ImageStore` (`put`, `get`/`url`, `has`), so swapping R2 for Netlify Blobs or another S3-compatible store is a local change.
3. **Formulas as versioned, serialized documents.** Formulas are stored in Postgres as JSON with an explicit schema version, so the format can evolve as raster operation models change. Applying a formula to an image is recorded as lineage (`source image hash`, `formula id/version`), not as a stored derived image; derived images are reproducible and may be cached but are never the source of truth.
4. **Local-first client cache.** The browser keeps images and formulas in IndexedDB or the Origin Private File System (OPFS). Sync reduces to "upload hashes the server lacks; fetch hashes the client lacks." This is what makes phone ↔ laptop feel continuous, independent of backend.

## Consequences

**Positive**

- No upload size problem for original photos.
- Immutable, deduplicated, cheaply cached image storage.
- Existing Neon, Drizzle, and Google auth work is kept.
- Low lock-in: S3 API plus Postgres.

**Negative / costs**

- A second vendor account (Cloudflare) and secrets to manage in Netlify environment variables.
- CORS configuration on the R2 bucket for direct browser uploads.
- The existing `uploads` table (base64 in Postgres) becomes legacy and needs a migration path or removal.
- The client must compute SHA-256 before upload (cheap via `crypto.subtle.digest`).

**Revisit if**

- Upload sizes stay small in practice and a second vendor feels like overkill: fall back to Option B behind the same `ImageStore` interface.
- Realtime multi-device collaboration becomes a requirement: reconsider D or E.
