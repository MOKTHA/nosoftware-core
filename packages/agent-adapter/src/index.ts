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

// Evidence capture (Phase 7.3) - content-addressable storage for validation evidence
export * from './evidence-capture.js';

// Spec validation gate
export { validateSpecTemplate } from './spec-validator.js';
export type { SpecValidationResult } from './spec-validator.js';

// Pipeline factory
export { buildPipelineFromSpec } from './pipeline-factory.js';

// Pipeline context (Phase 5) — shared mutable state between stages
export { createPipelineContext } from './pipeline-context.js';
export type { PipelineContext } from './pipeline-context.js';

// OpenRouter LLM helper (Phase 5)
export { callOpenRouter } from './llm.js';
export type { OpenRouterCallOptions } from './llm.js';

// SSE build event streaming (Phase 5)
export { BuildEventEmitter } from './sse.js';
export type { BuildEvent } from './sse.js';
