/**
 * Drizzle table definition for `verification_tokens`.
 *
 * Required by Auth.js's Drizzle adapter as part of the schema surface.
 * Used by Auth.js for email verification tokens, password reset tokens,
 * etc. In Phase 1 (GitHub OAuth only) this table is not written to by
 * any HeyNXT code path; it exists purely to satisfy the adapter's
 * schema requirements.
 *
 * Column names (both JS properties and SQL) match Auth.js's Drizzle
 * adapter expectations exactly — do not rename.
 *
 * See docs/adr/0008-auth-library-and-provider.md for background.
 */
import { pgTable, primaryKey, text, timestamp } from 'drizzle-orm/pg-core';

export const verificationTokens = pgTable(
  'verification_tokens',
  {
    identifier: text('identifier').notNull(),
    token: text('token').notNull(),
    expires: timestamp('expires', { mode: 'date' }).notNull(),
  },
  (table) => ({
    compoundKey: primaryKey({
      columns: [table.identifier, table.token],
    }),
  })
);
