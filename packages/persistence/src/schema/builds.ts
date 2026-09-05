/**
 * Drizzle table definition for `builds`.
 *
 * Tracks pipeline build runs triggered from the Control Plane UI.
 * Each row corresponds to one pipeline execution against an AppSpecTemplate.
 *
 * Includes cost tracking columns for the credits/billing system:
 * model, token counts, USD cost, and credits deducted.
 */
import {
  pgTable,
  pgEnum,
  text,
  timestamp,
  integer,
  numeric,
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

  /** FK to users.id — the user who triggered this build. */
  userId: text('userId'),

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

  /** Build events (SSE) stored as JSON array for replay on reconnect. */
  eventsJson: text('eventsJson'),

  /** Generated source files stored as JSON array of {path, content}. */
  filesJson: text('filesJson'),

  // ── Cost tracking (Phase 6 credits/billing) ──

  /** LLM model used for this build (e.g. 'anthropic/claude-sonnet-4'). */
  model: text('model'),

  /** Number of input tokens consumed. */
  inputTokens: integer('inputTokens'),

  /** Number of output tokens consumed. */
  outputTokens: integer('outputTokens'),

  /** Total USD cost = (input_tokens/1M × input_price) + (output_tokens/1M × output_price). */
  costUSD: numeric('costUSD', { precision: 12, scale: 6 }),

  /** Credits deducted from the user's balance for this build. */
  creditsDeducted: numeric('creditsDeducted', { precision: 12, scale: 2 }),

  createdAt: timestamp('createdAt', { mode: 'date' }).notNull(),
  updatedAt: timestamp('updatedAt', { mode: 'date' }),
});

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type Build = typeof builds.$inferSelect;
export type InsertBuild = typeof builds.$inferInsert;
