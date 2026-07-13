/**
 * Drizzle table definitions for rollback and snapshot management.
 *
 * Provides point-in-time recovery capability by:
 * - Creating snapshots of generation run states
 * - Tracking which artifacts were included in each snapshot
 * - Supporting one-click rollback to previous versions
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

import { generationRuns } from './generation-runs.js';
import { artifacts } from './artifacts.js';
import { organizations } from './organizations.js';
import { workspaces } from './workspaces.js';

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------

/** Snapshot type */
export const snapshotTypeEnum = pgEnum('snapshot_type', [
  'generation-run', // Full generation run state
  'workspace-config', // Workspace configuration snapshot
  'blueprint-version', // Blueprint registry version at time of gen
  'manual',         // User-created manual snapshot
]);

/** Rollback status */
export const rollbackStatusEnum = pgEnum('rollback_status', [
  'pending',        // Rollback requested but not executed
  'in-progress',    // Rollback currently executing
  'completed',      // Rollback successfully completed
  'failed',         // Rollback failed
  'cancelled',      // Rollback was cancelled
]);

/** Snapshot status */
export const snapshotStatusEnum = pgEnum('snapshot_status', [
  'active',         // Current valid snapshot
  'archived',       // Historical, no longer current
  'corrupted',      // Invalid/corrupted snapshot data
]);

// ---------------------------------------------------------------------------
// Table: snapshots
// Point-in-time state snapshots for rollback capability
// ---------------------------------------------------------------------------

export const snapshots = pgTable('snapshots', {
  /** Unique ID. */
  id: uuid('id').primaryKey().defaultRandom(),

  /** Organization this snapshot belongs to. */
  organizationId: text('organizationId')
    .notNull()
    .references(() => organizations.id),

  /** Workspace scope (null = org-wide). */
  workspaceId: text('workspaceId').references(() => workspaces.id),

  /** Type of snapshot being taken. */
  snapshotType: snapshotTypeEnum('snapshotType').notNull(),

  /** Reference entity - e.g., generation run ID for generation-run snapshots. */
  referenceEntityId: uuid('referenceEntityId'),

  /** Reference entity type (e.g., 'generation-run', 'workspace-config'). */
  referenceEntityType: text('referenceEntityType').notNull(),

  /** Snapshot name/description. */
  name: text('name').notNull(),

  /** Description of what this snapshot captures. */
  description: text('description'),

  /** The state at time of snapshot (serialized).
   * For generation runs, includes all artifact hashes and their states.
   */
  stateSnapshot: jsonb('stateSnapshot').$type<Record<string, unknown>>(),

  /** List of artifacts included in this snapshot. */
  artifactIds: uuid('artifactIds[]'),

  /** Hash of the state for quick comparison (detects if rollback needed). */
  stateHash: text('stateHash'),

  /** Size in bytes of all data captured. */
  sizeBytes: integer('sizeBytes').notNull().default(0),

  /** Where snapshot metadata is stored (in DB or external object storage). */
  storageLocation: text('storageLocation'),

  /** Storage type if external (e.g., 's3', 'gcs'). */
  storageType: text('storageType'),

  /** Snapshot status. */
  status: snapshotStatusEnum('status').notNull().default('active'),

  /** Is this the current/active version? */
  isActiveVersion: boolean('isActiveVersion').notNull().default(false),

  /** Who created this snapshot. */
  createdBy: text('createdBy')
    .notNull()
    .references(() => 'users' as any, { onDelete: 'cascade' }),

  createdAt: timestamp('createdAt', { mode: 'date' }).notNull(),
  updatedAt: timestamp('updatedAt', { mode: 'date' }).notNull(),
}, (table) => ({
  orgIdx: index('snapshots_organizationId_idx').on(table.organizationId),
  workspaceIdx: index('snapshots_workspaceId_idx').on(table.workspaceId),
  entityTypeIdx: index('snapshots_referenceEntityType_idx').on(table.referenceEntityType),
  entityRefIdx: index('snapshots_referenceEntityId_idx').on(table.referenceEntityId),
  hashIdx: index('snapshots_stateHash_idx').on(table.stateHash),
}));

export type Snapshot = typeof snapshots.$inferSelect;
export type InsertSnapshot = typeof snapshots.$inferInsert;

// ---------------------------------------------------------------------------
// Table: rollback_requests
// Tracks rollback requests and their execution status
// ---------------------------------------------------------------------------

