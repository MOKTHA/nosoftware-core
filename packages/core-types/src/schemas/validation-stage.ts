/**
 * @heynxt/core-types — Validation Stages (Phase 7)
 *
 * Schemas for the validation and review loop that verifies generated outputs
 * before promotion to production. Each validation check produces evidence
 * (logs, test reports, screenshots) with pass/fail status.
 */

import { z } from 'zod';
import { ValidationCheckType, ValidationResult as Phase7ValidationResult } from './generation-pipeline.js';

/** ------------------------------------------------------------------ */
/*  Legacy Types - Re-exported for backward compatibility           */
/** ------------------------------------------------------------------ */

/** Alias for the main ValidationCheckType from generation-pipeline. */
export const ValidationCheckTypeExtended = ValidationCheckType;

/**
 * Result of a single validation check (Phase 7).
 * This is an alias for the main ValidationResult type defined in generation-pipeline.ts.
 * Distinct from Phase 4's prompt ValidationResult.
 */
export const ValidationRunResult = z.object({
  /** Unique ID for this validation result. */
  id: z.string().uuid(),

  /** Type of validation performed. */
  checkType: ValidationCheckTypeExtended,

  /** Status of the validation check. */
  status: z.enum(['passed', 'failed', 'skipped']),

  /** Evidence URL/path - where logs, reports, screenshots are stored. */
  evidenceUrl: z.string().url(),

  /** Execution duration in milliseconds. */
  durationMs: z.number().int().nonnegative(),

  /** Detailed output/logs from the validation run. */
  outputLog: z.string(),

  /** Test summary (e.g., "12/15 tests passed"). */
  testSummary: z.string().nullish(),

  /** Number of issues found (errors, warnings). */
  issueCount: z.number().int().nonnegative().default(0),

  /** Whether this check blocks promotion when failed. */
  blocksPromotion: z.boolean().default(true),

  startedAt: z.coerce.date(),
  completedAt: z.coerce.date(),
});

export type ValidationRunResult = z.infer<typeof ValidationRunResult>;

/** ------------------------------------------------------------------ */
/*  Validation Run                                                    */
/** ------------------------------------------------------------------ */

/**
 * Complete validation run for a generated app slice.
 * Contains all validation checks and their results.
 */
export const ValidationRunRecord = z.object({
  /** Unique ID for this validation run. */
  id: z.string().uuid(),

  /** The generation run that was validated. */
  generationRunId: z.string().uuid(),

  /** Spec version used for generation (for traceability). */
  specVersion: z.string(),

  /** Blueprint plan version used for generation (for traceability). */
  blueprintPlanVersion: z.string(),

  /** All validation checks performed in this run. */
  results: z.array(ValidationRunResult),

  /** Overall status of the validation run. */
  status: z.enum([
    'pending',     // not yet started
    'running',     // some checks still executing
    'passed',      // all checks passed
    'failed',      // one or more critical checks failed
    'partial',     // some checks skipped, others ran
  ]),

  /** Whether promotion is blocked due to failures. */
  promotionBlocked: z.boolean().default(false),

  /** Override flag - allows bypassing failure blocks (with reason). */
  overrideFlag: z.string().nullish(),

  /** Override reason if flag is set. */
  overrideReason: z.string().nullish(),

  startedAt: z.coerce.date(),
  completedAt: z.coerce.date().optional(),
});

export type ValidationRunRecord = z.infer<typeof ValidationRunRecord>;

/** ------------------------------------------------------------------ */
/*  Evidence Capture                                                */
/** ------------------------------------------------------------------ */

/**
 * Evidence artifact captured during validation.
 * Phase 7 Exit Criteria: All validation evidence is immutable once attached;
 * fresh evidence required for reruns (no stale artifacts).
 */
export const ValidationEvidence = z.object({
  /** Unique ID for this evidence item. */
  id: z.string().uuid(),

  /** The validation run this evidence belongs to. */
  validationRunId: z.string().uuid(),

  /** Which check produced this evidence. */
  checkType: z.lazy(() => ValidationCheckType),

  /** Type of evidence (log file, screenshot, test report, diff). */
  kind: z.enum([
    'log-file',        // Execution logs from the validation run
    'test-report',     // Test framework output (Jest, Vitest, etc.)
    'screenshot',      // Visual evidence of UI state
    'diff',            // Code diff showing changes between runs
    'coverage-report', // Code coverage analysis results
    'build-output',    // Build system output logs
    'migration-log',   // Database migration execution logs
    'api-response',    // API endpoint response captures
  ]),

  /** Storage path/URL for the evidence file. */
  storagePath: z.string(),

  /** File size in bytes. */
  fileSizeBytes: z.number().int().nonnegative(),

  /** Content hash (SHA-256) - ensures immutability. */
  contentHash: z.string().length(64),

  /** Whether this is fresh evidence or cached/stale artifact. */
  isFreshEvidence: z.boolean().default(true),

  createdAt: z.coerce.date(),
});

