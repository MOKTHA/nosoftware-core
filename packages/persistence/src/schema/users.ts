/**
 * Drizzle table definition for `users`.
 *
 * Column naming convention: camelCase for both the TypeScript key and the
 * Postgres column name. This keeps the Drizzle ↔ Zod mapping 1:1 with the
 * Zod schema in `@heynxt/core-types` — no `mapFromView` transforms needed.
 *
 * Source Zod schema: packages/core-types/src/schemas/user.ts
 *
 * Auth.js compat note (see docs/adr/0008-auth-library-and-provider.md):
 * Property names `emailVerified` and `image` match what Auth.js's Drizzle
 * adapter expects; SQL column names match exactly.
 */
import {
  pgTable,
  text,
  timestamp,
  pgEnum,
  index,
} from 'drizzle-orm/pg-core';

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------

/** user.status — lifecycle state. Mirrors `UserStatus` in core-types. */
export const userStatusEnum = pgEnum('user_status', [
  'active',
  'invited',
  'suspended',
  'deleted',
]);

// ---------------------------------------------------------------------------
// Table
// ---------------------------------------------------------------------------

export const users = pgTable('users', {
  /** UUID string (client-generated). */
  id: text('id').primaryKey(),

  /** Email address (unique). */
  email: text('email').notNull(),

  /** When the email was verified. Null until verified. */
  emailVerified: timestamp('emailVerified', { mode: 'date' }),

  /** Display name. Nullable (may not be set yet). */
  name: text('name'),

  /** URL to the user's avatar image. Nullable. */
  image: text('image'),

  /** Lifecycle status. Defaults to 'invited'. */
  status: userStatusEnum('status').notNull().default('invited'),

  /**
   * Row creation time. DB-level default so Auth.js (and any other code
   * path that doesn't explicitly set this) can insert without failure.
   * Existing seed rows already have values; this only affects new rows.
   */
  createdAt: timestamp('createdAt', { mode: 'date' })
    .notNull()
    .defaultNow(),

  /**
   * Last-modified time. See createdAt note — same Auth.js reasoning.
   * Auth.js never updates this column on user update; application code
   * that wants to track modification should set it explicitly.
   */
  updatedAt: timestamp('updatedAt', { mode: 'date' })
    .notNull()
    .defaultNow(),
}, (table) => ({
  emailIdx: index('users_email_idx').on(table.email),
}));
