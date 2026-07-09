/**
 * Drizzle table definition for `users`.
 *
 * Column naming convention: camelCase for both the TypeScript key and the
 * Postgres column name. This keeps the Drizzle ↔ Zod mapping 1:1 with the
 * Zod schema in `@heynxt/core-types` — no `mapFromView` transforms needed.
 *
 * Source Zod schema: packages/core-types/src/schemas/user.ts
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
  emailVerifiedAt: timestamp('emailVerifiedAt', { mode: 'date' }),

  /** Display name. Nullable (may not be set yet). */
  name: text('name'),

  /** URL to the user's avatar image. Nullable. */
  imageUrl: text('imageUrl'),

  /** Lifecycle status. Defaults to 'invited'. */
  status: userStatusEnum('status').notNull().default('invited'),

  createdAt: timestamp('createdAt', { mode: 'date' }).notNull(),
  updatedAt: timestamp('updatedAt', { mode: 'date' }).notNull(),
}, (table) => ({
  emailIdx: index('users_email_idx').on(table.email),
}));
