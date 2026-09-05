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
  DeployToVercelStage,
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

// OpenRouter LLM helper (Phase 5) + Agent SDK skills loader (Phase 6)
export {
  callOpenRouter,
  callOpenRouterWithUsage,
  callModelWithSkills,
  listAvailableSkills,
  resetTokenAccumulator,
  getAccumulatedTokenUsage,
} from './llm.js';
export type { OpenRouterCallOptions, SkillModelCallOptions, TokenUsage, OpenRouterResult } from './llm.js';

// OpenRouter Agent SDK skill tools (nextTurnParams pattern)
export {
  skillLoaderTool,
  multiSkillLoaderTool,
  skillDiscoveryTool,
  resolveSkillsDirectory,
} from './skills-loader.js';

// SSE build event streaming (Phase 5)
export { BuildEventEmitter } from './sse.js';
export type { BuildEvent } from './sse.js';

// UI/UX Design System (injected into LLM generation calls)
export {
  DESIGN_TOKENS,
  COMPONENT_PATTERNS,
  DESIGN_SYSTEM_PROMPT,
  SIDEBAR_PROMPT,
  PAGE_GENERATION_PROMPT,
  INSTALLED_SKILLS,
} from './design-system.js';

// Vercel deployment API helpers (Phase 6)
export {
  createOrGetVercelProject,
  setVercelProjectEnvVars,
  uploadProjectFiles,
  createVercelDeployment,
  pollDeployment,
} from './vercel-api.js';
