/**
 * Drizzle table definition for `builds`.
 *
 * Tracks pipeline build runs triggered from the Control Plane UI.
 * Each row corresponds to one pipeline execution against an AppSpecTemplate.
 *
 * Column naming convention: camelCase for both the TypeScript key and the
 * Postgres column name. See users.ts for the rationale.
 */
import {
  pgTable,
  pgEnum,
  text,
  timestamp,
} from 'drizzle-orm/pg-core';

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------

/** build.status. */
export const buildStatusEnum = pgEnum('build_status', [
  'pending',
  'running',
  'succeeded',
  'failed',
]);

// ---------------------------------------------------------------------------
// Table
// ---------------------------------------------------------------------------

export const builds = pgTable('builds', {
  /** UUID string (server-generated). */
  id: text('id').primaryKey(),

  /** Application identifier from the AppSpec. */
  appId: text('appId').notNull(),

  /** Human-readable application name. */
  appName: text('appName').notNull(),

  /** The user's original prompt that triggered this build. */
  prompt: text('prompt'),

  /** The generated AppSpecTemplate as JSON (produced from the prompt). */
  specJson: text('specJson'),

  /** Lifecycle status. Defaults to 'pending'. */
  status: buildStatusEnum('status').notNull().default('pending'),

  /** Deployed URL once the build succeeds. */
  deployedUrl: text('deployedUrl'),

  /** Error message when the build fails. */
  errorMessage: text('errorMessage'),

  createdAt: timestamp('createdAt', { mode: 'date' }).notNull(),
  updatedAt: timestamp('updatedAt', { mode: 'date' }),
});

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type Build = typeof builds.$inferSelect;
export type InsertBuild = typeof builds.$inferInsert;
