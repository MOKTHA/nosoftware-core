/**
 * @heynxt/core-types — AgentSpec schemas (Phase 2)
 *
 * Defines the contract between the control plane and the agent runtime:
 * what kind of agent to run, with which config, and how its output is
 * described back. The schemas mirror the vercel coding-agent-template
 * task-creation pattern (one JSON blob describing every execution
 * parameter) so that a single API call can bootstrap an agent session.
 *
 * Exported symbols:
 *
 *   AgentSpecId, AgentType, AgentStatus
 *     ID and enum subtypes used by the main object and database layer.
 *
 *   AgentSpec (Zod + TS via z.infer)
 *     Declarative description of which coding agent to invoke and how.
 *     Immutable once status reaches a terminal state.
 *
 *   ExecutionConfig (Zod + TS)
 *     Runtime parameters the control plane attaches to every execution:
 *     timeouts, retries, tool-set, context sources, model overrides.
 *
 *   AgentExecutionResult (Zod + TS)
 *     Outcome record returned by an agent runtime after execution.
 *     Tied back to a GenerationRun via agentSessionId.
 */

import { z } from 'zod';

/** ------------------------------------------------------------------ */
/*  IDs                                                                */
/** ------------------------------------------------------------------ */

export const AgentSpecId = z.string().uuid();

/** ------------------------------------------------------------------ */
/*  Enums                                                              */
/** ------------------------------------------------------------------ */

/**
 * Which coding-agent substrate this spec targets.
 *
 * 'vercel-coding-agent' — the Vercel coding-agent-template runtime
 *   (sandbox + tool-use loop via Anthropic API)
 *
 * 'anthropic-claude-code' — direct Claude Code CLI invocations
 *   (no sandbox, operator-facing dev workflow)
 *
 * 'stub-shell' — local no-op shim used during development and testing.
 */
export const AgentType = z.enum([
  'vercel-coding-agent',
  'anthropic-claude-code',
  'stub-shell',
]);

/**
 * Status lifecycle for an AgentSpec (declarative contract).
 *
 *   draft    → active      (first activate)
 *   active   → deprecated  (replaced by a newer spec version)
 *   active   → error       (agent runtime rejects this config)
 *   error    → active      (after config is corrected)
 *
 * Terminal states: deprecated, error — the spec should not be used
 * for new executions until someone resolves it.
 */
export const AgentStatus = z.enum([
  'draft',     // created, not yet activated
  'active',    // ready for execution
  'deprecated',// replaced by a newer version; keep for reference
  'error',     // rejected by agent runtime; needs fix
]);

/** ------------------------------------------------------------------ */
/*  ExecutionConfig                                                  */
/** ------------------------------------------------------------------ */

/**
 * Runtime parameters for agent execution.
 *
 * Each field is a Zod schema that validates the shape; whether a value
 * is sent to the runtime or merged with defaults depends on the adapter.
 * null means "use the agent's built-in default."
 *
 * The toolSet object maps tool names to their configuration:
 *   { name: string, mode: 'allow' | 'deny' | 'prompt', schema?: Json }
 *
 * Context sources list where the agent should pull additional context from.
 * Supported source types (interpreted by each adapter at runtime):
 *   'spec'       — the prompt-to-spec pipeline output
 *   'blueprint'  — an industrial blueprint from the registry
 *   'repo'       — relevant files in the current repository
 *   'user-feedback' — previous generation feedback / corrections
 */
export const ExecutionConfig = z.object({

  /** Maximum execution time in seconds (null = provider default). */
  timeoutSeconds: z.number().int().positive().nullable(),

  /** Retry budget for transient errors. null = no retries. */
  retryBudgetSeconds: z.number().int().positive().nullable(),

  /** Whether to retry automatically on transient errors. */
  autoRetry: z.boolean().default(true),

  /** Model override (null = use agent's default model). */
  modelOverride: z.string().max(100).nullable(),

  /** Sampling temperature for model responses. null = provider default. */
  temperature: z.number().min(0).max(2).nullable(),

  /**
   * Tool-set: which tools to allow, deny, or ask about before running.
   * Keys are tool names; values map to { mode: 'allow' | 'deny' | 'prompt' }.
   */
  toolSet: z.record(z.string(), z.object({
    mode: z.enum(['allow', 'deny', 'prompt']),
    description: z.string().nullable().optional(),
  })).nullable(),

  /** Context sources to pull additional context from. */
  contextSources: z.array(z.enum(['spec', 'blueprint', 'repo', 'user-feedback'])).nullable(),
});

export type ExecutionConfig = z.infer<typeof ExecutionConfig>;

/** ------------------------------------------------------------------ */
/*  Main object                                                      */
/** ------------------------------------------------------------------ */

/**
 * AgentSpec — declarative description of which coding agent to invoke.
 *
 * Immutable once status reaches a terminal state (deprecated / error).
 * Callers create a new spec version instead of modifying an existing one.
 */
