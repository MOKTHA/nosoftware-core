/**
 * Drizzle table definition for `workspaces`.
 *
 * Column naming convention: camelCase for both the TypeScript key and the
 * Postgres column name. See users.ts for the rationale.
 *
 * Source Zod schema: packages/core-types/src/schemas/workspace.ts
 */
import {
  pgTable,
  text,
  timestamp,
  pgEnum,
  index,
  uniqueIndex,
} from 'drizzle-orm/pg-core';

import { organizations } from './organizations.js';

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------

/** workspace.status. Mirrors `WorkspaceStatus` in core-types. */
export const workspaceStatusEnum = pgEnum('workspace_status', [
  'active',
  'archived',
  'suspended',
]);

// ---------------------------------------------------------------------------
// Table
// ---------------------------------------------------------------------------

export const workspaces = pgTable('workspaces', {
  /** UUID string (client-generated). */
  id: text('id').primaryKey(),

  /** FK to the owning organization. */
  organizationId: text('organizationId')
    .notNull()
    .references(() => organizations.id),

  /** Display name. */
  name: text('name').notNull(),

  /** URL-safe slug. Unique within the owning organization. */
  slug: text('slug').notNull(),

  /** Optional description. */
  description: text('description'),

  /** Lifecycle status. Defaults to 'active'. */
  status: workspaceStatusEnum('status').notNull().default('active'),

  createdAt: timestamp('createdAt', { mode: 'date' }).notNull(),
  updatedAt: timestamp('updatedAt', { mode: 'date' }).notNull(),
}, (table) => ({
  /** Scoping index — most workspace queries filter by org. */
  orgIdx: index('workspaces_organizationId_idx').on(table.organizationId),
  /** Composite unique: (organizationId, slug). */
  orgSlugUnique: uniqueIndex('workspaces_organizationId_slug_unique')
    .on(table.organizationId, table.slug),
}));
