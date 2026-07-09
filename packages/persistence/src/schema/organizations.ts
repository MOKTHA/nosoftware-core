/**
 * Drizzle table definition for `organizations`.
 *
 * Column naming convention: camelCase for both the TypeScript key and the
 * Postgres column name. See users.ts for the rationale.
 *
 * Source Zod schema: packages/core-types/src/schemas/organization.ts
 */
import {
  pgTable,
  text,
  timestamp,
  pgEnum,
  uniqueIndex,
} from 'drizzle-orm/pg-core';

import { users } from './users.js';

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------

/** organization.status. Mirrors `OrganizationStatus` in core-types. */
export const organizationStatusEnum = pgEnum('organization_status', [
  'active',
  'suspended',
  'deleted',
]);

// ---------------------------------------------------------------------------
// Table
// ---------------------------------------------------------------------------

export const organizations = pgTable('organizations', {
  /** UUID string (client-generated). */
  id: text('id').primaryKey(),

  /** Display name. */
  name: text('name').notNull(),

  /** URL-safe slug. Globally unique across all organizations. */
  slug: text('slug').notNull(),

  /** Lifecycle status. Defaults to 'active'. */
  status: organizationStatusEnum('status').notNull().default('active'),

  /**
   * Owner (creator) user id. Nullable to support bootstrap cases where the
   * owner is assigned after org creation.
   */
  ownerId: text('ownerId').references(() => users.id),

  createdAt: timestamp('createdAt', { mode: 'date' }).notNull(),
  updatedAt: timestamp('updatedAt', { mode: 'date' }).notNull(),
}, (table) => ({
  slugUnique: uniqueIndex('organizations_slug_unique').on(table.slug),
}));
