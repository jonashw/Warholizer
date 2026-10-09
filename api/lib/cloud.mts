import type { User } from '../auth.mts';
import { ImageStore, originalKey, sha256Hex, thumbnailKey } from './imageStore.mts';
import { CompositionRow, ImageRow, Repo } from './repo.mts';

/**
 * Cloud library handlers (ADR 0001): images by SHA-256, compositions with immutable revisions,
 * and public links. Pure functions over a Repo and an ImageStore, so they are tested in memory.
 */

export type Result =
  | { status: number, body?: unknown }
  | { status: 302, redirect: string }
  | { status: 200, bytes: Uint8Array, contentType: string, immutable: boolean };

export type Context = { repo: Repo, store: ImageStore };

const ok = (body: unknown): Result => ({ status: 200, body });
const error = (status: number, message: string): Result => ({ status, body: { error: message } });

const isSha256 = (s: unknown): s is string => typeof s === 'string' && /^[0-9a-f]{64}$/.test(s);
export type Variant = 'original' | 'thumbnail';
const keyOf = (sha256: string, variant: Variant) => variant === 'original' ? originalKey(sha256) : thumbnailKey(sha256);

const randomId = (length: number) => {
  const alphabet = 'abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  return [...bytes].map(b => alphabet[b % alphabet.length]).join('');
};

// Images ---------------------------------------------------------------------------------------

export type PrepareRequest = { sha256: string, variant: Variant, contentType: string, byteSize: number };

/**
 * Limits that keep storage costs bounded (Cloudflare has no hard spending cap for R2): the largest
 * single file, and each person's library total. Set MAX_UPLOAD_BYTES and LIBRARY_QUOTA_BYTES to change them.
 */
export const limits = () => ({
  maxUploadBytes: Number(process.env.MAX_UPLOAD_BYTES ?? 60 * 1024 * 1024),
  libraryQuotaBytes: Number(process.env.LIBRARY_QUOTA_BYTES ?? 5 * 1024 * 1024 * 1024),
});

/** Where to upload an original or thumbnail; nothing to upload if the store already has it. */
export const prepareUpload = async ({ repo, store }: Context, user: User, req: PrepareRequest): Promise<Result> => {
  if (!isSha256(req.sha256)) return error(400, 'sha256 must be 64 hex characters');
  if (req.variant !== 'original' && req.variant !== 'thumbnail') return error(400, 'variant must be original or thumbnail');
  if (req.variant === 'thumbnail') {
    // Thumbnails are written once, by someone with the image in their library or a preview of theirs.
    const allowed = await repo.inLibrary(user.id, req.sha256) || await repo.ownsPreview(user.id, req.sha256) || !(await repo.getImage(req.sha256));
    if (!allowed) return error(403, 'Not your image');
  }
  const key = keyOf(req.sha256, req.variant);
  if (await store.has(key)) return ok({ exists: true });
  const { maxUploadBytes, libraryQuotaBytes } = limits();
  if (!(req.byteSize > 0)) return error(400, 'byteSize is required');
  if (req.byteSize > maxUploadBytes) return error(413, `Files can be up to ${Math.round(maxUploadBytes / 1024 / 1024)} MB`);
  if (req.variant === 'original') {
    const used = (await repo.library(user.id)).reduce((total, image) => total + image.byte_size, 0);
    if (used + req.byteSize > libraryQuotaBytes) {
      return error(413, `Your library is full (${(used / 1024 ** 3).toFixed(1)} of ${(libraryQuotaBytes / 1024 ** 3).toFixed(0)} GB)`);
    }
  }
  const contentType = req.variant === 'thumbnail' ? 'image/jpeg' : req.contentType || 'application/octet-stream';
  return ok({ exists: false, upload: await store.uploadTarget(key, contentType, `/api/images/${req.sha256}/${req.variant}/bytes`) });
};

/** The Blobs fallback's upload path: bytes through the function, verified against their hash. */
export const putBytes = async ({ store }: Context, sha256: string, variant: Variant, bytes: Uint8Array, contentType: string): Promise<Result> => {
  if (!isSha256(sha256)) return error(400, 'Bad sha256');
  if (variant === 'original' && await sha256Hex(bytes) !== sha256) return error(400, 'Bytes do not match their SHA-256');
  await store.put(keyOf(sha256, variant), bytes, variant === 'thumbnail' ? 'image/jpeg' : contentType);
  return ok({ stored: true });
};

export type CommitRequest = {
  fileName: string, contentType: string, width?: number, height?: number,
  /** False for composition previews, which stay out of the library. */
  library?: boolean,
};

/**
 * Records an uploaded image. The first commit of new bytes verifies them against their hash (so no
 * one can plant other bytes under a hash); later commits only add the image to a library and fill
 * in missing dimensions and thumbnails.
 */