export const AgentSpec = z.object({
  id: AgentSpecId,

  /** Parent reference (optional — specs can be shared across projects). */
  projectId: z.string().uuid().nullish(),

  /** Human-readable name for the agent configuration. */
  displayName: z.string().min(1).max(200),

  /** Which coding-agent substrate to target. */
  type: AgentType.default('vercel-coding-agent'),

  /** Status — see AgentStatus docblock above. */
  status: AgentStatus.default('draft'),

  /** System prompt or instructions the agent should follow. */
  systemPrompt: z.string().max(50_000).nullable(),

  /**
   * High-level task description (what the user asked for).
   * Stored here so specs are self-contained and can be audited.
   */
  taskDescription: z.string().max(10_000).nullable(),

  /** Runtime configuration attached to every execution of this spec. */
  config: ExecutionConfig,

  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

export type AgentSpec = z.infer<typeof AgentSpec>;
export type AgentSpecId = z.infer<typeof AgentSpecId>;
export type AgentType = z.infer<typeof AgentType>;
export type AgentStatus = z.infer<typeof AgentStatus>;

/** ------------------------------------------------------------------ */
/*  Summary subset                                                   */
/** ------------------------------------------------------------------ */

/** Compact representation for lists, dropdowns, and parent summaries. */
export const AgentSpecSummary = AgentSpec.pick({
  id: true,
  displayName: true,
  type: true,
  status: true,
  taskDescription: true,
  createdAt: true,
});

export type AgentSpecSummary = z.infer<typeof AgentSpecSummary>;

/** ------------------------------------------------------------------ */
/*  Helpers                                                          */
/** ------------------------------------------------------------------ */

/**
 * Whether an agent spec status is terminal (no further transitions).
 *
 * Terminal states: deprecated, error. Use this helper to decide whether
 * a spec can be reused vs. needs correction or replacement.
 */
export function isAgentSpecTerminal(status: AgentStatus): boolean {
  return status === 'deprecated' || status === 'error';
}

/** ------------------------------------------------------------------ */
/*  AgentExecutionResult                                             */
/** ------------------------------------------------------------------ */

/** ID subtype for agent execution result records. */
export const AgentExecutionResultId = z.string().uuid();

/** Status of an agent execution after it completes (or fails). */
export const ExecutionResultStatus = z.enum([
  'succeeded',   // agent completed successfully
  'failed',      // unrecoverable error
  'cancelled',   // user cancelled mid-execution
  'timeout',     // exceeded timeoutBudgetSeconds
]);

/**
 * Outcome record returned by an agent runtime after execution.
 *
 * The `rawPayload` field carries provider-specific structured output
 * (file diffs, tool call history, step summaries). Callers interpret it.
 */
export const AgentExecutionResult = z.object({
  id: AgentExecutionResultId,

  /** The spec this execution was based on. */
  agentSpecId: AgentSpecId,

  /** The task that triggered this execution. */
  taskId: z.string().uuid(),

  /** Status (terminal — no further transitions). */
  status: ExecutionResultStatus,

  /** Provider-specific structured output / diffs. */
  rawPayload: z.record(z.unknown(), z.unknown()).nullable(),

  /** Short human-readable summary of what the agent did. */
  summary: z.string().max(5_000).nullable(),

  /** Error details (if status is 'failed'). null otherwise. */
  errorDetails: z.string().nullable(),

  startedAt: z.coerce.date(),
  completedAt: z.coerce.date(),
});

export type AgentExecutionResult = z.infer<typeof AgentExecutionResult>;
export type AgentExecutionResultId = z.infer<typeof AgentExecutionResultId>;
export type ExecutionResultStatus = z.infer<typeof ExecutionResultStatus>;

/** ------------------------------------------------------------------ */
/*  Helpers                                                          */
/** ------------------------------------------------------------------ */

/**
 * Whether an execution result has reached a terminal status.
 *
 * Terminal states: succeeded, failed, cancelled, timeout — no further
 * transitions are possible; the record is immutable once written.
 */
export function isExecutionResultTerminal(status: ExecutionResultStatus): boolean {
  // All statuses in this enum are terminal (one-pass execution).
  return status === 'succeeded' || status === 'failed' || status === 'cancelled' || status === 'timeout';
}

/** ------------------------------------------------------------------ */
/*  Input schemas                                                    */
/** ------------------------------------------------------------------ */

/**
 * Input schema for creating a new AgentSpec.
 *
 * Omits server-generated fields:
 *   - `id` (UUID, server-assigned)
 *   - `createdAt` / `updatedAt` (timestamps, server-assigned)
 *   - `status` (server-defaults to `'draft'`)
 */
export const CreateAgentSpecInput = AgentSpec.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  status: true,
}).partial({
  projectId: true,
  systemPrompt: true,
  taskDescription: true,
});

export type CreateAgentSpecInput = z.infer<typeof CreateAgentSpecInput>;

/**
 * Input schema for creating an AgentExecutionResult record.
 *
 * This represents a caller's request to execute an agent spec, not the
 * result itself — the name reflects the Phase 2 buildplan terminology.
 *
 * Omits server-generated fields:
 *   - `id` (UUID, server-assigned)
 * * `startedAt` / `completedAt` (set by status transitions, not creation)
 *   - `status` (server-defaults to `'running'` on creation; set to
 *     the terminal value by the adapter after execution).
 */
export const CreateExecutionResultInput = AgentExecutionResult.omit({
  id: true,
  startedAt: true,
  completedAt: true,
  status: true,
}).partial({
  agentSpecId: true,
  summary: true,
  errorDetails: true,
  rawPayload: true,
});

export type CreateExecutionResultInput = z.infer<typeof CreateExecutionResultInput>;
