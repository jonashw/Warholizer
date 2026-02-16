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