export const commitImage = async ({ repo, store }: Context, user: User, sha256: string, req: CommitRequest): Promise<Result> => {
  if (!isSha256(sha256)) return error(400, 'Bad sha256');
  await repo.ensureUser(user);
  let image = await repo.getImage(sha256);
  if (!image) {
    const bytes = await store.get(originalKey(sha256));
    if (!bytes) return error(409, 'Upload the original first');
    if (await sha256Hex(bytes) !== sha256) return error(400, 'Stored bytes do not match their SHA-256');
    image = {
      sha256, content_type: req.contentType || 'application/octet-stream', byte_size: bytes.length,
      width: req.width ?? null, height: req.height ?? null, has_thumbnail: await store.has(thumbnailKey(sha256)),
    };
    await repo.insertImage(image);
  } else {
    const patch: Partial<ImageRow> = {};
    if (image.width === null && req.width) patch.width = req.width;
    if (image.height === null && req.height) patch.height = req.height;
    if (!image.has_thumbnail && await store.has(thumbnailKey(sha256))) patch.has_thumbnail = true;
    if (Object.keys(patch).length) await repo.updateImage(sha256, patch);
    image = { ...image, ...patch };
  }
  if (req.library !== false) await repo.addToLibrary(user.id, sha256, (req.fileName || 'photo').slice(0, 255));
  return ok({ image });
};

export const listImages = async ({ repo }: Context, user: User): Promise<Result> =>
  ok({ images: (await repo.library(user.id)).map(i => ({
    sha256: i.sha256, fileName: i.file_name, width: i.width, height: i.height, byteSize: i.byte_size,
    contentType: i.content_type, hasThumbnail: i.has_thumbnail, addedAt: i.added_at,
  })) });

export const removeImage = async ({ repo }: Context, user: User, sha256: string): Promise<Result> => {
  await repo.removeFromLibrary(user.id, sha256);
  return ok({ removed: true });
};

/** Bytes for someone allowed to see them: a redirect to a short-lived URL, or the bytes themselves. */
const serve = async (store: ImageStore, sha256: string, variant: Variant, contentType: string): Promise<Result> => {
  const key = keyOf(sha256, variant);
  if (store.readUrl) return { status: 302, redirect: await store.readUrl(key) };
  const bytes = await store.get(key);
  if (!bytes) return error(404, 'Not stored');
  return { status: 200, bytes, contentType: variant === 'thumbnail' ? 'image/jpeg' : contentType, immutable: true };
};

export const readImage = async ({ repo, store }: Context, user: User, sha256: string, variant: Variant): Promise<Result> => {
  if (!isSha256(sha256)) return error(400, 'Bad sha256');
  if (!(await repo.inLibrary(user.id, sha256)) && !(await repo.ownsPreview(user.id, sha256))) return error(404, 'Not found');
  const image = await repo.getImage(sha256);
  if (!image) return error(404, 'Not found');
  return serve(store, sha256, variant, image.content_type);
};

// Compositions ---------------------------------------------------------------------------------

export type SaveRequest = { name: string, document: unknown, inputs: string[], preview?: string };

const summary = (c: CompositionRow) => ({
  id: c.id, name: c.name, revision: c.revision, preview: c.preview_sha256, updatedAt: c.updated_at, createdAt: c.created_at,
  share: { public: c.public_slug !== null, slug: c.public_slug, includeSources: c.share_sources, allowRemix: c.share_remix },
});

const checkSave = async (repo: Repo, user: User, req: SaveRequest): Promise<string | undefined> => {
  if (typeof req.name !== 'string' || !req.document || typeof req.document !== 'object') return 'name and document are required';
  if (!Array.isArray(req.inputs) || !req.inputs.every(isSha256)) return 'inputs must be SHA-256 hashes';
  for (const sha of req.inputs) {
    if (!(await repo.inLibrary(user.id, sha))) return 'Every input must be in your library';
  }
  if (req.preview !== undefined && (!isSha256(req.preview) || !(await repo.getImage(req.preview)))) return 'Unknown preview image';
  return undefined;
};

export const listCompositions = async ({ repo }: Context, user: User): Promise<Result> =>
  ok({ compositions: (await repo.compositionsOf(user.id)).map(summary) });

export const createComposition = async ({ repo }: Context, user: User, req: SaveRequest): Promise<Result> => {
  await repo.ensureUser(user);
  const problem = await checkSave(repo, user, req);
  if (problem) return error(400, problem);
  const now = new Date();
  const row: CompositionRow = {
    id: randomId(10), owner_id: user.id, name: req.name.slice(0, 255), revision: 1, preview_sha256: req.preview ?? null,
    public_slug: null, share_sources: false, share_remix: true, created_at: now, updated_at: now,
  };
  await repo.createComposition(row, { composition_id: row.id, revision: 1, document: req.document, inputs: req.inputs, created_at: now });
  return { status: 201, body: summary(row) };
};

