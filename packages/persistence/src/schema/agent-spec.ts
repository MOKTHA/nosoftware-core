/**
 * Drizzle table definition for `agent_specs`.
 *
 * Stores declarative agent configuration that defines which coding agent
 * to invoke and with what parameters. Immutable once status reaches terminal state.
 *
 * Source Zod schema: packages/core-types/src/schemas/agent-spec.ts
 */
import {
  pgTable,
  text,
  timestamp,
  pgEnum,
  index,
  jsonb,
} from 'drizzle-orm/pg-core';
import { projects } from './projects.js';

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------

/** agent.type. Mirrors `AgentType` in core-types. */
export const agentTypeEnum = pgEnum('agent_type', [
  'vercel-coding-agent',
  'anthropic-claude-code',
  'stub-shell',
]);

/** agent.status — FSM for declarative spec lifecycle. */
export const agentStatusEnum = pgEnum('agent_status', [
  'draft',     // created, not yet activated
  'active',    // ready for execution
  'deprecated',// replaced by newer version; keep for reference
  'error',     // rejected by agent runtime; needs fix
]);

/** Status of an agent execution after it completes (or fails). */
export const executionResultStatusEnum = pgEnum('execution_result_status', [
  'succeeded',   // agent completed successfully
  'failed',      // unrecoverable error
  'cancelled',   // user cancelled mid-execution
  'timeout',     // exceeded timeout budget
]);

// ---------------------------------------------------------------------------
// Table: agent_specs (declarative configuration)
// ---------------------------------------------------------------------------

export const agentSpecs = pgTable('agent_specs', {
  /** UUID string (client-generated). */
  id: text('id').primaryKey(),

  /** Parent project reference (optional — specs can be shared across projects). */
  projectId: text('projectId')
    .references(() => projects.id),

  /** Human-readable name for the agent configuration. */
  displayName: text('displayName').notNull(),

  /** Which coding-agent substrate to target. */
  type: agentTypeEnum('type').notNull().default('vercel-coding-agent'),

  /** Status — see AgentStatus docblock above. */
  status: agentStatusEnum('status').notNull().default('draft'),

  /** System prompt or instructions the agent should follow. */
  systemPrompt: text('systemPrompt'),

  /**
   * High-level task description (what the user asked for).
   * Stored here so specs are self-contained and can be audited.
   */
  taskDescription: text('taskDescription'),

  /** Runtime configuration as JSONB — mirrors ExecutionConfig schema. */
  config: jsonb('config')
    .notNull()
    .$type<{
      timeoutSeconds: number | null;
      retryBudgetSeconds: number | null;
      autoRetry: boolean;
      modelOverride: string | null;
      temperature: number | null;
      toolSet: Record<string, { mode: 'allow' | 'deny' | 'prompt'; description?: string }> | null;
      contextSources: Array<'spec' | 'blueprint' | 'repo' | 'user-feedback'> | null;
    }>(),

  createdAt: timestamp('createdAt', { mode: 'date' }).notNull(),
  updatedAt: timestamp('updatedAt', { mode: 'date' }).notNull(),
}, (table) => ({
  statusIdx: index('agent_specs_status_idx').on(table.status),
  typeIdx: index('agent_specs_type_idx').on(table.type),
}));

// ---------------------------------------------------------------------------
// Table: agent_execution_results (execution outcome records)
// ---------------------------------------------------------------------------

export const agentExecutionResults = pgTable('agent_execution_results', {
  /** UUID string (client-generated). */
  id: text('id').primaryKey(),

  /** The spec this execution was based on. */
  agentSpecId: text('agentSpecId')
    .notNull()
    .references(() => agentSpecs.id),

  /** The task that triggered this execution. */
  taskId: text('taskId')
    .notNull(),

  /** Status (terminal — no further transitions). */
  status: executionResultStatusEnum('status').notNull(),

  /** Provider-specific structured output / diffs as JSONB. */
  rawPayload: jsonb('rawPayload'),

  /** Short human-readable summary of what the agent did. */
  summary: text('summary'),

  /** Error details (if status is 'failed'). Null otherwise. */
  errorDetails: text('errorDetails'),

  startedAt: timestamp('startedAt', { mode: 'date' }).notNull(),
  completedAt: timestamp('completedAt', { mode: 'date' }).notNull(),
}, (table) => ({
  agentSpecIdx: index('agent_exec_agent_spec_idx').on(table.agentSpecId),
  taskIdx: index('agent_exec_task_idx').on(table.taskId),
}));
