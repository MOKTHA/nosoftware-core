/**
 * Drizzle table definition for `validation_runs`.
 *
 * Column naming convention: camelCase for both the TypeScript key and the
 * Postgres column name. See users.ts for the rationale.
 *
 * Source Zod schema: packages/core-types/src/schemas/validation-stage.ts
 */
import {
  pgTable,
  text,
  timestamp,
  index,
} from 'drizzle-orm/pg-core';

import { generationRuns } from './generation-runs.js';
import { workspaces } from './workspaces.js';
import { users } from './users.js';

// ---------------------------------------------------------------------------
// Table
// ---------------------------------------------------------------------------

/** validation_runs. Stores metadata for each validation run record. */
export const validationRuns = pgTable('validation_runs', {
  /** UUID string (client-generated). */
  id: text('id').primaryKey(),

  /** FK to the triggering generation run. */
  generationRunId: text('generationRunId')
    .notNull()
    .references(() => generationRuns.id),

  /** FK to the workspace this validation belongs to (for RBAC). */
  workspaceId: text('workspaceId')
    .notNull()
    .references(() => workspaces.id),

  /** Current status of validation run. */
  status: text('status', { enum: ['pending', 'completed', 'failed'] })
    .notNull()
    .default('pending'),

  /** The user who triggered this validation (via API). */
  createdBy: text('createdBy')
    .notNull()
    .references(() => users.id),

  createdAt: timestamp('createdAt', { mode: 'date' }).notNull(),
  updatedAt: timestamp('updatedAt', { mode: 'date' }).notNull(),
}, (table) => ({
  generationRunIdx: index('validation_runs_generationRunId_idx').on(table.generationRunId),
  workspaceIdx: index('validation_runs_workspaceId_idx').on(table.workspaceId),
  createdByIdx: index('validation_runs_createdBy_idx').on(table.createdBy),
}));

// ---------------------------------------------------------------------------
// Type Exports
// ---------------------------------------------------------------------------

/** Type alias for validation run record. */
export type ValidationRun = typeof validationRuns.$inferSelect;
