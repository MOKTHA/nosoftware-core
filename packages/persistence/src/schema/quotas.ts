/**
 * Drizzle table definitions for tenant quotas and usage tracking.
 *
 * Provides per-tenant quota enforcement for:
 * - Agent runs per day/month
 * - Storage usage (artifacts, generated files)
 * - Compute time (generation run duration)
 * - API rate limiting
 */

import {
  pgTable,
  uuid,
  text,
  timestamp,
  integer,
  boolean,
  jsonb,
  index,
  pgEnum,
} from 'drizzle-orm/pg-core';

import { organizations } from './organizations.js';
import { workspaces } from './workspaces.js';

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------

/** Quota type being tracked */
export const quotaTypeEnum = pgEnum('quota_type', [
  'agent-runs-daily',     // Number of agent runs per day
  'agent-runs-monthly',   // Number of agent runs per month
  'storage-bytes',        // Total storage used (bytes)
  'compute-minutes',      // Total compute time (minutes)
  'api-requests-hourly',  // API request rate limit
  'concurrent-generations', // Max concurrent generation runs
]);

/** Quota status */
export const quotaStatusEnum = pgEnum('quota_status', [
  'active',         // Within limits
  'approaching',    // Near threshold (soft limit)
  'exceeded',       // Over hard limit
  'disabled',       // Quota enforcement disabled
]);

/** Usage tracking status */
export const usageStatusEnum = pgEnum('usage_status', [
  'tracking',     // Currently being tracked
  'paused',       // Tracking temporarily paused
  'archived',     // Historical data, no longer active
]);

// ---------------------------------------------------------------------------
// Table: tenant_quotas
// Defines quota limits per workspace/organization
// ---------------------------------------------------------------------------

export const tenantQuotas = pgTable('tenant_quotas', {
  /** Unique ID. */
  id: uuid('id').primaryKey().defaultRandom(),

  /** Organization this quota applies to. */
  organizationId: text('organizationId')
    .notNull()
    .references(() => organizations.id),

  /** Workspace scope (null = org-wide). */
  workspaceId: text('workspaceId').references(() => workspaces.id),

  /** Type of quota being enforced. */
  quotaType: quotaTypeEnum('quotaType').notNull(),

  /** Hard limit value (enforced strictly). */
  hardLimit: integer('hardLimit').notNull(),

  /** Soft limit value (warning threshold, 80% of hard by default). */
  softLimit: integer('softLimit'),

  /** Reset period for usage counters. */
  resetPeriod: text('resetPeriod').notNull().default('daily'), // daily, monthly

  /** Next scheduled reset timestamp. */
  nextResetAt: timestamp('nextResetAt', { mode: 'date' }).notNull(),

  /** Quota status (active, approaching, exceeded). */
  status: quotaStatusEnum('status').notNull().default('active'),

  /** Whether enforcement is active. */
  isActive: boolean('isActive').notNull().default(true),

  /** Custom configuration for this quota type. */
  config: jsonb('config').$type<Record<string, unknown>>(),

  /** Notes about this quota. */
  notes: text('notes'),

  createdAt: timestamp('createdAt', { mode: 'date' }).notNull(),
  updatedAt: timestamp('updatedAt', { mode: 'date' }).notNull(),
}, (table) => ({
  orgIdx: index('tenant_quotas_organizationId_idx').on(table.organizationId),
  workspaceIdx: index('tenant_quotas_workspaceId_idx').on(table.workspaceId),
  typeIdx: index('tenant_quotas_quotaType_idx').on(table.quotaType),
}));

export type TenantQuota = typeof tenantQuotas.$inferSelect;
export type InsertTenantQuota = typeof tenantQuotas.$inferInsert;

// ---------------------------------------------------------------------------
// Table: usage_counters
// Tracks current usage against quota limits (updated frequently).
// This is a denormalized table for fast lookups.
// ---------------------------------------------------------------------------

