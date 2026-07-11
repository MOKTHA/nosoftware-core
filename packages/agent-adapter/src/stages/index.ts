/**
 * @heynxt/agent-adapter — Generation Stage Implementations (Phase 6)
 *
 * Concrete implementations of each generation stage in the pipeline.
 */

// Stage classes - all implement GenerationStage interface
export { NormalizeSpecStage } from './normalize-spec.js';
export { ResolveBlueprintPlanStage } from './resolve-blueprint-plan.js';
export { GenerateSchemaStage } from './generate-schema.js';
export { GeneratePermissionsStage } from './generate-permissions.js';
export { GenerateBackendStage } from './generate-backend.js';
export { GenerateFrontendStage } from './generate-frontend.js';
export { GenerateWorkflowsStage } from './generate-workflows.js';
export { GenerateFixturesTestsStage } from './generate-fixtures-tests.js';
export { GenerateDeploymentStage } from './generate-deployment.js';

// Re-export GenerationArtifact type for stage implementations
export type { GenerationArtifact } from '@heynxt/core-types';
