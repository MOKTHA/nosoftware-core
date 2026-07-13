/**
 * Drizzle table for tenant isolation and workspace-scoped access control.
 *
 * This schema enforces that all data access is scoped to the user's
 * organization and workspace permissions. It provides a centralized
 * place to define and enforce tenant boundaries.
 */

import {
  pgTable,
  uuid,
  text,
  timestamp,
  boolean,
  integer,
  jsonb,
  index,
  pgEnum,
} from 'drizzle-orm/pg-core';

import { users } from './users.js';
import { organizations } from './organizations.js';
import { workspaces } from './workspaces.js';

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------

/** Scope of access control */
export const isolationScopeEnum = pgEnum('isolation_scope', [
  'org-level',     // Organization-wide restriction
  'workspace-level', // Workspace-specific restriction
  'project-level',  // Project-specific restriction
]);

/** Type of isolation rule */
export const isolationRuleTypeEnum = pgEnum('isolation_rule_type', [
  'data-access',    // Controls who can access what data
  'cross-tenant',   // Prevents cross-workspace queries
  'audit-gate',     // Requires audit logging for sensitive operations
  'approval-required', // Requires approval before action
]);

// ---------------------------------------------------------------------------
// Table: tenant_isolation_rules
// Defines isolation rules that enforce workspace-scoped access
// ---------------------------------------------------------------------------

export const tenantIsolationRules = pgTable('tenant_isolation_rules', {
  /** Unique ID for this rule. */
  id: uuid('id').primaryKey().defaultRandom(),

  /** Organization this rule applies to. */
  organizationId: text('organizationId')
    .notNull()
    .references(() => organizations.id),

  /** Optional workspace scope (null = org-wide). */
  workspaceId: text('workspaceId').references(() => workspaces.id),

  /** What type of rule this is. */
  ruleType: isolationRuleTypeEnum('ruleType').notNull(),

  /** Scope level for the rule. */
  scope: isolationScopeEnum('scope').notNull(),

  /** Target entity type (e.g., 'project', 'task', 'generation-run'). */
  entityType: text('entityType').notNull(),

  /** Rule name/description. */
  name: text('name').notNull(),

  /** Description of the rule's purpose. */
  description: text('description'),

  /** JSON configuration for the rule (conditions, thresholds, etc.). */
  config: jsonb('config').$type<Record<string, unknown>>(),

  /** Whether this rule is active. */
  isActive: boolean('isActive').notNull().default(true),

  /** Priority (lower = higher priority). */
  priority: integer('priority').notNull().default(100),

  createdAt: timestamp('createdAt', { mode: 'date' }).notNull(),
  updatedAt: timestamp('updatedAt', { mode: 'date' }).notNull(),
}, (table) => ({
  orgIdx: index('tenant_isolation_rules_organizationId_idx').on(table.organizationId),
  workspaceIdx: index('tenant_isolation_rules_workspaceId_idx').on(table.workspaceId),
  entityTypeIdx: index('tenant_isolation_rules_entityType_idx').on(table.entityType),
}));

export type TenantIsolationRule = typeof tenantIsolationRules.$inferSelect;
export type InsertTenantIsolationRule = typeof tenantIsolationRules.$inferInsert;

// ---------------------------------------------------------------------------
// Table: access_control_logs
// Logs all access control decisions for audit purposes
// ---------------------------------------------------------------------------

export const accessControlLogs = pgTable('access_control_logs', {
  /** Unique ID. */
  id: uuid('id').primaryKey().defaultRandom(),

  /** Organization scope. */
  organizationId: text('organizationId')
    .notNull()
    .references(() => organizations.id),

  /** User who attempted the access. */
  userId: text('userId')
    .notNull()
    .references(() => users.id),

  /** Target entity being accessed. */
  entityType: text('entityType').notNull(),
  entityId: text('entityId').notNull(),

  /** Action attempted (read, write, delete, etc.). */
  action: text('action').notNull(),

  /** Whether access was granted or denied. */
  decision: boolean('decision').notNull(),

  /** Rule that determined the decision (if any). */
  ruleId: uuid('ruleId').references(() => tenantIsolationRules.id),

  /** Reason for denial (if applicable). */
  reason: text('reason'),

  /** Additional context. */
  metadata: jsonb('metadata').$type<Record<string, unknown>>(),

  createdAt: timestamp('createdAt', { mode: 'date' }).notNull(),
}, (table) => ({
  orgIdx: index('access_control_logs_organizationId_idx').on(table.organizationId),
  userIdx: index('access_control_logs_userId_idx').on(table.userId),
  entityIdx: index('access_control_logs_entityId_idx').on(table.entityId),
}));

export type AccessControlLog = typeof accessControlLogs.$inferSelect;
export type InsertAccessControlLog = typeof accessControlLogs.$inferInsert;
