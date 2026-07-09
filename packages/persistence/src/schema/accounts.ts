/**
 * Drizzle table definition for `accounts`.
 *
 * Required by Auth.js's Drizzle adapter — one row per (user, provider)
 * pair. Links a `users` row to one or more OAuth provider identities
 * (GitHub, Vercel, etc.), enabling the identity-merge pattern documented
 * in `packages/core-types/src/schemas/user.ts`.
 *
 * Column names (both JS properties and SQL) match Auth.js's Drizzle
 * adapter expectations exactly — do not rename.
 *
 * See docs/adr/0008-auth-library-and-provider.md for background.
 */
import { integer, pgTable, primaryKey, text } from 'drizzle-orm/pg-core';
import { users } from './users.js';

export const accounts = pgTable(
  'accounts',
  {
    userId: text('userId')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    type: text('type').notNull(),
    provider: text('provider').notNull(),
    providerAccountId: text('providerAccountId').notNull(),
    refresh_token: text('refresh_token'),
    access_token: text('access_token'),
    expires_at: integer('expires_at'),
    token_type: text('token_type'),
    scope: text('scope'),
    id_token: text('id_token'),
    session_state: text('session_state'),
  },
  (table) => ({
    compoundKey: primaryKey({
      columns: [table.provider, table.providerAccountId],
    }),
  })
);
