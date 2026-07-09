/**
 * Drizzle table definition for `generation_runs`.
 *
 * Column naming convention: camelCase for both the TypeScript key and the
 * Postgres column name. See users.ts for the rationale.
 *
 * Source Zod schema: packages/core-types/src/schemas/generation-run.ts
 */
import {
  pgTable,
  text,
  integer,
  timestamp,
  jsonb,
  pgEnum,
  index,
  uniqueIndex,
} from 'drizzle-orm/pg-core';

import type { GenerationRunSnapshot as Snapshot } from '@heynxt/core-types';
import { workspaces } from './workspaces.js';
import { projects } from './projects.js';
import { tasks } from './tasks.js';
import { users } from './users.js';

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------

/** generation_run.status. Mirrors `GenerationRunStatus` in core-types. */
export const generationRunStatusEnum = pgEnum('generation_run_status', [
  'pending',
  'running',
  'succeeded',
  'failed',
  'cancelled',
]);

// ---------------------------------------------------------------------------
// Table
// ---------------------------------------------------------------------------

export const generationRuns = pgTable('generation_runs', {
  /** UUID string (client-generated). */
  id: text('id').primaryKey(),

  /** FK to the owning workspace. */
  workspaceId: text('workspaceId')
    .notNull()
    .references(() => workspaces.id),

  /** FK to the owning project. */
  projectId: text('projectId')
    .notNull()
    .references(() => projects.id),

  /** FK to the triggering task. */
  taskId: text('taskId')
    .notNull()
    .references(() => tasks.id),

  /**
   * Monotonically increasing per-task run number.
   * Run #1 is the first attempt; #2 is the first re-run, etc.
   */
  runNumber: integer('runNumber').notNull(),

  /** Lifecycle status. Defaults to 'pending'. */
  status: generationRunStatusEnum('status').notNull().default('pending'),

  /**
   * Snapshot of the spec and blueprint plan used for this run.
   * Stored as JSONB so the schema stays stable as version shapes evolve.
   * Type is enforced at the Zod validation layer (GenerationRunSnapshot).
   */
  snapshot: jsonb('snapshot').$type<Snapshot>().notNull(),

  /**
   * Agent session id for resumption (matches the vercel coding-agent-template
   * pattern). Null until the agent runtime assigns one.
   */
  agentSessionId: text('agentSessionId'),

  /** The user who triggered this run. */
  createdBy: text('createdBy')
    .notNull()
    .references(() => users.id),

  /** When execution started. Null while pending. */
  startedAt: timestamp('startedAt', { mode: 'date' }),

  /** When execution reached a terminal state. Null if still running/pending. */
  completedAt: timestamp('completedAt', { mode: 'date' }),

  createdAt: timestamp('createdAt', { mode: 'date' }).notNull(),
  updatedAt: timestamp('updatedAt', { mode: 'date' }).notNull(),
}, (table) => ({
  taskIdx: index('generation_runs_taskId_idx').on(table.taskId),
  workspaceIdx: index('generation_runs_workspaceId_idx').on(table.workspaceId),
  /** Composite unique: (taskId, runNumber) — enforces one run per number per task. */
  taskRunUnique: uniqueIndex('generation_runs_taskId_runNumber_unique')
    .on(table.taskId, table.runNumber),
}));
