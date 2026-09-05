/**
 * @heynxt/agent-adapter — Runtime core
 *
 * Defines the AgentRuntime interface and base implementations for spawning,
 * monitoring, and collecting results from coding agent executions.
 */

import type {
  AgentSpec,
  ExecutionConfig,
  AgentExecutionResult,
  AgentType,
} from '@heynxt/core-types';

/** ------------------------------------------------------------------ */
/*  Core interfaces                                                    */
/** ------------------------------------------------------------------ */

/**
 * Configuration for spawning an agent execution.
 * Includes the spec to use and runtime overrides.
 */
export interface SpawnConfig {
  /** The agent spec defining what to run. */
  spec: AgentSpec;

  /** Override timeout in seconds (null = use spec default). */
  timeoutSeconds?: number | null;

  /** Additional context sources to inject at spawn time. */
  extraContext?: Record<string, unknown>;

  /** Callback for streaming output events during execution. */
  onOutput?: (event: OutputEvent) => void;
}

/**
 * Streaming output event types from an agent runtime.
 */
export type OutputEvent =
  | { type: 'step-start'; stepId: string; title: string }
  | { type: 'step-progress'; stepId: string; progress: number; message?: string }
  | { type: 'step-complete'; stepId: string; durationMs: number }
  | { type: 'tool-call'; toolName: string; args: Record<string, unknown>; callId: string }
  | { type: 'tool-result'; callId: string; result: Record<string, unknown> }
  | { type: 'file-change'; path: string; action: 'create' | 'update' | 'delete' }
  | { type: 'error'; message: string; severity: 'warning' | 'error' }
  | { type: 'system-log'; level: 'info' | 'debug' | 'warn'; message: string };

/**
 * Execution context passed to an agent runtime.
 * Contains everything the agent needs to start working.
 */
export interface ExecutionContext {
  /** The spec this execution is based on. */
  spec: AgentSpec;

  /** Current system time (for testing). */
  now: () => Date;

  /** Stream for emitting output events. */
  emitter: EventEmitter<OutputEvent>;

  /** Abort signal for cancellation. */
  abortSignal: AbortSignal;

  /** Context sources resolved at spawn time. */
  contextSources: Record<string, unknown>;
}

/**
 * AgentRuntime — interface for executing agent specs.
 *
 * Implementations target different runtimes (Vercel coding-agent-template,
 * direct Claude Code CLI, stub-shell).
 */
export interface AgentRuntime {
  /** Unique identifier for this runtime implementation. */
  readonly id: string;

  /** Human-readable name. */
  readonly name: string;

  /** The agent type this runtime supports. */
  readonly supportedType: AgentType;

  /**
   * Spawn an execution for the given spec.
   * Returns a handle that can be used to monitor and collect results.
   */
  spawn(config: SpawnConfig): Promise<ExecutionHandle>;

  /**
   * Validate whether this runtime can execute the given config.
   * Called before spawning to catch incompatibilities early.
   */
  validateConfig(spec: AgentSpec, overrides?: Partial<SpawnConfig>): ExecutionValidation;

  /** Cleanup resources (close ports, kill orphaned processes). */
  cleanup?(): Promise<void>;
}

/**
 * Validation result from validateConfig().
 */
export interface ExecutionValidation {
  valid: boolean;
  errors: string[];
  warnings: string[];
  suggestions?: Array<{ field: string; message: string }>;
}

/**
 * Handle for an in-flight execution.
 */
export interface ExecutionHandle {
  /** Unique execution ID (same as the result id once created). */
  readonly executionId: string;

  /** Whether this handle has been cancelled/aborted. */
  readonly isAborted: boolean;

  /** Abort the running execution. */
  abort(): void;

  /** Wait for completion and return the final result. */
  collect(): Promise<AgentExecutionResult>;

  /** Subscribe to output events (streaming). */
  subscribe(
    handler: (event: OutputEvent) => void,
    onComplete?: () => void
  ): () => void; // returns unsubscribe function
}

/** ------------------------------------------------------------------ */
/*  Base implementation                                              */
/** ------------------------------------------------------------------ */

/**
 * Abstract base class for AgentRuntime implementations.
 * Provides common validation logic and helper methods.
 */
export abstract class BaseAgentRuntime implements AgentRuntime {
  readonly id: string;
  readonly name: string;
  readonly supportedType: AgentType;

  constructor(
    id: string,
    name: string,
    supportedType: AgentType
  ) {
    this.id = id;
    this.name = name;
    this.supportedType = supportedType;
  }

  /** Abstract spawn method — must be implemented by subclasses. */
  abstract spawn(config: SpawnConfig): Promise<ExecutionHandle>;

