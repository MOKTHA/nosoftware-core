/**
 * Drizzle table definition for `tasks`.
 *
 * Column naming convention: camelCase for both the TypeScript key and the
 * Postgres column name. See users.ts for the rationale.
 *
 * Source Zod schema: packages/core-types/src/schemas/task.ts
 */
import {
  pgTable,
  text,
  timestamp,
  pgEnum,
  index,
} from 'drizzle-orm/pg-core';

import { workspaces } from './workspaces.js';
import { projects } from './projects.js';
import { users } from './users.js';

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------

/** task.type. Mirrors `TaskType` in core-types. */
export const taskTypeEnum = pgEnum('task_type', [
  'generate-app',
  'generate-blueprint',
  'run-spec',
  'validate',
]);

/** task.status — FSM. Mirrors `TaskStatus` in core-types. */
export const taskStatusEnum = pgEnum('task_status', [
  'draft',
  'queued',
  'running',
  'succeeded',
  'failed',
  'cancelled',
]);

// ---------------------------------------------------------------------------
// Table
// ---------------------------------------------------------------------------

export const tasks = pgTable('tasks', {
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

  /** What kind of task this is. */
  type: taskTypeEnum('type').notNull(),

  /** Short title. */
  title: text('title').notNull(),

  /** Optional longer description. */
  description: text('description'),

  /** Lifecycle status (FSM). Defaults to 'draft'. */
  status: taskStatusEnum('status').notNull().default('draft'),

  /**
   * The prompt or spec input that initiated this task.
   * Nullable for draft tasks (user hasn't supplied one yet).
   */
  inputPrompt: text('inputPrompt'),

  /** The user who created this task. */
  createdBy: text('createdBy')
    .notNull()
    .references(() => users.id),

  createdAt: timestamp('createdAt', { mode: 'date' }).notNull(),
  updatedAt: timestamp('updatedAt', { mode: 'date' }).notNull(),

  /**
   * Set when the task moves into a terminal state (succeeded, failed,
   * cancelled). Remains null while in a non-terminal state.
   */
  completedAt: timestamp('completedAt', { mode: 'date' }),
}, (table) => ({
  workspaceIdx: index('tasks_workspaceId_idx').on(table.workspaceId),
  projectIdx: index('tasks_projectId_idx').on(table.projectId),
  createdByIdx: index('tasks_createdBy_idx').on(table.createdBy),
}));
