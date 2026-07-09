/**
 * Drizzle table definition for `role_assignments`.
 *
 * Column naming convention: camelCase for both the TypeScript key and the
 * Postgres column name. See users.ts for the rationale.
 *
 * Source Zod schema: packages/core-types/src/schemas/rbac.ts
 *
 * Composite UNIQUE constraint (not a PRIMARY KEY) because the natural key
 * contains a nullable column (workspaceId) — Postgres PRIMARY KEY implies
 * NOT NULL on every constituent column. The unique constraint enforces
 * uniqueness for workspace-scoped rows (workspaceId IS NOT NULL); for
 * org-scoped roles (workspaceId IS NULL), Postgres treats NULLs as
 * distinct so the constraint alone cannot prevent duplicate org-scope
 * assignments. The API layer must enforce that case via INSERT ... ON
 * CONFLICT DO NOTHING or equivalent.
 *
 * An index on (organizationId) supports cross-workspace role lookups.
 * An index on (userId) supports "what roles does this user have" queries.
 */
import {
  pgTable,
  text,
  timestamp,
  pgEnum,
  index,
  unique,
} from 'drizzle-orm/pg-core';

import { users } from './users.js';
import { organizations } from './organizations.js';
import { workspaces } from './workspaces.js';

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------

/** role_assignments.roleName. Mirrors `RoleName` in core-types. */
export const roleNameEnum = pgEnum('role_name', [
  'owner',
  'workspace-owner',
  'editor',
  'viewer',
  'guest',
]);

// ---------------------------------------------------------------------------
// Table
// ---------------------------------------------------------------------------

export const roleAssignments = pgTable('role_assignments', {
  /** The user receiving the role. */
  userId: text('userId')
    .notNull()
    .references(() => users.id),

  /** The organization this role applies in. */
  organizationId: text('organizationId')
    .notNull()
    .references(() => organizations.id),

  /**
   * The workspace this role applies in. Null for org-scoped roles
   * (e.g. 'owner' which grants full control across all workspaces).
   */
  workspaceId: text('workspaceId').references(() => workspaces.id),

  /** The role being granted. */
  roleName: roleNameEnum('roleName').notNull(),

  /** When the role was granted. */
  grantedAt: timestamp('grantedAt', { mode: 'date' }).notNull(),

  /** The user who granted this role. */
  grantedBy: text('grantedBy')
    .notNull()
    .references(() => users.id),
}, (table) => ({
  /**
   * Composite unique constraint on the natural business key.
   * NULL workspaceId caveat: see table header docstring.
   */
  assignmentUnique: unique('role_assignments_unique_assignment').on(
    table.userId,
    table.organizationId,
    table.workspaceId,
    table.roleName,
  ),
  /** Index for "which roles exist in this org" queries. */
  orgIdx: index('role_assignments_organizationId_idx').on(table.organizationId),
  /** Index for "which roles does this user have" queries. */
  userIdIdx: index('role_assignments_userId_idx').on(table.userId),
}));
