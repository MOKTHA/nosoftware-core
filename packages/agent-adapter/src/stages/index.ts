/**
 * @heynxt/agent-adapter — Generation Stage Implementations (Phase 6)
 * Validation Stages (Phase 7)
 *
 * Concrete implementations of each generation stage in the pipeline.
 */

// Phase 6: Generation stage classes - all implement GenerationStage interface
export { NormalizeSpecStage } from './normalize-spec.js';
export { ResolveBlueprintPlanStage } from './resolve-blueprint-plan.js';
export { GenerateSchemaStage } from './generate-schema.js';
export { GeneratePermissionsStage } from './generate-permissions.js';
export { GenerateBackendStage } from './generate-backend.js';
export { GenerateFrontendStage } from './generate-frontend.js';
export { GenerateWorkflowsStage } from './generate-workflows.js';
export { GenerateFixturesTestsStage } from './generate-fixtures-tests.js';
export { GenerateDeploymentStage } from './generate-deployment.js';

// Phase 7: Validation stage classes - implement GenerationStage interface for validation checks
export * as ValidationStages from './validation/index.js';

// Re-export GenerationArtifact type for stage implementations
export type { GenerationArtifact } from '@heynxt/core-types';