  /** Default validation — check spec status and basic config sanity. */
  validateConfig(
    spec: AgentSpec,
    overrides?: Partial<SpawnConfig>
  ): ExecutionValidation {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Check if spec is in a usable state
    if (spec.status === 'deprecated') {
      errors.push(
        `Spec "${spec.displayName}" is deprecated; create a new active spec instead`
      );
    } else if (spec.status === 'error') {
      warnings.push(`Spec "${spec.displayName}" has error status but may still be executable`);
    }

    // Validate config sanity
    const timeoutSeconds = overrides?.timeoutSeconds ?? spec.config.timeoutSeconds;
    if (timeoutSeconds !== null && timeoutSeconds !== undefined) {
      if (typeof timeoutSeconds !== 'number' || timeoutSeconds <= 0) {
        errors.push('timeoutSeconds must be a positive number or null');
      } else if (timeoutSeconds > 86400) {
        warnings.push('timeoutSeconds exceeds 24 hours; consider breaking into smaller tasks');
      }
    }

    const retryBudget = spec.config.retryBudgetSeconds;
    if (retryBudget !== null && retryBudget !== undefined) {
      if (typeof retryBudget !== 'number' || retryBudget <= 0) {
        errors.push('retryBudgetSeconds must be a positive number or null');
      }
    }

    return { valid: errors.length === 0, errors, warnings };
  }

  /** Emit an output event through the context emitter. */
  protected emitEvent(
    emitter: EventEmitter<OutputEvent>,
    event: OutputEvent
  ): void {
    try {
      emitter.emit(event);
    } catch (err) {
      // Don't let handler errors break execution
      console.error('Output handler error:', err);
    }
  }

  /** Cleanup — no-op by default, override if needed. */
  async cleanup?(): Promise<void> {
    // Subclasses can override for resource cleanup
  }
}

/** ------------------------------------------------------------------ */
/*  Event emitter utility                                            */
/** ------------------------------------------------------------------ */

export interface EventEmitter<T> {
  emit(event: T): void;
  on(handler: (event: T) => void): () => void;
}

/** Simple in-memory event emitter for output streaming. */
export class InMemoryEventEmitter implements EventEmitter<OutputEvent> {
  private handlers: Array<(event: OutputEvent) => void> = [];

  emit(event: OutputEvent): void {
    this.handlers.forEach((handler) => handler(event));
  }

  on(handler: (event: OutputEvent) => void): () => void {
    this.handlers.push(handler);
    return () => {
      const idx = this.handlers.indexOf(handler);
      if (idx !== -1) {
        this.handlers.splice(idx, 1);
      }
    };
  }
}

/** ------------------------------------------------------------------ */
/*  Stub implementation for testing                                  */
/** ------------------------------------------------------------------ */

export class StubAgentRuntime extends BaseAgentRuntime {
  constructor() {
    super('stub', 'Stub Runtime (testing)', 'stub-shell');
  }

  async spawn(config: SpawnConfig): Promise<ExecutionHandle> {
    const executionId = crypto.randomUUID();
    const emitter = new InMemoryEventEmitter();

    // Emit a step-start event immediately
    this.emitEvent(emitter, {
      type: 'step-start',
      stepId: `stub-${executionId}`,
      title: 'Stub agent execution started',
    });

    return new StubExecutionHandle(executionId, emitter);
  }

  validateConfig(spec: AgentSpec): ExecutionValidation {
    // Stub accepts any spec for testing purposes
    if (spec.status === 'deprecated') {
      return { valid: false, errors: ['Deprecated specs not allowed in stub runtime'], warnings: [] };
    }
    return { valid: true, errors: [], warnings: [] };
  }
}

export class StubExecutionHandle implements ExecutionHandle {
  readonly executionId: string;
  private emitter: EventEmitter<OutputEvent>;
  private _isAborted = false;

  constructor(executionId: string, emitter: EventEmitter<OutputEvent>) {
    this.executionId = executionId;
    this.emitter = emitter;
  }

  get isAborted(): boolean {
    return this._isAborted;
  }

  abort(): void {
    this._isAborted = true;
  }

  async collect(): Promise<AgentExecutionResult> {
    // Simulate a successful stub execution
    this.emitEvent(this.emitter, {
      type: 'step-complete',
      stepId: `stub-${this.executionId}`,
      durationMs: 10,
    });

    return {
      id: this.executionId,
      agentSpecId: '', // Would be set by the caller
      taskId: crypto.randomUUID(),
      status: 'succeeded',
      rawPayload: null,
      summary: 'Stub execution completed successfully (testing mode)',
      errorDetails: null,
      startedAt: new Date(Date.now() - 10),
      completedAt: new Date(),
    };
  }

  subscribe(
    handler: (event: OutputEvent) => void,
    onComplete?: () => void
  ): () => void {
    const unsubscribe = this.emitter.on(handler);
    if (onComplete) {
      setTimeout(onComplete, 10); // Simulate completion callback
    }
    return unsubscribe;
  }

  private emitEvent(emitter: EventEmitter<OutputEvent>, event: OutputEvent): void {
    try {
      emitter.emit(event);
    } catch (err) {
      console.error('Stub runtime output handler error:', err);
    }
  }
}
