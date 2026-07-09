import { z } from 'zod';
import { WorkspaceId } from './workspace.js';
import { ProjectId } from './project.js';
import { TaskId } from './task.js';
import { UserId } from './user.js';

/**
 * GenerationRun schema — one execution (or re-execution) of a task.
 *
 * A generation run ties together the triggering task, the spec version used,
 * the blueprint versions used, the set of artifacts produced, and execution
 * metadata (logs, duration, exit status). Each task can have multiple runs
 * (initial attempt + re-runs after feedback). Runs are immutable once terminal.
 *
 * Design notes:
 * - `runNumber` is monotonically increasing per-task: run #1 is the first
 *   attempt, #2 is the first re-run, etc. Uniqueness is within `taskId` and
 *   is enforced at the API/DB layer, not in the schema.
 * - `snapshot` is stored as opaque JSON so the schema stays stable as spec
 *   and blueprint version shapes evolve. Callers interpret the contents.
 * - `agentSessionId` matches the vercel coding-agent-template pattern where
 *   sessions can be resumed via `--resume <sessionId>`. It is null until the
 *   agent runtime assigns one.
 * - The status FSM is a small, well-defined set of transitions; see the
 *   transitions block below for the canonical list.
 *
 * Status transitions:
 *   pending   → running    (execution begins)
 *   pending   → cancelled  (user cancels before start)
 *   running   → succeeded
 *   running   → failed
 *   running   → cancelled
 * Terminal states: succeeded, failed, cancelled
 */

export const GenerationRunId = z.string().uuid();

export const GenerationRunStatus = z.enum([
  'pending',    // created, not yet started
  'running',    // currently executing
  'succeeded',  // completed successfully
  'failed',     // execution failed
  'cancelled',  // manually cancelled
]);

/**
 * Snapshot of what was used to produce this run.
 *
 * Stored as opaque JSON so the schema stays stable as spec and blueprint
 * versions evolve. The hashes allow callers to detect drift between the
 * snapshot and the current spec/blueprint state.
 */
export const GenerationRunSnapshot = z.object({
  specId: z.string().nullish(),            // spec version used (may be null if no spec)
  specHash: z.string().nullish(),          // content hash of the spec
  blueprintPlanId: z.string().nullish(),
  blueprintPlanHash: z.string().nullish(),
});

export const GenerationRun = z.object({
  id: GenerationRunId,
  workspaceId: WorkspaceId,
  projectId: ProjectId,
  taskId: TaskId,

  /**
   * Monotonically increasing per-task run number.
   * Run #1 is the first attempt; #2 is the first re-run, etc.
   * Unique within (taskId). Enforced at the API/DB layer.
   */
  runNumber: z.number().int().positive(),

  status: GenerationRunStatus.default('pending'),

  /** What was used to produce this run (frozen at creation time). */
  snapshot: GenerationRunSnapshot,

  /**
   * Agent session ID for resumption (matches the vercel coding-agent-template
   * pattern where sessions can be resumed via `--resume <sessionId>`).
   * null until the agent runtime assigns one.
   */
  agentSessionId: z.string().nullish(),

  createdBy: UserId,

  startedAt: z.coerce.date().nullish(),
  completedAt: z.coerce.date().nullish(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

export type GenerationRun = z.infer<typeof GenerationRun>;
export type GenerationRunId = z.infer<typeof GenerationRunId>;
export type GenerationRunStatus = z.infer<typeof GenerationRunStatus>;
export type GenerationRunSnapshot = z.infer<typeof GenerationRunSnapshot>;

/**
 * Subset used when embedding runs in task details, UI lists, or summaries.
 */
export const GenerationRunSummary = GenerationRun.pick({
  id: true,
  taskId: true,
  projectId: true,
  workspaceId: true,
  runNumber: true,
  status: true,
  agentSessionId: true,
  startedAt: true,
  completedAt: true,
  createdAt: true,
});

export type GenerationRunSummary = z.infer<typeof GenerationRunSummary>;

/**
 * Whether a run status is terminal (no further transitions are possible).
 *
 * Terminal states: succeeded, failed, cancelled. Use this helper to decide
 * whether a run is still mutable vs. done.
 */
export function isGenerationRunTerminal(status: GenerationRunStatus): boolean {
  return status === 'succeeded' || status === 'failed' || status === 'cancelled';
}

/**
 * Input schema for creating a new GenerationRun.
 *
 * Omits server-generated fields:
 *   - `id` (UUID, server-assigned)
 *   - `runNumber` (server-computed as MAX(runNumber)+1 within the task)
 *   - `createdAt` / `updatedAt` (timestamps, server-assigned)
 *   - `status` (server-defaults to `'pending'`)
 *   - `agentSessionId` (assigned by the agent runtime on first execution)
 *   - `startedAt` / `completedAt` (set by status transitions, not creation)
 *
 * `snapshot` is optional — defaults to an empty snapshot `{}` (no spec and
 * no blueprint plan referenced). Callers can provide explicit spec/blueprint
 * identifiers and hashes for full traceability.
 *
 * `createdBy` is temporarily required from the caller — once RBAC middleware
 * is in place (Phase 1 follow-up), it will be supplied from the session
 * context and moved out of the public input schema.
 */
export const CreateGenerationRunInput = GenerationRun.omit({
  id: true,
  runNumber: true,
  createdAt: true,
  updatedAt: true,
  status: true,
  agentSessionId: true,
  startedAt: true,
  completedAt: true,
}).partial({
  snapshot: true,
});

export type CreateGenerationRunInput = z.infer<typeof CreateGenerationRunInput>;