export const usageCounters = pgTable('usage_counters', {
  /** Unique ID. */
  id: uuid('id').primaryKey().defaultRandom(),

  /** Reference to the quota this counter tracks. */
  quotaId: uuid('quotaId')
    .notNull()
    .references(() => tenantQuotas.id, { onDelete: 'cascade' }),

  /** Current usage value (e.g., bytes used, runs completed). */
  currentValue: integer('currentValue').notNull().default(0),

  /** Previous period's final value (for calculating deltas). */
  previousValue: integer('previousValue').notNull().default(0),

  /** Period start timestamp. */
  periodStartAt: timestamp('periodStartAt', { mode: 'date' }).notNull(),

  /** Period end timestamp. */
  periodEndAt: timestamp('periodEndAt', { mode: 'date' }).notNull(),

  /** Status of this counter (tracking, paused, archived). */
  status: usageStatusEnum('status').notNull().default('tracking'),

  /** Additional metrics breakdown (e.g., by agent type, endpoint). */
  metrics: jsonb('metrics').$type<Record<string, unknown>>(),

  createdAt: timestamp('createdAt', { mode: 'date' }).notNull(),
  updatedAt: timestamp('updatedAt', { mode: 'date' }).notNull(),
}, (table) => ({
  quotaIdx: index('usage_counters_quotaId_idx').on(table.quotaId),
  periodIdx: index('usage_counters_periodStartAt_idx').on(table.periodStartAt),
}));

export type UsageCounter = typeof usageCounters.$inferSelect;
export type InsertUsageCounter = typeof usageCounters.$inferInsert;

// ---------------------------------------------------------------------------
// Table: quota_violations
// Records when quotas are exceeded and what actions were taken.
// ---------------------------------------------------------------------------

export const quotaViolations = pgTable('quota_violations', {
  /** Unique ID. */
  id: uuid('id').primaryKey().defaultRandom(),

  /** Quota that was violated. */
  quotaId: uuid('quotaId')
    .notNull()
    .references(() => tenantQuotas.id, { onDelete: 'cascade' }),

  /** Workspace affected (if workspace-specific). */
  workspaceId: text('workspaceId').references(() => workspaces.id),

  /** Type of violation. */
  violationType: text('violationType').notNull(), // exceeded_soft_limit, exceeded_hard_limit, approaching_limit

  /** Current value when violation was detected. */
  currentValue: integer('currentValue').notNull(),

  /** Limit that was exceeded. */
  limitValue: integer('limitValue').notNull(),

  /** Severity: warning, error, critical. */
  severity: text('severity').notNull().default('warning'),

  /** Whether this violation triggered any automated action. */
  triggeredAction: boolean('triggeredAction').notNull().default(false),

  /** Action taken (notification_sent, request_blocked, etc.). */
  actionTaken: text('actionTaken'),

  /** Additional context about the violation. */
  metadata: jsonb('metadata').$type<Record<string, unknown>>(),

  createdAt: timestamp('createdAt', { mode: 'date' }).notNull(),
});

export type QuotaViolation = typeof quotaViolations.$inferSelect;
export type InsertQuotaViolation = typeof quotaViolations.$inferInsert;

// ---------------------------------------------------------------------------
// Table: usage_history_snapshots
// Historical snapshots of usage for trend analysis and billing.
// Taken daily at midnight (or configurable).
// ---------------------------------------------------------------------------

export const usageHistorySnapshots = pgTable('usage_history_snapshots', {
  /** Unique ID. */
  id: uuid('id').primaryKey().defaultRandom(),

  /** Reference to the counter this snapshot represents. */
  counterId: uuid('counterId')
    .notNull()
    .references(() => usageCounters.id, { onDelete: 'cascade' }),

  /** Snapshot timestamp (typically midnight UTC). */
  snapshotAt: timestamp('snapshotAt', { mode: 'date' }).notNull(),

  /** Value at time of snapshot. */
  valueAtSnapshot: integer('valueAtSnapshot').notNull(),

  /** Period total since last snapshot. */
  periodTotal: integer('periodTotal').notNull().default(0),

  /** Cumulative total for the billing/usage period. */
  cumulativeTotal: integer('cumulativeTotal').notNull().default(0),

  /** Snapshot metadata (agent breakdown, endpoint stats, etc.). */
  metadata: jsonb('metadata').$type<Record<string, unknown>>(),
}, (table) => ({
  counterIdx: index('usage_history_snapshots_counterId_idx').on(table.counterId),
  dateIdx: index('usage_history_snapshots_snapshotAt_idx').on(table.snapshotAt),
}));

export type UsageHistorySnapshot = typeof usageHistorySnapshots.$inferSelect;
export type InsertUsageHistorySnapshot = typeof usageHistorySnapshots.$inferInsert;
