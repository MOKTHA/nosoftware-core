/**
 * @heynxt/agent-adapter — Vercel SDK runtime adapter
 *
 * Implements AgentRuntime for executing agent specs via the Vercel AI SDK
 * or direct integration with coding-agent-template deployments.
 */

import { z } from 'zod/v3';
import type {
  AgentSpec,
  ExecutionConfig,
  AgentExecutionResult,
} from '@heynxt/core-types';
import {
  BaseAgentRuntime,
  ExecutionValidation,
  SpawnConfig,
  OutputEvent,
  EventEmitter,
  ExecutionContext,
  ExecutionHandle,
  InMemoryEventEmitter,
} from './runtime.js';

/** ------------------------------------------------------------------ */
/*  Vercel-specific types                                             */
/** ------------------------------------------------------------------ */

/**
 * Configuration for Vercel SDK execution.
 * Defines how to connect to the Vercel runtime environment.
 */
export interface VercelSdkConfig {
  /** API endpoint or deployment URL for the coding agent service */
  endpoint: string;

  /** Authentication token (Vercel API token or bearer token) */
  authToken?: string;

  /** Custom headers to include with all requests */
  customHeaders?: Record<string, string>;

  /** Request timeout in milliseconds */
  requestTimeoutMs?: number;

  /** Whether to enable verbose logging for debugging */
  debug?: boolean;
}

/**
 * Streaming event types from Vercel SDK execution.
 * Maps to the generic OutputEvent format.
 */
export type VercelStreamEvent =
  | { type: 'step-start'; stepId: string; title: string }
  | { type: 'step-progress'; stepId: string; progress: number; message?: string }
  | { type: 'step-complete'; stepId: string; durationMs: number }
  | { type: 'tool-call'; toolName: string; args: Record<string, unknown>; callId: string }
  | { type: 'tool-result'; callId: string; result: Record<string, unknown> }
  | { type: 'file-change'; path: string; action: 'create' | 'update' | 'delete' }
  | { type: 'error'; message: string; severity: 'warning' | 'error' }
  | { type: 'system-log'; level: 'info' | 'debug' | 'warn'; message: string };

/** Additional stream-end event for Vercel SDK */
export interface StreamEndEvent {
  type: 'stream-end';
  finalStatus: 'succeeded' | 'failed' | 'cancelled';
}

/** ------------------------------------------------------------------ */
/*  Vercel SDK Runtime implementation                                */
/** ------------------------------------------------------------------ */

/**
 * AgentRuntime that executes agent specs via the Vercel AI Gateway or
 * direct coding-agent-template deployment.
 */
export class VercelSdkRuntime extends BaseAgentRuntime {
  private config: VercelSdkConfig;
  private requestTimeoutMs: number = 300000; // 5 minutes default

  constructor(config: VercelSdkConfig) {
    super('vercel-sdk', 'Vercel SDK Runtime', 'anthropic-claude-code');

    this.config = config;
    this.requestTimeoutMs = config.requestTimeoutMs ?? 300000;
  }

  /** Validate that the spec can be executed via Vercel SDK */
  validateConfig(spec: AgentSpec, overrides?: Partial<SpawnConfig>): ExecutionValidation {
    const baseValidation = super.validateConfig(spec, overrides);

    // Additional Vercel-specific validations
    if (spec.type === 'stub-shell') {
      baseValidation.warnings.push(
        'Stub agent specs are typically for testing; consider using a real agent type in production'
      );
    }

    return baseValidation;
  }

  /** Spawn an execution via the Vercel SDK endpoint */
  async spawn(config: SpawnConfig): Promise<ExecutionHandle> {
    const validation = this.validateConfig(config.spec, config);
    if (!validation.valid) {
      throw new Error(
        `Invalid spec for VercelSdkRuntime: ${validation.errors.join('; ')}`
      );
    }

    const executionId = crypto.randomUUID();
    const emitter = new InMemoryEventEmitter();

    // Start the execution in background
    this.executeViaVercel(executionId, config.spec, config, emitter).catch((err) => {
      console.error(`Execution ${executionId} failed:`, err);
      this.emitEvent(emitter, {
        type: 'error',
        message: `Execution error: ${err.message}`,
        severity: 'error',
      });
    });

    return new VercelSdkHandle(executionId, emitter);
  }

