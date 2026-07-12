/**
 * @heynxt/persistence — Approval Decisions Schema (Phase 7.5)
 *
 * Tracks approval/rejection decisions on generated apps for promotion.
 */

import { pgTable, uuid, varchar, text, timestamp, boolean, ForeignKeyRef } from 'drizzle-orm/pg-core';
import type { InferSelectModel, InferInsertModel } from 'drizzle-orm';

/**
 * Approval decision table - stores approver decisions on generated apps.
 */
export const approvalDecisions = pgTable('approval_decisions', {
  /** Unique ID for this approval decision. */
  id: uuid('id').primaryKey().defaultRandom(),

  /** The generation run being approved/rejected. */
  generationRunId: uuid('generation_run_id')
    .notNull()
    .$defaultFn(() => crypto.randomUUID()),

  /** The validation run that was reviewed. */
  validationRunId: uuid('validation_run_id'),

  /** Decision made by the approver: approved or rejected. */
  decision: varchar('decision', { enum: ['approved', 'rejected'] }).notNull(),

  /** Who made this approval decision (user ID). */
  approvedBy: uuid('approved_by')
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
  secondApproverId: uuid('second_approver_id').references(() => users.id, { onDelete: 'set null' }),
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
  id: uuid('id').primaryKey().defaultRandom(),

  /** The original generation run to rerun. */
  originalGenerationRunId: uuid('original_generation_run_id')
    .notNull()
    .$defaultFn(() => crypto.randomUUID()),

  /** Feedback from failed validation (what needs fixing). */
  feedback: text('feedback').notNull(),

  /** Who requested the rerun (user ID). */
  requestedBy: uuid('requested_by')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),

  /** Request timestamp. */
  requestedAt: timestamp('requested_at').notNull().defaultNow(),

  /** Status of this rerun request. */
  status: varchar('status', { enum: ['pending', 'processing', 'completed', 'cancelled'] })
    .notNull()
    .default('pending'),

  /** The new generation run ID (after completion). */
  newGenerationRunId: uuid('new_generation_run_id').references(() => generationRuns.id, { onDelete: 'set null' }),

  /** Timestamp of this record. */
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export type RerunRequest = InferSelectModel<typeof rerunRequests>;
export type InsertRerunRequest = InferInsertModel<typeof rerunRequests>;