export const rollbackRequests = pgTable('rollback_requests', {
  /** Unique ID. */
  id: uuid('id').primaryKey().defaultRandom(),

  /** Organization this rollback applies to. */
  organizationId: text('organizationId')
    .notNull()
    .references(() => organizations.id),

  /** Workspace affected (if workspace-specific). */
  workspaceId: text('workspaceId').references(() => workspaces.id),

  /** The generation run being rolled back to. */
  targetGenerationRunId: uuid('targetGenerationRunId')
    .notNull()
    .references(() => generationRuns.id, { onDelete: 'restrict' }),

  /** Snapshot that represents the target state (if applicable). */
  snapshotId: uuid('snapshotId').references(() => snapshots.id),

  /** The current generation run being replaced. */
  sourceGenerationRunId: uuid('sourceGenerationRunId')
    .notNull()
    .references(() => generationRuns.id, { onDelete: 'restrict' }),

  /** Who requested the rollback. */
  requestedBy: text('requestedBy')
    .notNull()
    .references(() => 'users' as any, { onDelete: 'cascade' }),

  /** Rollback status (pending, in-progress, completed, failed, cancelled). */
  status: rollbackStatusEnum('status').notNull().default('pending'),

  /** Reason for the rollback request. */
  reason: text('reason'),

  /** Target state hash being rolled back to. */
  targetStateHash: text('targetStateHash'),

  /** Current state hash (for comparison). */
  currentStateHash: text('currentStateHash'),

  /** Whether this rollback requires approval. */
  requiresApproval: boolean('requiresApproval').notNull().default(true),

  /** Approval decision if required. */
  approvedBy: text('approvedBy').references(() => 'users' as any, { onDelete: 'set null' }),
  approvedAt: timestamp('approvedAt', { mode: 'date' }),

  /** Actual rollback execution time (when status changes to in-progress). */
  executedAt: timestamp('executedAt', { mode: 'date' }),

  /** Who executed the rollback. */
  executedBy: text('executedBy').references(() => 'users' as any, { onDelete: 'set null' }),

  /** Rollback result summary (number of files reverted, etc.). */
  resultSummary: jsonb('resultSummary').$type<Record<string, unknown>>(),

  createdAt: timestamp('createdAt', { mode: 'date' }).notNull(),
  updatedAt: timestamp('updatedAt', { mode: 'date' }).notNull(),
}, (table) => ({
  orgIdx: index('rollback_requests_organizationId_idx').on(table.organizationId),
  workspaceIdx: index('rollback_requests_workspaceId_idx').on(table.workspaceId),
  targetGenIdx: index('rollback_requests_targetGenerationRunId_idx').on(table.targetGenerationRunId),
  sourceGenIdx: index('rollback_requests_sourceGenerationRunId_idx').on(table.sourceGenerationRunId),
}));

export type RollbackRequest = typeof rollbackRequests.$inferSelect;
export type InsertRollbackRequest = typeof rollbackRequests.$inferInsert;

// ---------------------------------------------------------------------------
// Table: rollback_artifact_mappings
// Maps which artifacts were reverted during a rollback
// ---------------------------------------------------------------------------

export const rollbackArtifactMappings = pgTable('rollback_artifact_mappings', {
  /** Unique ID. */
  id: uuid('id').primaryKey().defaultRandom(),

  /** Rollback request this mapping belongs to. */
  rollbackRequestId: uuid('rollbackRequestId')
    .notNull()
    .references(() => rollbackRequests.id, { onDelete: 'cascade' }),

  /** Artifact that was reverted (the new version). */
  artifactId: uuid('artifactId').references(() => artifacts.id),

  /** Previous artifact state being restored. */
  previousArtifactHash: text('previousArtifactHash'),

  /** Action taken for this artifact: restored, replaced, skipped. */
  actionTaken: text('actionTaken').notNull(),

  /** Notes about this specific artifact's rollback status. */
  notes: text('notes'),

  createdAt: timestamp('createdAt', { mode: 'date' }).notNull(),
});

export type RollbackArtifactMapping = typeof rollbackArtifactMappings.$inferSelect;
export type InsertRollbackArtifactMapping = typeof rollbackArtifactMappings.$inferInsert;

// ---------------------------------------------------------------------------
// Table: snapshot_metadata_storage
// External storage references for large snapshots (in DB or object storage).
// This allows storing metadata about where actual snapshot data is stored.
// ---------------------------------------------------------------------------

export const snapshotMetadataStorage = pgTable('snapshot_metadata_storage', {
  /** Unique ID. */
  id: uuid('id').primaryKey().defaultRandom(),

  /** Snapshot this metadata entry belongs to. */
  snapshotId: uuid('snapshotId')
    .notNull()
    .references(() => snapshots.id, { onDelete: 'cascade' }),

  /** Storage provider (e.g., 'internal', 's3', 'gcs'). */
  storageProvider: text('storageProvider').notNull(),

  /** Storage location/key. */
  storageKey: text('storageKey').notNull(),

  /** Encryption status of stored data. */
  encrypted: boolean('encrypted').notNull().default(false),

  /** Compression format used (e.g., 'gzip', 'none'). */
  compressionFormat: text('compressionFormat'),

  /** Size in bytes. */
  sizeBytes: integer('sizeBytes').notNull(),

  /** Checksum for integrity verification. */
  checksum: text('checksum'),

  createdAt: timestamp('createdAt', { mode: 'date' }).notNull(),
});

export type SnapshotMetadataStorage = typeof snapshotMetadataStorage.$inferSelect;
export type InsertSnapshotMetadataStorage = typeof snapshotMetadataStorage.$inferInsert;
