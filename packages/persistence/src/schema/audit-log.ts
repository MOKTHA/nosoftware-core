/**
 * Drizzle table definition for `audit_log`.
 *
 * Column naming convention: camelCase for both the TypeScript key and the
 * Postgres column name. See users.ts for the rationale.
 *
 * Source Zod schema: packages/core-types/src/schemas/audit-log.ts
 *
 * Design notes (from the Zod schema's JSDoc):
 * - Immutable, append-only. Never update or delete.
 * - Store only relevant fields in before/after snapshots (don't dump whole rows).
 * - entityType discriminates entityId (which is polymorphic — no FK).
 * - actorId may be a system user like 'system', so no FK to users.
 */
import {
  pgTable,
  text,
  timestamp,
  jsonb,
  pgEnum,
  index,
} from 'drizzle-orm/pg-core';

import { organizations } from './organizations.js';
import { workspaces } from './workspaces.js';

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------

/** audit_log.entityType — the class of entity that changed. */
export const auditEntityTypeEnum = pgEnum('audit_entity_type', [
  'organization',
  'workspace',
  'project',
  'task',
  'generation-run',
  'artifact',
  'blueprint',
  'user',
  'role-assignment',
  'invitation',
]);

/** audit_log.action — the operation that was performed. */
export const auditActionEnum = pgEnum('audit_action', [
  'created',
  'updated',
  'deleted',
  'status-changed',
  'approved',
  'rejected',
  'archived',
  'restored',
  'published',
  'deprecated',
]);

// ---------------------------------------------------------------------------
// Table
// ---------------------------------------------------------------------------

export const auditLog = pgTable('audit_log', {
  /** UUID string (client-generated). */
  id: text('id').primaryKey(),

  /** Organization scope — every audit entry is scoped to an org. */
  organizationId: text('organizationId')
    .notNull()
    .references(() => organizations.id),

  /** Optional workspace scope. Null for org-level events. */
  workspaceId: text('workspaceId').references(() => workspaces.id),

  /** The class of entity that changed. */
  entityType: auditEntityTypeEnum('entityType').notNull(),

  /**
   * The id of the entity that changed. Polymorphic — no FK because
   * entityType determines which table it lives in.
   */
  entityId: text('entityId').notNull(),

  /** What happened (created, updated, status-changed, etc.). */
  action: auditActionEnum('action').notNull(),

  /**
   * Who performed the action. Typically a UserId but may be 'system'
   * for automated transitions — so no FK to users.
   */
  actorId: text('actorId').notNull(),

  /** Reason given at the time of the action. Required for destructive actions. */
  reason: text('reason'),

  /**
   * Snapshot of relevant fields BEFORE the change.
   * See the Zod schema JSDoc for the snapshot discipline.
   */
  before: jsonb('before').$type<Record<string, unknown>>(),

  /** Snapshot of relevant fields AFTER the change. */
  after: jsonb('after').$type<Record<string, unknown>>(),

  /**
   * Free-form metadata for additional context (IP, user-agent,
   * linked generation run id, spec hash, retention hints, etc.).
   */
  metadata: jsonb('metadata').$type<Record<string, unknown>>(),

  createdAt: timestamp('createdAt', { mode: 'date' }).notNull(),
}, (table) => ({
  orgIdx: index('audit_log_organizationId_idx').on(table.organizationId),
  workspaceIdx: index('audit_log_workspaceId_idx').on(table.workspaceId),
  entityIdx: index('audit_log_entityId_idx').on(table.entityId),
}));
