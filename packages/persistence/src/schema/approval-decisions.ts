/**
 * @heynxt/persistence — Approval Decisions Schema (Phase 7.5)
 *
 * Tracks approval/rejection decisions on generated apps for promotion.
 */

import { pgTable, text, varchar, timestamp, boolean } from 'drizzle-orm/pg-core';
import type { InferSelectModel, InferInsertModel } from 'drizzle-orm';

import { users } from './users.js';
import { generationRuns } from './generation-runs.js';

/**
 * Approval decision table - stores approver decisions on generated apps.
 *
 * Note: uses text() columns for IDs to match the text() PKs on
 * users and generation_runs tables. Previous uuid() columns caused
 * drizzle-kit FK type mismatches.
 */
export const approvalDecisions = pgTable('approval_decisions', {
  /** Unique ID for this approval decision. */
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),

  /** The generation run being approved/rejected. */
  generationRunId: text('generation_run_id')
    .notNull()
    .references(() => generationRuns.id),

  /** The validation run that was reviewed. */
  validationRunId: text('validation_run_id'),

  /** Decision made by the approver: approved or rejected. */
  decision: varchar('decision', { enum: ['approved', 'rejected'] }).notNull(),

  /** Who made this approval decision (user ID). */
  approvedBy: text('approved_by')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),

  /** Approval timestamp. */
  decidedAt: timestamp('decided_at').notNull().defaultNow(),

  /** Reason for the decision (required when rejected). */
  reason: text('reason').notNull(),

  /** Comments from the approver. */
  comments: text('comments'),

  /** Whether this approval requires a second reviewer (for production promotions). */
  requiresSecondApproval: boolean('requires_second_approval').notNull().default(false),

  /** Second approval status and details. */
  secondApproverId: text('second_approver_id').references(() => users.id, { onDelete: 'set null' }),
  secondApprovedAt: timestamp('second_approved_at'),

  /** Timestamp of this record. */
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export type ApprovalDecision = InferSelectModel<typeof approvalDecisions>;
export type InsertApprovalDecision = InferInsertModel<typeof approvalDecisions>;

/**
 * Rerun request table - tracks rerun requests with feedback.
 */
export const rerunRequests = pgTable('rerun_requests', {
  /** Unique ID for this rerun request. */
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),

  /** The original generation run to rerun. */
  originalGenerationRunId: text('original_generation_run_id')
    .notNull()
    .references(() => generationRuns.id),

  /** Feedback from failed validation (what needs fixing). */
  feedback: text('feedback').notNull(),

  /** Who requested the rerun (user ID). */
  requestedBy: text('requested_by')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),

  /** Request timestamp. */
  requestedAt: timestamp('requested_at').notNull().defaultNow(),

  /** Status of this rerun request. */
  status: varchar('status', { enum: ['pending', 'processing', 'completed', 'cancelled'] })
    .notNull()
    .default('pending'),

  /** The new generation run ID (after completion). */
  newGenerationRunId: text('new_generation_run_id').references(() => generationRuns.id, { onDelete: 'set null' }),

  /** Timestamp of this record. */
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export type RerunRequest = InferSelectModel<typeof rerunRequests>;
export type InsertRerunRequest = InferInsertModel<typeof rerunRequests>;
