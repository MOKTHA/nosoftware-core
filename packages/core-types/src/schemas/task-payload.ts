/**
 * Task Payload Schema
 *
 * Defines the input payload that triggers an agent execution. This captures
 * task-specific data that varies per-execution, separate from the declarative
 * AgentSpec which defines "what" the agent is.
 *
 * Phase 2 Slice #1 - Core Types
 */

import { z } from 'zod';

/**
 * Unique identifier for a task payload execution request
 */
export const TaskPayloadIdSchema = z.string().uuid();
export type TaskPayloadId = z.infer<typeof TaskPayloadIdSchema>;

/**
 * Priority level for task execution scheduling
 */
export const TaskPrioritySchema = z.enum(['low', 'normal', 'high', 'urgent']);
export type TaskPriority = z.infer<typeof TaskPrioritySchema>;

/**
 * Input payload that triggers an agent execution.
 *
 * This schema captures:
 * - What specific task to run (inputData)
 * - Which agent spec should handle it (agentSpecId reference)
 * - Execution preferences for this particular invocation (priority, params)
 * - Optional context from external sources (contextFrom)
 *
 * The TaskPayload is separate from AgentSpec because:
 * 1. Specs are declarative and versioned; payloads are ephemeral executions
 * 2. Payloads can include runtime-specific data not suitable for specs
 * 3. Multiple tasks may use the same spec with different inputs
 */
export const TaskPayloadSchema = z.object({
  /** Unique identifier for this task payload execution request */
  id: TaskPayloadIdSchema,

  /** Reference to the AgentSpec that should handle this task */
  agentSpecId: z.string().uuid(),

  /** Priority level for scheduling and resource allocation */
  priority: TaskPrioritySchema.default('normal'),

  /** Primary input data for the agent to process. This is task-specific content
   * that varies per execution (e.g., user message, file path, API response)
   */
  inputData: z.record(z.string(), z.any()).default({}),

  /** Additional runtime parameters that override or supplement ExecutionConfig
   * from the AgentSpec. These are per-execution settings rather than spec-level defaults.
   */
  executionParams: z.object({
    /** Override timeout for this specific execution */
    timeoutSeconds: z.number().int().positive().optional(),

    /** Whether to use auto-retry for this execution (overrides spec default) */
    autoRetry: z.boolean().optional(),

    /** Additional context sources beyond what the spec defines */
    extraContextSources: z.array(z.string()).default([]),

    /** Custom tags/metadata for observability and filtering */
    metadata: z.record(z.string(), z.any()).optional()
  }).default({}),

  /** Origin of this task - who or what triggered it. Used for audit trails
   * and context tracing through multi-step workflows.
   */
  contextFrom: z.object({
    /** Entity that initiated the task (user ID, system component, webhook) */
    sourceId: z.string(),

    /** Type of trigger mechanism */
    sourceType: z.enum(['user', 'webhook', 'scheduled', 'cascade', 'api']),

    /** Correlation ID for tracing across service boundaries */
    correlationId: z.string().uuid().optional()
  }).default({ sourceId: 'system', sourceType: 'api' }),

  /** Timestamp when this task payload was created/requested */
  createdAt: z.coerce.date(),

  /** Optional timestamp for scheduled execution (if not immediate) */
  scheduledAt: z.coerce.date().optional()
});

export const TaskPayload = TaskPayloadSchema;
export type TaskPayload = z.infer<typeof TaskPayloadSchema>;

/**
 * Compact representation of a task payload for summaries and listings.
 * Excludes large or sensitive fields like inputData.
 */
export const TaskPayloadSummarySchema = z.object({
  id: TaskPayloadIdSchema,
  agentSpecId: z.string().uuid(),
  priority: TaskPrioritySchema,
  status: z.enum(['pending', 'queued', 'running', 'completed', 'failed']),
  contextFrom: z.object({
    sourceId: z.string(),
    sourceType: z.enum(['user', 'webhook', 'scheduled', 'cascade', 'api'])
  }),
  createdAt: z.coerce.date(),
  completedAt: z.coerce.date().optional()
});

export const TaskPayloadSummary = TaskPayloadSummarySchema;
export type TaskPayloadSummary = z.infer<typeof TaskPayloadSummarySchema>;

/**
 * Input schema for creating a new task payload execution request.
 * Excludes system fields like `id` and timestamps which are auto-generated.
 */
export const CreateTaskPayloadInputSchema = z.object({
  agentSpecId: z.string().uuid(),
  priority: TaskPrioritySchema.default('normal'),
  inputData: z.record(z.string(), z.any()).default({}),
  executionParams: z.object({
    timeoutSeconds: z.number().int().positive().optional(),
    autoRetry: z.boolean().optional(),
    extraContextSources: z.array(z.string()).default([]),
    metadata: z.record(z.string(), z.any()).optional()
  }).default({}),
  contextFrom: z.object({
    sourceId: z.string(),
    sourceType: z.enum(['user', 'webhook', 'scheduled', 'cascade', 'api']),
    correlationId: z.string().uuid().optional()
  }),
  scheduledAt: z.coerce.date().optional()
});

export const CreateTaskPayloadInput = CreateTaskPayloadInputSchema;
export type CreateTaskPayloadInput = z.infer<typeof CreateTaskPayloadInputSchema>;

/**
 * Utility function to check if a task payload is in a terminal state.
 * Terminal states are those where no further execution transitions occur.
 */
export function isTaskPayloadTerminal(payload: TaskPayload): boolean {
  // In current schema, all payloads can transition; status field would determine terminality
  // This will be updated when status tracking is added to the task lifecycle
  return false;
}