export type ValidationEvidence = z.infer<typeof ValidationEvidence>;

/** ------------------------------------------------------------------ */
/*  Approval/Rejection Workflow                                       */
/** ------------------------------------------------------------------ */

/**
 * Approval decision on a generated app for promotion.
 * Phase 7 Exit Criteria: Owner/editor can approve or reject PRs; approver role required.
 */
export const ApprovalDecision = z.object({
  /** Unique ID for this approval decision. */
  id: z.string().uuid(),

  /** The generation run being approved/rejected. */
  generationRunId: z.string().uuid(),

  /** The validation run that was reviewed. */
  validationRunId: z.string().uuid(),

  /** Decision made by the approver. */
  decision: z.enum(['approved', 'rejected']),

  /** Who made this approval decision (user ID). */
  approvedBy: z.string().uuid(),

  /** Approval timestamp. */
  decidedAt: z.coerce.date(),

  /** Reason for the decision (required when rejected). */
  reason: z.string(),

  /** Comments from the approver. */
  comments: z.string().nullish(),

  /** Whether this approval requires a second reviewer (for production promotions). */
  requiresSecondApproval: z.boolean().default(false),

  /** Second approval status and details. */
  secondApproverId: z.string().uuid().nullish(),
  secondApprovedAt: z.coerce.date().nullish(),
});

export type ApprovalDecision = z.infer<typeof ApprovalDecision>;

/** ------------------------------------------------------------------ */
/*  Rerun Configuration                                               */
/** ------------------------------------------------------------------ */

/**
 * Request to rerun generation with feedback from failed validation.
 * Phase 7 Exit Criteria: Failed validations trigger rerun capability; user can provide feedback.
 */
export const RerunRequest = z.object({
  /** Unique ID for this rerun request. */
  id: z.string().uuid(),

  /** The original generation run to rerun. */
  originalGenerationRunId: z.string().uuid(),

  /** Feedback from failed validation (what needs fixing). */
  feedback: z.string(),

  /** Who requested the rerun. */
  requestedBy: z.string().uuid(),

  /** Request timestamp. */
  requestedAt: z.coerce.date(),

  /** Status of this rerun request. */
  status: z.enum([
    'pending',     // waiting to be processed
    'processing',  // generation in progress
    'completed',   // new generation run created
    'cancelled',   // rerun was cancelled
  ]),

  /** The new generation run ID (after completion). */
  newGenerationRunId: z.string().uuid().nullish(),

  completedAt: z.coerce.date().optional(),
});

export type RerunRequest = z.infer<typeof RerunRequest>;

/** ------------------------------------------------------------------ */
/*  PR Creation Metadata                                              */
/** ------------------------------------------------------------------ */

/**
 * Pull request metadata created from generated changes.
 * Phase 7 Exit Criteria: Generated changes automatically create PR with all validation evidence attached.
 */
export const PRMetadata = z.object({
  /** Unique ID for this PR record in heynxt-core. */
  id: z.string().uuid(),

  /** The generation run that created this PR. */
  generationRunId: z.string().uuid(),

  /** GitHub PR number (if pushed to repo). */
  prNumber: z.number().int().positive().nullish(),

  /** GitHub repository URL or name. */
  repositoryUrl: z.string().url(),

  /** Branch name created for this generation. */
  branchName: z.string(),

  /** PR title (auto-generated from spec). */
  prTitle: z.string(),

  /** PR description with evidence summary. */
  prDescription: z.string(),

  /** All validation results attached as PR comments/links. */
  validationResultsSummary: z.array(
    z.object({
      checkType: ValidationCheckType,
      status: z.enum(['passed', 'failed']),
      evidenceUrl: z.string().url(),
    })
  ),

  /** Whether this PR has all checks passing (ready to merge). */
  readyToMerge: z.boolean().default(false),

  /** GitHub PR URL. */
  prUrl: z.string().url().nullish(),

  createdAt: z.coerce.date(),
});

export type PRMetadata = z.infer<typeof PRMetadata>;

/** ------------------------------------------------------------------ */
/*  Type Aliases                                                      */
/** ------------------------------------------------------------------ */

// Type exports
export type ValidationCheckTypeExtended = z.infer<typeof ValidationCheckTypeExtended>;

// Additional type aliases for convenience (using the main ValidationResult from generation-pipeline)
export type ValidationCheckResult = Phase7ValidationResult;
export type ValidationRunRecordType = z.infer<typeof ValidationRunRecord>;
