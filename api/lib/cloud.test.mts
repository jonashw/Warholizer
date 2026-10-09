import { describe, expect, it } from 'vitest';
import type { User } from '../auth.mts';
import {
  commitImage, createComposition, listCompositions, listImages, openComposition, openPublic,
  prepareUpload, putBytes, readImage, readPublicImage, remix, saveRevision, share,
} from './cloud.mts';
import { memoryStore, originalKey, sha256Hex } from './imageStore.mts';
import { memoryRepo } from './repo.mts';

const ada: User = { id: 'ada', name: 'Ada', email: 'ada@example.com', picture: 'p' };
const bob: User = { id: 'bob', name: 'Bob', email: 'bob@example.com', picture: 'p' };
const setup = () => ({ repo: memoryRepo(), store: memoryStore() });
const bytes = (text: string) => new TextEncoder().encode(text);
const body = (r: { status: number }) => (r as unknown as { body: Record<string, unknown> }).body;

/** The browser's upload: prepare, send bytes, commit. */
const upload = async (ctx: ReturnType<typeof setup>, user: User, data: Uint8Array, fileName = 'photo.jpg') => {
  const sha256 = await sha256Hex(data);
  const prepared = body(await prepareUpload(ctx, user, { sha256, variant: 'original', contentType: 'image/jpeg', byteSize: data.length }));
  if (!prepared.exists) await putBytes(ctx, sha256, 'original', data, 'image/jpeg');
  await commitImage(ctx, user, sha256, { fileName, contentType: 'image/jpeg', width: 4, height: 3 });
  return sha256;
};

describe('image library', () => {
  it('stores bytes once by hash and lists them per person', async () => {
    const ctx = setup();
    const sha = await upload(ctx, ada, bytes('giraffe'));
    expect(ctx.store.objects.has(originalKey(sha))).toBe(true);
    const again = body(await prepareUpload(ctx, bob, { sha256: sha, variant: 'original', contentType: 'image/jpeg', byteSize: 7 }));
    expect(again.exists).toBe(true);
    await commitImage(ctx, bob, sha, { fileName: 'same.jpg', contentType: 'image/jpeg' });
    expect((body(await listImages(ctx, ada)).images as unknown[])).toHaveLength(1);
    expect((body(await listImages(ctx, bob)).images as { fileName: string }[])[0].fileName).toBe('same.jpg');
    expect(ctx.store.objects.size).toBe(1);
  });

  it('refuses bytes that do not match their hash', async () => {
    const ctx = setup();
    const sha = await sha256Hex(bytes('real'));
    expect((await putBytes(ctx, sha, 'original', bytes('fake'), 'image/jpeg')).status).toBe(400);
    // Planted directly in the store (as a presigned upload could): the commit catches it.
    await ctx.store.put(originalKey(sha), bytes('fake'), 'image/jpeg');
    expect((await commitImage(ctx, ada, sha, { fileName: 'x', contentType: 'image/jpeg' })).status).toBe(400);
  });

  it('only shows images to people who have them', async () => {
    const ctx = setup();
    const sha = await upload(ctx, ada, bytes('private'));
    expect((await readImage(ctx, ada, sha, 'original')).status).toBe(200);
    expect((await readImage(ctx, bob, sha, 'original')).status).toBe(404);
  });
});

describe('limits', () => {
  it('refuses files over the size limit and uploads past the library quota', async () => {
    const ctx = setup();
    const sha = await sha256Hex(bytes('big'));
    expect((await prepareUpload(ctx, ada, { sha256: sha, variant: 'original', contentType: 'image/jpeg', byteSize: 200 * 1024 * 1024 })).status).toBe(413);
    process.env.LIBRARY_QUOTA_BYTES = '10';
    try {
      await upload(ctx, ada, bytes('12345678'));
      const next = await sha256Hex(bytes('more'));
      expect((await prepareUpload(ctx, ada, { sha256: next, variant: 'original', contentType: 'image/jpeg', byteSize: 4 })).status).toBe(413);
    } finally {
      delete process.env.LIBRARY_QUOTA_BYTES;
    }
  });
});

describe('compositions', () => {
  it('saves revisions without changing earlier ones, and only for inputs in the library', async () => {
    const ctx = setup();
    const sha = await upload(ctx, ada, bytes('photo'));
    const created = body(await createComposition(ctx, ada, { name: 'Grid', document: { v: 1 }, inputs: [sha] }));
    const id = created.id as string;
    await saveRevision(ctx, ada, id, { name: 'Grid 2', document: { v: 2 }, inputs: [sha] });
    expect(body(await openComposition(ctx, ada, id))).toMatchObject({ name: 'Grid 2', revision: 2, document: { v: 2 } });
    expect((await ctx.repo.revision(id, 1))?.document).toEqual({ v: 1 });
    expect((await openComposition(ctx, bob, id)).status).toBe(404);
    const foreign = await sha256Hex(bytes('not mine'));
    expect((await createComposition(ctx, ada, { name: 'x', document: {}, inputs: [foreign] })).status).toBe(400);
    expect((body(await listCompositions(ctx, ada)).compositions as unknown[])).toHaveLength(1);
  });
});

describe('public links', () => {
  it('shows the composition and preview, hides source photos unless included, and remixes', async () => {
    const ctx = setup();
    const photo = await upload(ctx, ada, bytes('photo'));
    const preview = await sha256Hex(bytes('preview'));
    await putBytes(ctx, preview, 'original', bytes('preview'), 'image/jpeg');
    await commitImage(ctx, ada, preview, { fileName: 'preview', contentType: 'image/jpeg', library: false });
    const id = body(await createComposition(ctx, ada, { name: 'Grid', document: { v: 1 }, inputs: [photo], preview })).id as string;
    const shared = body(await share(ctx, ada, id, { public: true }));
    const slug = (shared.share as { slug: string }).slug;
    expect(body(await openPublic(ctx, slug))).toMatchObject({ name: 'Grid', inputs: undefined, inputCount: 1 });
    expect((await readPublicImage(ctx, slug, preview, 'original')).status).toBe(200);
    expect((await readPublicImage(ctx, slug, photo, 'original')).status).toBe(404);
    await share(ctx, ada, id, { public: true, includeSources: true });
    expect((await readPublicImage(ctx, slug, photo, 'original')).status).toBe(200);
    const copy = body(await remix(ctx, bob, slug));
    expect(body(await openComposition(ctx, bob, copy.id as string))).toMatchObject({ document: { v: 1 }, inputs: [photo] });
    expect((await readImage(ctx, bob, photo, 'original')).status).toBe(200);
    await share(ctx, ada, id, { public: false });
    expect((await openPublic(ctx, slug)).status).toBe(404);
  });
});
