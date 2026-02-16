import { pgTable, varchar } from 'drizzle-orm/pg-core';
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

export const userRelations = relations(users, (r) => ({
    signins: r.many(user_signins)
}));

export const signinRelations = relations(user_signins, ({ one }) => ({
  user: one(users, {
    fields: [user_signins.user_id],
    references: [users.id],
  })
}));