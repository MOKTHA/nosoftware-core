import { z } from 'zod';
import { WorkspaceId } from './workspace.js';
import { ProjectId } from './project.js';
import { UserId } from './user.js';

/**
 * Task schema — a unit of executable work inside a project.
 *
 * A task produces zero or more generation runs. The task schema captures:
 * - who created it
 * - what it's asking the system to do
 * - its current status (FSM)
 * - linkage to parent entities (Project → Workspace)
 *
 * Status transitions:
 *   draft    → queued      (user submits)
 *   queued   → running     (execution begins)
 *   queued   → cancelled   (user cancels before execution)
 *   running  → succeeded   (exit)
 *   running  → failed      (exit)
 *   running  → cancelled   (user cancels mid-execution)
 * Terminal states: succeeded, failed, cancelled
 *
 * Design notes:
 * - The `inputPrompt` is nullable to support draft tasks that haven't been
 *   submitted yet. Enforcement that submitted tasks must have an inputPrompt
 *   happens via transition validation, not schema.
 * - `completedAt` is set when status moves out of draft/queued into a
 *   terminal state (succeeded, failed, cancelled). It remains null while
 *   the task is still in a non-terminal state.
 */

export const TaskId = z.string().uuid();

export const TaskType = z.enum([
  'generate-app',       // generate an industrial app from a prompt
  'generate-blueprint', // generate a blueprint from a prompt
  'run-spec',           // run the prompt-to-spec pipeline
  'validate',           // run validation on a previously generated artifact
]);

export const TaskStatus = z.enum([
  'draft',      // created, not yet submitted
  'queued',     // submitted, waiting for execution
  'running',    // currently being executed
  'succeeded',  // execution completed successfully
  'failed',     // execution failed
  'cancelled',  // manually cancelled
]);

export const Task = z.object({
  id: TaskId,
  workspaceId: WorkspaceId,
  projectId: ProjectId,
  type: TaskType,
  title: z.string().min(1).max(200),
  description: z.string().max(8000).nullish(),
  status: TaskStatus.default('draft'),

  // The prompt or spec input that initiated this task.
  // For draft tasks, may be null (user hasn't supplied one yet).
  // For submitted tasks, must be non-null. (Enforcement via
  // transition validation, not schema.)
  inputPrompt: z.string().max(50000).nullish(),

  createdBy: UserId,

  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),

  // Set when status moves out of draft/queued into a terminal state.
  // null while the task is still in a non-terminal state.
  completedAt: z.coerce.date().nullish(),
});

export type Task = z.infer<typeof Task>;
export type TaskId = z.infer<typeof TaskId>;
export type TaskType = z.infer<typeof TaskType>;
export type TaskStatus = z.infer<typeof TaskStatus>;

/**
 * Subset used when embedding tasks in generation runs, UI lists, or
 * parent project summaries.
 */
export const TaskSummary = Task.pick({
  id: true,
  workspaceId: true,
  projectId: true,
  type: true,
  title: true,
  status: true,
  createdBy: true,
  createdAt: true,
  completedAt: true,
});

export type TaskSummary = z.infer<typeof TaskSummary>;

/**
 * Check whether a task status is terminal (i.e., no further transitions allowed).
 */
export function isTaskTerminal(status: TaskStatus): boolean {
  return status === 'succeeded' || status === 'failed' || status === 'cancelled';
}

/**
 * Input schema for creating a new Task.
 *
 * Omits server-generated fields:
 *   - `id` (UUID, server-assigned)
 *   - `createdAt` / `updatedAt` (timestamps, server-assigned)
 *   - `status` (server-defaults to `'draft'`)
 *   - `completedAt` (set when the task reaches a terminal status)
 *
 * `createdBy` is temporarily required from the caller — once RBAC middleware
 * is in place, it will be supplied from the session context.
 *
 * `inputPrompt` is optional here — draft tasks may omit it until submission.
 * Enforcement that submitted tasks have an inputPrompt happens at the API
 * transition layer, not in this create schema.
 */
export const CreateTaskInput = Task.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  status: true,
  completedAt: true,
}).partial({
  description: true,
  inputPrompt: true,
});

export type CreateTaskInput = z.infer<typeof CreateTaskInput>;
