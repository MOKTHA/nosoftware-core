/**
 * Drizzle table definition for `sessions`.
 *
 * Required by Auth.js's Drizzle adapter when using database session
 * strategy (ADR-0008). One row per active session; the `sessionToken`
 * value is embedded in the session cookie so Auth.js can resolve a
 * request back to a `users` row.
 *
 * Column names (both JS properties and SQL) match Auth.js's Drizzle
 * adapter expectations exactly — do not rename.
 *
 * See docs/adr/0008-auth-library-and-provider.md for background.
 */
import { pgTable, text, timestamp } from 'drizzle-orm/pg-core';
import { users } from './users.js';

export const sessions = pgTable('sessions', {
  sessionToken: text('sessionToken').primaryKey(),
  userId: text('userId')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  expires: timestamp('expires', { mode: 'date' }).notNull(),
});
