/**
 * @heynxt/agent-adapter
 *
 * Agent execution adapter layer.
 * Bridges the control plane to coding-agent runtimes (inspired by
 * Vercel coding-agent-template). Handles agent spawning, execution
 * monitoring, and result collection.
 */

// Core runtime types and interfaces
export {
  BaseAgentRuntime,
  InMemoryEventEmitter,
  StubAgentRuntime,
  StubExecutionHandle,
} from './runtime.js';

export type {
  AgentRuntime,
  SpawnConfig,
  OutputEvent,
  ExecutionContext,
  ExecutionValidation,
  ExecutionHandle,
  EventEmitter,
} from './runtime.js';

// Vercel SDK adapter
export {
  VercelSdkRuntime,
  VercelSdkHandle,
  createVercelRuntime,
} from './vercel-sdk.js';

export type {
  VercelSdkConfig,
  VercelStreamEvent,
} from './vercel-sdk.js';
