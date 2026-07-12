/**
 * Drizzle table definition for `validation_results`.
 *
 * Column naming convention: camelCase for both the TypeScript key and the
 * Postgres column name. See users.ts for the rationale.
 *
 * Source Zod schema: packages/core-types/src/schemas/validation-stage.ts
 */
import {
  pgTable,
  text,
  integer,
  boolean,
  timestamp,
  index,
} from 'drizzle-orm/pg-core';

import type { ValidationCheckType } from '@heynxt/core-types';
import { validationRuns } from './validation-run.js';

// ---------------------------------------------------------------------------
// Table
// ---------------------------------------------------------------------------

/**
 * validation_results. Stores individual check results within a validation run.
 * Each validation run contains multiple checks (lint, typecheck, tests, etc.).
 */
export const validationResults = pgTable('validation_results', {
  /** UUID string (client-generated). */
  id: text('id').primaryKey(),

  /** FK to the parent validation run. */
  validationRunId: text('validationRunId')
    .notNull()
    .references(() => validationRuns.id),

  /** Type of validation check performed. */
  checkType: text('checkType', { enum: ['lint', 'typecheck', 'unit-tests', 'integration-tests', 'smoke-tests', 'build', 'routes', 'api-smoke', 'permissions-check', 'migration-verify', 'route-smoke'] })
    .notNull(),

  /** Result status of this specific check. */
  status: text('status', { enum: ['passed', 'failed', 'skipped'] })
    .notNull(),

  /** URL/path to the evidence artifact in storage. */
  evidenceUrl: text('evidenceUrl').notNull(),

  /** Full output log from the validation check (JSON string). */
  outputLog: text('outputLog'),

  /** Human-readable summary of results. */
  testSummary: text('testSummary'),

  /** Number of issues found (errors + warnings/2 for pass/fail scoring). */
  issueCount: integer('issueCount').notNull().default(0),

  /** Whether this check blocks promotion to production. */
  blocksPromotion: boolean('blocksPromotion').notNull().default(false),

  createdAt: timestamp('createdAt', { mode: 'date' }).notNull(),
}, (table) => ({
  validationRunIdx: index('validation_results_validationRunId_idx').on(table.validationRunId),
  checkTypeIdx: index('validation_results_checkType_idx').on(table.checkType),
}));

// ---------------------------------------------------------------------------
// Type Exports
// ---------------------------------------------------------------------------

/** Type alias for validation result database record (Drizzle inferred type). */
export type ValidationResultDbRecord = typeof validationResults.$inferSelect;