const owned = async (repo: Repo, user: User, id: string) => {
  const c = await repo.composition(id);
  return c && c.owner_id === user.id ? c : undefined;
};

/** Saving again adds a revision; earlier revisions never change. */
export const saveRevision = async ({ repo }: Context, user: User, id: string, req: SaveRequest): Promise<Result> => {
  const c = await owned(repo, user, id);
  if (!c) return error(404, 'Not found');
  const problem = await checkSave(repo, user, req);
  if (problem) return error(400, problem);
  const now = new Date();
  const revision = c.revision + 1;
  const patch = { revision, name: req.name.slice(0, 255), preview_sha256: req.preview ?? c.preview_sha256, updated_at: now };
  await repo.addRevision({ composition_id: id, revision, document: req.document, inputs: req.inputs, created_at: now }, patch);
  return ok(summary({ ...c, ...patch }));
};

export const openComposition = async ({ repo }: Context, user: User, id: string): Promise<Result> => {
  const c = await owned(repo, user, id);
  if (!c) return error(404, 'Not found');
  const rev = await repo.revision(id, c.revision);
  return ok({ ...summary(c), document: rev?.document, inputs: rev?.inputs ?? [] });
};

export const deleteComposition = async ({ repo }: Context, user: User, id: string): Promise<Result> => {
  if (!(await owned(repo, user, id))) return error(404, 'Not found');
  await repo.deleteComposition(id);
  return ok({ deleted: true });
};

export type ShareRequest = { public: boolean, includeSources?: boolean, allowRemix?: boolean };

/** Turns the public link on or off; turning it on again issues a new link. */
export const share = async ({ repo }: Context, user: User, id: string, req: ShareRequest): Promise<Result> => {
  const c = await owned(repo, user, id);
  if (!c) return error(404, 'Not found');
  const patch: Partial<CompositionRow> = {
    public_slug: req.public ? (c.public_slug ?? randomId(8)) : null,
    share_sources: req.includeSources ?? c.share_sources,
    share_remix: req.allowRemix ?? c.share_remix,
  };
  await repo.updateComposition(id, patch);
  return ok(summary({ ...c, ...patch }));
};

// Public links ---------------------------------------------------------------------------------

export const openPublic = async ({ repo }: Context, slug: string): Promise<Result> => {
  const c = await repo.compositionBySlug(slug);
  if (!c) return error(404, 'This link is off or never existed');
  const rev = await repo.revision(c.id, c.revision);
  return ok({
    name: c.name, document: rev?.document, preview: c.preview_sha256,
    inputs: c.share_sources ? rev?.inputs ?? [] : undefined,
    inputCount: rev?.inputs.length ?? 0,
    includeSources: c.share_sources, allowRemix: c.share_remix,
  });
};

/** A shared composition's preview, and its source photos only when the owner included them. */
export const readPublicImage = async ({ repo, store }: Context, slug: string, sha256: string, variant: Variant): Promise<Result> => {
  const c = await repo.compositionBySlug(slug);
  if (!c || !isSha256(sha256)) return error(404, 'Not found');
  const rev = await repo.revision(c.id, c.revision);
  const allowed = c.preview_sha256 === sha256 || (c.share_sources && (rev?.inputs ?? []).includes(sha256));
  const image = allowed ? await repo.getImage(sha256) : undefined;
  if (!image) return error(404, 'Not found');
  return serve(store, sha256, variant, image.content_type);
};

/** Copies a shared composition into the signer's library (with its photos, if they were shared). */
export const remix = async ({ repo }: Context, user: User, slug: string): Promise<Result> => {
  const c = await repo.compositionBySlug(slug);
  if (!c) return error(404, 'Not found');
  if (!c.share_remix) return error(403, 'Remixing is off for this composition');
  await repo.ensureUser(user);
  const rev = await repo.revision(c.id, c.revision);
  const inputs = c.share_sources ? rev?.inputs ?? [] : [];
  for (const sha of inputs) await repo.addToLibrary(user.id, sha, 'Shared photo');
  const now = new Date();
  const row: CompositionRow = {
    id: randomId(10), owner_id: user.id, name: `${c.name} (remix)`.slice(0, 255), revision: 1, preview_sha256: c.preview_sha256,
    public_slug: null, share_sources: false, share_remix: true, created_at: now, updated_at: now,
  };
  await repo.createComposition(row, { composition_id: row.id, revision: 1, document: rev?.document ?? {}, inputs, created_at: now });
  return { status: 201, body: summary(row) };
};
