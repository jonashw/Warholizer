import { Composition } from "../types";

/** A fetch that adds the signed-in person's token (AuthContext.authenticatedFetch). */
export type Fetcher = (input: RequestInfo, init?: RequestInit) => Promise<Response>;

export class SignInNeeded extends Error {
  constructor() { super('Sign in again to continue'); }
}

const json = async <T,>(response: Response): Promise<T> => {
  if (response.status === 401) throw new SignInNeeded();
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error((body as { error?: string }).error ?? `Request failed (${response.status})`);
  return body as T;
};

export const sha256Hex = async (blob: Blob): Promise<string> =>
  [...new Uint8Array(await crypto.subtle.digest('SHA-256', await blob.arrayBuffer()))].map(b => b.toString(16).padStart(2, '0')).join('');

/** A JPEG at most `size` px on its long side, on white. */
export const jpegOf = async (image: OffscreenCanvas, size: number, quality = 0.85): Promise<Blob> => {
  const scale = Math.min(1, size / Math.max(image.width, image.height));
  const c = new OffscreenCanvas(Math.max(1, Math.round(image.width * scale)), Math.max(1, Math.round(image.height * scale)));
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.drawImage(image, 0, 0, c.width, c.height);
  return c.convertToBlob({ type: 'image/jpeg', quality });
};

type UploadTarget = { url: string, method: 'PUT', headers: Record<string, string>, direct: boolean };
type Prepared = { exists: boolean, upload?: UploadTarget };

const send = async (fetcher: Fetcher, target: UploadTarget, body: Blob) => {
  // Presigned (R2) uploads go straight to storage, without our token; the fallback goes through our function.
  const response = await (target.direct ? fetch : fetcher)(target.url, { method: target.method, headers: target.headers, body });
  if (response.status === 401) throw new SignInNeeded();
  if (!response.ok) throw new Error(`Upload failed (${response.status})`);
};

/**
 * Puts an image in the library: its original bytes exactly as given (stored once by SHA-256) and
 * a thumbnail. Returns the hash, which is how compositions refer to their photos.
 */
export const uploadImage = async (
  fetcher: Fetcher, original: Blob, image: OffscreenCanvas, fileName: string, library = true,
): Promise<string> => {
  const sha256 = await sha256Hex(original);
  const prepare = (variant: 'original' | 'thumbnail', blob: Blob) => fetcher('/api/images/prepare', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sha256, variant, contentType: blob.type || 'application/octet-stream', byteSize: blob.size }),
  }).then(r => json<Prepared>(r));
  const originalPrepared = await prepare('original', original);
  if (!originalPrepared.exists && originalPrepared.upload) await send(fetcher, originalPrepared.upload, original);
  const thumbnail = await jpegOf(image, 512);
  const thumbnailPrepared = await prepare('thumbnail', thumbnail);
  if (!thumbnailPrepared.exists && thumbnailPrepared.upload) await send(fetcher, thumbnailPrepared.upload, thumbnail);
  await fetcher(`/api/images/${sha256}/commit`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fileName, contentType: original.type || 'application/octet-stream', width: image.width, height: image.height, library }),
  }).then(r => json(r));
  return sha256;
};

export type LibraryImage = {
  sha256: string, fileName: string, width: number | null, height: number | null, byteSize: number,
  contentType: string, hasThumbnail: boolean, addedAt: string,
};

export const listImages = (fetcher: Fetcher) => fetcher('/api/images').then(r => json<{ images: LibraryImage[] }>(r)).then(r => r.images);

export const fetchImage = async (fetcher: Fetcher, sha256: string, variant: 'original' | 'thumbnail'): Promise<Blob> => {
  const response = await fetcher(`/api/images/${sha256}/${variant}`);
  if (response.status === 401) throw new SignInNeeded();
  if (!response.ok) throw new Error(`Image not available (${response.status})`);
  return response.blob();
};

export const removeImage = (fetcher: Fetcher, sha256: string) =>
  fetcher(`/api/images/${sha256}`, { method: 'DELETE' }).then(r => json(r));

export type ShareState = { public: boolean, slug: string | null, includeSources: boolean, allowRemix: boolean };
export type SavedComposition = { id: string, name: string, revision: number, preview: string | null, updatedAt: string, share: ShareState };

export const listCompositions = (fetcher: Fetcher) =>
  fetcher('/api/compositions').then(r => json<{ compositions: SavedComposition[] }>(r)).then(r => r.compositions);

export const saveComposition = (fetcher: Fetcher, id: string | undefined, composition: Composition, inputs: string[], preview?: string, social?: string) =>
  fetcher(id ? `/api/compositions/${id}` : '/api/compositions', {
    method: id ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: composition.name, document: composition, inputs, preview, social }),
  }).then(r => json<SavedComposition>(r));

/**
 * The card shown when a shared link is pasted into messages and social apps: the Link preview
 * format (1200 × 630), the result contained on dark, with the composition's name.
 */
export const linkCardOf = async (result: OffscreenCanvas, name: string): Promise<{ canvas: OffscreenCanvas, blob: Blob }> => {
  const [width, height] = [1200, 630];
  const canvas = new OffscreenCanvas(width, height);
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#111318';
  ctx.fillRect(0, 0, width, height);
  const pad = 36;
  const textBand = 92;
  const s = Math.min((width - 2 * pad) / result.width, (height - 2 * pad - textBand) / result.height);
  const w = result.width * s, h = result.height * s;
  ctx.drawImage(result, (width - w) / 2, pad + (height - 2 * pad - textBand - h) / 2, w, h);
  ctx.fillStyle = '#ffffff';
  ctx.font = '700 40px system-ui, sans-serif';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText(name.length > 48 ? `${name.slice(0, 47)}…` : name, pad, height - pad - 8, width - 2 * pad - 220);
  ctx.fillStyle = '#ff4f98';
  ctx.font = '700 28px system-ui, sans-serif';
  ctx.textAlign = 'right';
  ctx.fillText('Warholizer', width - pad, height - pad - 8);
  return { canvas, blob: await canvas.convertToBlob({ type: 'image/jpeg', quality: 0.85 }) };
};

export const openComposition = (fetcher: Fetcher, id: string) =>
  fetcher(`/api/compositions/${id}`).then(r => json<SavedComposition & { document: Composition, inputs: string[] }>(r));

export const deleteComposition = (fetcher: Fetcher, id: string) =>
  fetcher(`/api/compositions/${id}`, { method: 'DELETE' }).then(r => json(r));

export const setSharing = (fetcher: Fetcher, id: string, settings: { public: boolean, includeSources?: boolean, allowRemix?: boolean }) =>
  fetcher(`/api/compositions/${id}/share`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(settings),
  }).then(r => json<SavedComposition>(r));

export type PublicComposition = {
  name: string, document: Composition, preview: string | null, inputs?: string[], inputCount: number, includeSources: boolean, allowRemix: boolean,
};

export const openPublic = (slug: string) => fetch(`/api/public/${slug}`).then(r => json<PublicComposition>(r));

export const publicImageUrl = (slug: string, sha256: string, variant: 'original' | 'thumbnail' = 'original') =>
  `/api/public/${slug}/images/${sha256}/${variant}`;

export const remix = (fetcher: Fetcher, slug: string) =>
  fetcher(`/api/public/${slug}/remix`, { method: 'POST' }).then(r => json<SavedComposition>(r));

export const publicUrl = (slug: string) => `${window.location.origin}/c/${slug}`;
