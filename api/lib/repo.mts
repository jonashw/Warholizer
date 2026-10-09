import { and, desc, eq } from 'drizzle-orm';
import type { User } from '../auth.mts';

export type ImageRow = {
  sha256: string, content_type: string, byte_size: number, width: number | null, height: number | null, has_thumbnail: boolean,
};
export type LibraryImage = ImageRow & { file_name: string, added_at: Date };
export type CompositionRow = {
  id: string, owner_id: string, name: string, revision: number, preview_sha256: string | null,
  public_slug: string | null, share_sources: boolean, share_remix: boolean, created_at: Date, updated_at: Date,
};
export type RevisionRow = { composition_id: string, revision: number, document: unknown, inputs: string[], created_at: Date };

/** The data the cloud handlers need; Drizzle in production, memory in tests. */
export interface Repo {
  ensureUser(user: User): Promise<void>;
  getImage(sha256: string): Promise<ImageRow | undefined>;
  insertImage(row: ImageRow): Promise<void>;
  updateImage(sha256: string, patch: Partial<ImageRow>): Promise<void>;
  addToLibrary(userId: string, sha256: string, fileName: string): Promise<void>;
  inLibrary(userId: string, sha256: string): Promise<boolean>;
  library(userId: string): Promise<LibraryImage[]>;
  removeFromLibrary(userId: string, sha256: string): Promise<void>;
  compositionsOf(ownerId: string): Promise<CompositionRow[]>;
  composition(id: string): Promise<CompositionRow | undefined>;
  compositionBySlug(slug: string): Promise<CompositionRow | undefined>;
  ownsPreview(ownerId: string, sha256: string): Promise<boolean>;
  revision(id: string, revision: number): Promise<RevisionRow | undefined>;
  createComposition(row: CompositionRow, revision: RevisionRow): Promise<void>;
  addRevision(revision: RevisionRow, patch: Partial<CompositionRow>): Promise<void>;
  updateComposition(id: string, patch: Partial<CompositionRow>): Promise<void>;
  deleteComposition(id: string): Promise<void>;
}

export const memoryRepo = (): Repo & { users: Map<string, User> } => {
  const users = new Map<string, User>();
  const images = new Map<string, ImageRow>();
  const library = new Map<string, { file_name: string, added_at: Date }>();
  const compositions = new Map<string, CompositionRow>();
  const revisions = new Map<string, RevisionRow>();
  const lk = (u: string, s: string) => `${u}\u0000${s}`;
  return {
    users,
    ensureUser: async u => { users.set(u.id, u); },
    getImage: async s => images.get(s),
    insertImage: async r => { if (!images.has(r.sha256)) images.set(r.sha256, r); },
    updateImage: async (s, p) => { const r = images.get(s); if (r) images.set(s, { ...r, ...p }); },
    addToLibrary: async (u, s, f) => { if (!library.has(lk(u, s))) library.set(lk(u, s), { file_name: f, added_at: new Date() }); },
    inLibrary: async (u, s) => library.has(lk(u, s)),
    library: async u => [...library.entries()].filter(([k]) => k.startsWith(`${u}\u0000`))
      .map(([k, v]) => ({ ...images.get(k.split('\u0000')[1])!, ...v })),
    removeFromLibrary: async (u, s) => { library.delete(lk(u, s)); },
    compositionsOf: async o => [...compositions.values()].filter(c => c.owner_id === o),
    composition: async id => compositions.get(id),
    compositionBySlug: async slug => [...compositions.values()].find(c => c.public_slug === slug),
    ownsPreview: async (o, s) => [...compositions.values()].some(c => c.owner_id === o && c.preview_sha256 === s),
    revision: async (id, r) => revisions.get(`${id}#${r}`),
    createComposition: async (row, rev) => { compositions.set(row.id, row); revisions.set(`${rev.composition_id}#${rev.revision}`, rev); },
    addRevision: async (rev, patch) => {
      revisions.set(`${rev.composition_id}#${rev.revision}`, rev);
      const c = compositions.get(rev.composition_id)!;
      compositions.set(c.id, { ...c, ...patch });
    },
    updateComposition: async (id, p) => { const c = compositions.get(id); if (c) compositions.set(id, { ...c, ...p }); },
    deleteComposition: async id => { compositions.delete(id); },
  };
};

/** The production repo, over Drizzle and Neon. Imported lazily so tests need no database. */
export const drizzleRepo = async (): Promise<Repo> => {
  const { db } = await import('../../db/index.ts');
  const t = await import('../../db/schema.ts');
  return {
    ensureUser: async u => { await db.insert(t.users).values(u).onConflictDoNothing(); },
    getImage: async s => (await db.select().from(t.images).where(eq(t.images.sha256, s)))[0],
    insertImage: async r => { await db.insert(t.images).values(r).onConflictDoNothing(); },
    updateImage: async (s, p) => { await db.update(t.images).set(p).where(eq(t.images.sha256, s)); },
    addToLibrary: async (u, s, f) => { await db.insert(t.user_images).values({ user_id: u, image_sha256: s, file_name: f }).onConflictDoNothing(); },
    inLibrary: async (u, s) => (await db.select().from(t.user_images)
      .where(and(eq(t.user_images.user_id, u), eq(t.user_images.image_sha256, s)))).length > 0,
    library: async u => (await db.select().from(t.user_images).innerJoin(t.images, eq(t.user_images.image_sha256, t.images.sha256))
      .where(eq(t.user_images.user_id, u)).orderBy(desc(t.user_images.added_at)))
      .map(r => ({ ...r.images, file_name: r.user_images.file_name, added_at: r.user_images.added_at })),
    removeFromLibrary: async (u, s) => { await db.delete(t.user_images).where(and(eq(t.user_images.user_id, u), eq(t.user_images.image_sha256, s))); },
    compositionsOf: async o => db.select().from(t.compositions).where(eq(t.compositions.owner_id, o)).orderBy(desc(t.compositions.updated_at)),
    composition: async id => (await db.select().from(t.compositions).where(eq(t.compositions.id, id)))[0],
    compositionBySlug: async slug => (await db.select().from(t.compositions).where(eq(t.compositions.public_slug, slug)))[0],
    ownsPreview: async (o, s) => (await db.select().from(t.compositions)
      .where(and(eq(t.compositions.owner_id, o), eq(t.compositions.preview_sha256, s)))).length > 0,
    revision: async (id, r) => (await db.select().from(t.composition_revisions)
      .where(and(eq(t.composition_revisions.composition_id, id), eq(t.composition_revisions.revision, r))))[0] as RevisionRow | undefined,
    createComposition: async (row, rev) => {
      await db.insert(t.compositions).values(row);
      await db.insert(t.composition_revisions).values(rev);
    },
    addRevision: async (rev, patch) => {
      await db.insert(t.composition_revisions).values(rev);
      await db.update(t.compositions).set(patch).where(eq(t.compositions.id, rev.composition_id));
    },
    updateComposition: async (id, p) => { await db.update(t.compositions).set(p).where(eq(t.compositions.id, id)); },
    deleteComposition: async id => { await db.delete(t.compositions).where(eq(t.compositions.id, id)); },
  };
};
