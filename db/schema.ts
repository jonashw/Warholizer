import { pgTable, varchar, customType } from 'drizzle-orm/pg-core';
import * as p from "drizzle-orm/pg-core";
import { relations } from 'drizzle-orm';

export const users = pgTable('users', {
    id: varchar({ length: 255 }).notNull().primaryKey().notNull(),
    name: varchar({ length: 255 }).notNull(),
    picture: varchar({ length: 255 }).notNull(),
    email: varchar({ length: 255 }).notNull()
});

export const user_signins = pgTable('user_logins', {
    user_id: p.varchar({ length: 255 }).notNull().references(() => users.id),
    signed_in_at: p.timestamp({withTimezone: true}).notNull().defaultNow()
});

export const bytea = customType<{ data: Buffer }>({
  dataType() {
    return "bytea";
  },
  toDriver(value: Buffer) {
    // Optional: add custom logic before sending to the database
    return value;
  },
  fromDriver(value: unknown) {
    // Optional: add custom logic when receiving from the database
    if (typeof value === "object" && value instanceof Uint8Array) {
      return Buffer.from(value);
    }
    return value as Buffer;
  },
});

export const uploads = pgTable('uploads', {
    id: p.varchar({ length: 255 }).notNull().primaryKey(),
    user_id: p.varchar({ length: 255 }).notNull().references(() => users.id),
    file_name: p.varchar({ length: 255 }).notNull(),
    uploaded_at: p.timestamp({withTimezone: true}).notNull().defaultNow(),
    type: p.varchar({ length: 255 }).notNull(),
    base64_encoded_data: p.text().notNull()
});

export const userRelations = relations(users, (r) => ({
    signins: r.many(user_signins)
}));

export const signinRelations = relations(user_signins, ({ one }) => ({
  user: one(users, {
    fields: [user_signins.user_id],
    references: [users.id],
  })
}));
/**
 * Cloud library (ADR 0001). Image bytes live in the image store (Cloudflare R2), addressed by the
 * SHA-256 of the original file; these tables hold metadata only.
 */
export const images = pgTable('images', {
    sha256: p.varchar({ length: 64 }).notNull().primaryKey(),
    content_type: p.varchar({ length: 100 }).notNull(),
    byte_size: p.integer().notNull(),
    width: p.integer(),
    height: p.integer(),
    has_thumbnail: p.boolean().notNull().default(false),
    created_at: p.timestamp({ withTimezone: true }).notNull().defaultNow(),
});

/** Which images are in whose library (the same bytes are stored once). */
export const user_images = pgTable('user_images', {
    user_id: p.varchar({ length: 255 }).notNull().references(() => users.id),
    image_sha256: p.varchar({ length: 64 }).notNull().references(() => images.sha256),
    file_name: p.varchar({ length: 255 }).notNull(),
    added_at: p.timestamp({ withTimezone: true }).notNull().defaultNow(),
}, t => [p.primaryKey({ columns: [t.user_id, t.image_sha256] })]);

/** A saved Composer composition; its documents are immutable revisions. */
export const compositions = pgTable('compositions', {
    id: p.varchar({ length: 32 }).notNull().primaryKey(),
    owner_id: p.varchar({ length: 255 }).notNull().references(() => users.id),
    name: p.varchar({ length: 255 }).notNull(),
    revision: p.integer().notNull(),
    preview_sha256: p.varchar({ length: 64 }).references(() => images.sha256),
    /** Set while a public link is on. */
    public_slug: p.varchar({ length: 32 }).unique(),
    share_sources: p.boolean().notNull().default(false),
    share_remix: p.boolean().notNull().default(true),
    created_at: p.timestamp({ withTimezone: true }).notNull().defaultNow(),
    updated_at: p.timestamp({ withTimezone: true }).notNull().defaultNow(),
});

export const composition_revisions = pgTable('composition_revisions', {
    composition_id: p.varchar({ length: 32 }).notNull().references(() => compositions.id, { onDelete: 'cascade' }),
    revision: p.integer().notNull(),
    /** The Composer document (canonical JSON). */
    document: p.jsonb().notNull(),
    /** The input photos, in order, by SHA-256. */
    inputs: p.jsonb().notNull(),
    created_at: p.timestamp({ withTimezone: true }).notNull().defaultNow(),
}, t => [p.primaryKey({ columns: [t.composition_id, t.revision] })]);
