/**
 * @heynxt/agent-adapter — Pipeline Factory
 *
 * Builds a fully configured GenerationPipeline from an AppSpecTemplate.
 * The pipeline is returned in `pending` state — the caller starts it.
 *
 * Steps:
 *   1. Validate the spec via validateSpecTemplate.
 *   2. Construct a CreatePipelineInput.
 *   3. Register all 9 generation stages, mark the 4 core stages required.
 *   4. Build and return the pipeline (not started).
 */

import type { AppSpecTemplate } from '@heynxt/core-types';
import type { GenerationPipeline } from './generation-pipeline.js';
import { DefaultPipelineBuilder } from './generation-pipeline.js';
import { validateSpecTemplate } from './spec-validator.js';
import {
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

/**
 * Build a ready-to-start generation pipeline from an AppSpecTemplate.
 *
 * @param spec - The validated application specification template.
 * @param generationRunId - UUID tying this pipeline to a GenerationRun record.
 * @returns A GenerationPipeline in `pending` state.
 *
 * @throws {Error} If the spec fails validation (any error).
 */
export function buildPipelineFromSpec(
  spec: AppSpecTemplate,
  generationRunId: string,
): GenerationPipeline {
  // 1. Validate
  const validation = validateSpecTemplate(spec);
  if (!validation.valid) {
    throw new Error(
      `Spec validation failed:\n${validation.errors.map((e) => `  - ${e}`).join('\n')}`,
    );
  }

  // 2. Build the pipeline input from the AppSpecTemplate
  const initialInput = {
    spec: spec.spec as unknown as Record<string, unknown>,
    blueprintPlan: spec.blueprintPlan as unknown as Record<string, unknown>,
    params: spec.params,
  };

  // 3. Register all 9 stages and mark core stages required
  const builder = new DefaultPipelineBuilder();

  builder
    .addStage(new NormalizeSpecStage())
    .addStage(new ResolveBlueprintPlanStage())
    .addStage(new GenerateSchemaStage())
    .addStage(new GeneratePermissionsStage())
    .addStage(new GenerateBackendStage())
    .addStage(new GenerateFrontendStage())
    .addStage(new GenerateWorkflowsStage())
    .addStage(new GenerateFixturesTestsStage())
    .addStage(new GenerateDeploymentStage())
    .addRequiredStage('normalize-spec')
    .addRequiredStage('resolve-blueprint-plan')
    .addRequiredStage('generate-schema')
    .addRequiredStage('generate-permissions');

  // 4. Build and return (pending, not started)
  return builder.build({ generationRunId, initialInput });
}