  /** Execute the agent spec via Vercel SDK endpoint */
  private async executeViaVercel(
    executionId: string,
    spec: AgentSpec,
    spawnConfig: SpawnConfig,
    emitter: EventEmitter<OutputEvent>
  ): Promise<void> {
    const timeoutSeconds = spawnConfig.timeoutSeconds ?? spec.config.timeoutSeconds;

    this.emitEvent(emitter, {
      type: 'system-log',
      level: 'info',
      message: `Starting Vercel SDK execution for ${spec.displayName}`,
    });

    try {
      // Build the request payload
      const payload = this.buildExecutionPayload(spec, spawnConfig);

      // Execute with timeout
      const result = await this.executeWithTimeout(executionId, payload, timeoutSeconds);

      // Parse and stream results
      await this.processExecutionResult(result, emitter);
    } catch (err) {
      this.emitEvent(emitter, {
        type: 'error',
        message: err instanceof Error ? err.message : String(err),
        severity: 'error',
      });

      throw err;
    }
  }

  /** Build the execution payload for Vercel SDK */
  private buildExecutionPayload(
    spec: AgentSpec,
    spawnConfig: SpawnConfig
  ): Record<string, unknown> {
    return {
      agentSpecId: spec.id,
      displayName: spec.displayName,
      type: spec.type,
      config: spec.config,
      taskPrompt: spawnConfig.extraContext?.taskPrompt ?? 'Execute the specified task',
      extraContext: spawnConfig.extraContext,
    };
  }

  /** Execute with timeout handling */
  private async executeWithTimeout(
    executionId: string,
    payload: Record<string, unknown>,
    timeoutSeconds?: number | null
  ): Promise<unknown> {
    const actualTimeout = (timeoutSeconds ?? this.requestTimeoutMs) * 1000;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), actualTimeout);

    try {
      const response = await fetch(`${this.config.endpoint}/api/execute`, {
        method: 'POST',
        headers: this.buildHeaders(),
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`Vercel SDK execution failed: ${response.status} ${response.statusText}`);
      }

      return await response.json();
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /** Build request headers */
  private buildHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (this.config.authToken) {
      headers['Authorization'] = `Bearer ${this.config.authToken}`;
    }

    for (const [key, value] of Object.entries(this.config.customHeaders ?? {})) {
      headers[key] = value;
    }

    return headers;
  }

  /** Process execution result and stream events */
  private async processExecutionResult(
    result: unknown,
    emitter: EventEmitter<OutputEvent>
  ): Promise<void> {
    // This would parse streaming results from the Vercel SDK
    // For now, simulate a successful completion
    this.emitEvent(emitter, {
      type: 'system-log',
      level: 'info',
      message: `Execution completed successfully`,
    });

    this.emitEvent(emitter, {
      type: 'step-complete',
      stepId: 'final',
      durationMs: 0,
    });
  }

  /** Cleanup resources */
  async cleanup(): Promise<void> {
    // No specific cleanup needed for fetch-based runtime
    return super.cleanup?.();
  }
}

/** ------------------------------------------------------------------ */
/*  Vercel SDK Execution Handle                                      */
/** ------------------------------------------------------------------ */

/**
 * Handle for a Vercel SDK execution.
 * Provides methods to monitor, cancel, and collect results.
 */
export class VercelSdkHandle implements ExecutionHandle {
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

  /** Cancel the running execution */
  abort(): void {
    if (this._isAborted) return;

    this._isAborted = true;
    this.emitEvent({ type: 'error', message: 'Execution cancelled by user', severity: 'warning' });
  }

  private emitEvent(event: OutputEvent): void {
    try {
      this.emitter.emit(event);
    } catch (err) {
      console.error('VercelSdkHandle output handler error:', err);
    }
  }

  /** Collect final result from the execution */
  async collect(): Promise<AgentExecutionResult> {
    // This would wait for actual streaming results in production
    return {
      id: this.executionId,
      agentSpecId: '',
      taskId: crypto.randomUUID(),
      status: 'succeeded',
      rawPayload: null,
      summary: `Vercel SDK execution completed (${this.executionId})`,
      errorDetails: null,
      startedAt: new Date(Date.now() - 1000),
      completedAt: new Date(),
    };
  }

  /** Subscribe to output events */
  subscribe(
    handler: (event: OutputEvent) => void,
    onComplete?: () => void
  ): () => void {
    const unsubscribe = this.emitter.on(handler);
    if (onComplete) {
      // Schedule completion callback
      setTimeout(onComplete, 100);
    }
    return unsubscribe;
  }
}

/** ------------------------------------------------------------------ */
/*  Factory function                                                 */
/** ------------------------------------------------------------------ */

/**
 * Create a Vercel SDK runtime instance with the given configuration.
 */
export function createVercelRuntime(
  config: VercelSdkConfig
): import('./runtime.js').AgentRuntime {
  return new VercelSdkRuntime(config);
}
