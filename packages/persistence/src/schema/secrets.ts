/**
 * Drizzle table definition for workspace-level secrets storage.
 *
 * Secrets are encrypted at rest and scoped to workspaces or organizations.
 * This provides a centralized, secure store for API keys, database credentials,
 * and other sensitive configuration that should not be in environment files.
 */

import {
  pgTable,
  uuid,
  text,
  timestamp,
  boolean,
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

/** Scope of secret access */
export const secretScopeEnum = pgEnum('secret_scope', [
  'workspace',   // Scoped to a specific workspace
  'organization', // Available across all workspaces in org
]);

/** Secret type for categorization (does not imply encryption method) */
export const secretTypeEnum = pgEnum('secret_type', [
  'api-key',          // Generic API key
  'database-credential', // Database connection string or credentials
  'webhook-secret',   // Webhook signing secret
  'oauth-credential', // OAuth client secret
  'encryption-key',   // Encryption/decryption key
  'custom',           // Custom secret type
]);

/** Rotation policy for secrets */
export const rotationPolicyEnum = pgEnum('rotation_policy', [
  'never',        // No automatic rotation
  '30-days',      // Rotate every 30 days
  '60-days',      // Rotate every 60 days
  '90-days',      // Rotate every 90 days (recommended)
  '180-days',     // Rotate every 180 days
  'custom',       // Custom rotation schedule
]);

// ---------------------------------------------------------------------------
// Table: secrets
// Secure storage for sensitive credentials and configuration
// ---------------------------------------------------------------------------

export const secrets = pgTable('secrets', {
  /** Unique ID. */
  id: uuid('id').primaryKey().defaultRandom(),

  /** Organization this secret belongs to. */
  organizationId: text('organizationId')
    .notNull()
    .references(() => organizations.id),

  /** Workspace scope (null = org-wide). */
  workspaceId: text('workspaceId').references(() => workspaces.id),

  /** Secret name (human-readable identifier). */
  name: text('name').notNull(),

  /** Type of secret for categorization. */
  type: secretTypeEnum('type').notNull().default('custom'),

  /** Scope of this secret's availability. */
  scope: secretScopeEnum('scope').notNull().default('workspace'),

  /** Encrypted value (base64 encoded after encryption). */
  encryptedValue: text('encrypted_value').notNull(),

  /** Encryption metadata (algorithm, IV, etc.). */
  encryptionMetadata: jsonb('encryption_metadata').$type<Record<string, unknown>>(),

  /** Value hash for comparison without decryption. */
  valueHash: text('value_hash'),

  /** Whether this secret is currently active/valid. */
  isActive: boolean('isActive').notNull().default(true),

  /** Rotation policy for automatic rotation reminders. */
  rotationPolicy: rotationPolicyEnum('rotationPolicy').notNull().default('90-days'),

  /** Next rotation due date (calculated based on rotationPolicy). */
  nextRotationDue: timestamp('next_rotation_due'),

  /** When this secret was last rotated. */
  lastRotatedAt: timestamp('lastRotatedAt', { mode: 'date' }),

  /** Rotation status: active, expiring_soon, expired, overdue. */
  rotationStatus: text('rotation_status').notNull().default('active'),

  /** Notes about this secret (visible in UI). */
  notes: text('notes'),

  /** Who created this secret. */
  createdBy: text('createdBy')
    .notNull()
    .references(() => users.id),

  /** When the secret was created. */
  createdAt: timestamp('createdAt', { mode: 'date' }).notNull(),

  /** Last update time. */
  updatedAt: timestamp('updatedAt', { mode: 'date' }).notNull(),
}, (table) => ({
  orgIdx: index('secrets_organizationId_idx').on(table.organizationId),
  workspaceIdx: index('secrets_workspaceId_idx').on(table.workspaceId),
  nameIdx: index('secrets_name_idx').on(table.name, table.organizationId),
}));

export type Secret = typeof secrets.$inferSelect;
export type InsertSecret = typeof secrets.$inferInsert;

// ---------------------------------------------------------------------------
// Table: secret_rotation_history
// Tracks all rotation events for audit purposes
// ---------------------------------------------------------------------------

export const secretRotationHistory = pgTable('secret_rotation_history', {
  /** Unique ID. */
  id: uuid('id').primaryKey().defaultRandom(),

  /** Secret that was rotated. */
  secretId: uuid('secretId')
    .notNull()
    .references(() => secrets.id, { onDelete: 'cascade' }),

  /** Who performed the rotation. */
  rotatedBy: text('rotatedBy')
    .notNull()
    .references(() => users.id),

  /** Rotation timestamp. */
  rotatedAt: timestamp('rotatedAt', { mode: 'date' }).notNull(),

  /** Reason for rotation (optional). */
  reason: text('reason'),

  /** Previous value hash (for verification before overwrite). */
  previousValueHash: text('previousValueHash'),

  /** Rotation method: manual, automated, forced. */
  rotationMethod: text('rotation_method').notNull().default('manual'),

  /** Additional metadata about the rotation. */
  metadata: jsonb('metadata').$type<Record<string, unknown>>(),
}, (table) => ({
  secretIdx: index('secret_rotation_history_secretId_idx').on(table.secretId),
}));

export type SecretRotationHistory = typeof secretRotationHistory.$inferSelect;
export type InsertSecretRotationHistory = typeof secretRotationHistory.$inferInsert;

// ---------------------------------------------------------------------------
// Table: secret_access_logs
// Logs all access to secrets for audit trail
// ---------------------------------------------------------------------------

export const secretAccessLogs = pgTable('secret_access_logs', {
  /** Unique ID. */
  id: uuid('id').primaryKey().defaultRandom(),

  /** Secret that was accessed. */
  secretId: uuid('secretId')
    .notNull()
    .references(() => secrets.id, { onDelete: 'cascade' }),

  /** User who accessed the secret. */
  userId: text('userId')
    .notNull()
    .references(() => users.id),

  /** Action performed (read, rotate, update, delete). */
  action: text('action').notNull(),

  /** IP address of the requester. */
  ipAddress: text('ipAddress'),

  /** User agent string. */
  userAgent: text('userAgent'),

  /** Whether access was granted or denied. */
  success: boolean('success').notNull(),

  /** Reason for denial (if applicable). */
  reason: text('reason'),

  createdAt: timestamp('createdAt', { mode: 'date' }).notNull(),
}, (table) => ({
  secretIdx: index('secret_access_logs_secretId_idx').on(table.secretId),
  userIdx: index('secret_access_logs_userId_idx').on(table.userId),
}));

export type SecretAccessLog = typeof secretAccessLogs.$inferSelect;
export type InsertSecretAccessLog = typeof secretAccessLogs.$inferInsert;
