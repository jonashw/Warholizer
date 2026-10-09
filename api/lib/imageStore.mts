import { AwsClient } from 'aws4fetch';
import { getStore } from '@netlify/blobs';

/** Where the browser sends bytes: a presigned URL (R2), or a function (the Blobs fallback). */
export type UploadTarget = { url: string, method: 'PUT', headers: Record<string, string>, direct: boolean };

/**
 * Image bytes, by key (ADR 0001): `originals/<sha256>` and `thumbnails/<sha256>.jpg`. Server code
 * only talks to this interface, so the backend is a local choice.
 */
export interface ImageStore {
  name: string;
  has(key: string): Promise<boolean>;
  get(key: string): Promise<Uint8Array | undefined>;
  put(key: string, bytes: Uint8Array, contentType: string): Promise<void>;
  uploadTarget(key: string, contentType: string, viaFunction: string): Promise<UploadTarget>;
  /** A short-lived URL to read the bytes directly, when the store has one. */
  readUrl?(key: string): Promise<string>;
}

export const originalKey = (sha256: string) => `originals/${sha256}`;
export const thumbnailKey = (sha256: string) => `thumbnails/${sha256}.jpg`;

/** Cloudflare R2 through its S3 API; uploads and reads use presigned URLs. */
export const r2Store = (env: { accessKeyId: string, secretAccessKey: string, endpoint: string, bucket: string }): ImageStore => {
  const aws = new AwsClient({ accessKeyId: env.accessKeyId, secretAccessKey: env.secretAccessKey, service: 's3', region: 'auto' });
  const url = (key: string) => `${env.endpoint.replace(/\/$/, '')}/${env.bucket}/${key}`;
  const presign = async (key: string, method: 'GET' | 'PUT', seconds: number, headers: Record<string, string> = {}) => {
    const signed = await aws.sign(`${url(key)}?X-Amz-Expires=${seconds}`, { method, headers, aws: { signQuery: true } });
    return signed.url;
  };
  return {
    name: 'r2',
    has: async key => (await aws.fetch(url(key), { method: 'HEAD' })).ok,
    get: async key => {
      const res = await aws.fetch(url(key));
      return res.ok ? new Uint8Array(await res.arrayBuffer()) : undefined;
    },
    put: async (key, bytes, contentType) => {
      const res = await aws.fetch(url(key), { method: 'PUT', body: bytes as BodyInit, headers: { 'Content-Type': contentType } });
      if (!res.ok) throw new Error(`R2 put failed: ${res.status}`);
    },
    uploadTarget: async (key, contentType) => ({
      url: await presign(key, 'PUT', 900, { 'Content-Type': contentType }),
      method: 'PUT', headers: { 'Content-Type': contentType }, direct: true,
    }),
    readUrl: key => presign(key, 'GET', 3600),
  };
};

/** Netlify Blobs: used until R2 is configured. Uploads go through a function (payload limits apply). */
export const blobsStore = (): ImageStore => {
  const store = () => getStore({ name: 'warholizer-images', consistency: 'strong' });
  return {
    name: 'netlify-blobs',
    has: async key => (await store().getMetadata(key)) !== null,
    get: async key => {
      const data = await store().get(key, { type: 'arrayBuffer' });
      return data ? new Uint8Array(data) : undefined;
    },
    put: async (key, bytes, contentType) => {
      await store().set(key, bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer, { metadata: { contentType } });
    },
    uploadTarget: async (_key, contentType, viaFunction) => ({ url: viaFunction, method: 'PUT', headers: { 'Content-Type': contentType }, direct: false }),
  };
};

/** In memory, for tests. */
export const memoryStore = (): ImageStore & { objects: Map<string, Uint8Array> } => {
  const objects = new Map<string, Uint8Array>();
  return {
    name: 'memory',
    objects,
    has: async key => objects.has(key),
    get: async key => objects.get(key),
    put: async (key, bytes) => { objects.set(key, bytes); },
    uploadTarget: async (_key, contentType, viaFunction) => ({ url: viaFunction, method: 'PUT', headers: { 'Content-Type': contentType }, direct: false }),
  };
};

/** R2 when its four variables are set (docs/setup/cloudflare-r2.md), otherwise Netlify Blobs. */
export const configuredStore = (): ImageStore => {
  const { R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_ENDPOINT, R2_BUCKET } = process.env;
  return R2_ACCESS_KEY_ID && R2_SECRET_ACCESS_KEY && R2_ENDPOINT && R2_BUCKET
    ? r2Store({ accessKeyId: R2_ACCESS_KEY_ID, secretAccessKey: R2_SECRET_ACCESS_KEY, endpoint: R2_ENDPOINT, bucket: R2_BUCKET })
    : blobsStore();
};

export const sha256Hex = async (bytes: Uint8Array): Promise<string> =>
  [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes as BufferSource))].map(b => b.toString(16).padStart(2, '0')).join('');
