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

// Generation pipeline (Phase 6) - orchestration and types
export * from './generation-pipeline.js';

// Generation stages (Phase 6) - concrete implementations
export {
  NormalizeSpecStage,
  ResolveBlueprintPlanStage,
  GenerateSchemaStage,
  GeneratePermissionsStage,
  GenerateBackendStage,
  GenerateFrontendStage,
  GenerateWorkflowsStage,
  GenerateFixturesTestsStage,
  GenerateDeploymentStage,
} from './stages/index.js';

// Re-export core types for stage implementations
export type { GenerationArtifact } from '@heynxt/core-types';
