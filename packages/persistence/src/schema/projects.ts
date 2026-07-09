/**
 * Drizzle table definition for `projects`.
 *
 * Column naming convention: camelCase for both the TypeScript key and the
 * Postgres column name. See users.ts for the rationale.
 *
 * Source Zod schema: packages/core-types/src/schemas/project.ts
 */
import {
  pgTable,
  text,
  timestamp,
  pgEnum,
  index,
  uniqueIndex,
} from 'drizzle-orm/pg-core';

import { workspaces } from './workspaces.js';
import { users } from './users.js';

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------

/** project.status. Mirrors `ProjectStatus` in core-types. */
export const projectStatusEnum = pgEnum('project_status', [
  'draft',
  'active',
  'archived',
]);

// ---------------------------------------------------------------------------
// Table
// ---------------------------------------------------------------------------

export const projects = pgTable('projects', {
  /** UUID string (client-generated). */
  id: text('id').primaryKey(),

  /** FK to the owning workspace. */
  workspaceId: text('workspaceId')
    .notNull()
    .references(() => workspaces.id),

  /** Display name. */
  name: text('name').notNull(),

  /** URL-safe slug. Unique within the owning workspace. */
  slug: text('slug').notNull(),

  /** Optional description. */
  description: text('description'),

  /** Lifecycle status. Defaults to 'draft'. */
  status: projectStatusEnum('status').notNull().default('draft'),

  /** The user who created this project. */
  createdBy: text('createdBy')
    .notNull()
    .references(() => users.id),

  createdAt: timestamp('createdAt', { mode: 'date' }).notNull(),
  updatedAt: timestamp('updatedAt', { mode: 'date' }).notNull(),
}, (table) => ({
  /** Most project queries filter by workspace. */
  workspaceIdx: index('projects_workspaceId_idx').on(table.workspaceId),
  /** Composite unique: (workspaceId, slug). */
  workspaceSlugUnique: uniqueIndex('projects_workspaceId_slug_unique')
    .on(table.workspaceId, table.slug),
}));
