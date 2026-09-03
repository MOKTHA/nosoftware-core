/**
 * @heynxt/agent-adapter — Pipeline Factory
 *
 * Builds a fully configured GenerationPipeline from an AppSpecTemplate.
 * The pipeline is returned in `pending` state — the caller starts it.
 *
 * Steps:
 *   1. Validate the spec via validateSpecTemplate.
 *   2. Construct a CreatePipelineInput.
 *   3. Create a shared PipelineContext (mutable state between stages).
 *   4. Register all 9 generation stages with the context injected.
 *   5. Mark the 4 core stages as required.
 *   6. Build and return the pipeline (not started).
 */

import type { AppSpecTemplate } from '@heynxt/core-types';
import type { GenerationPipeline } from './generation-pipeline.js';
import { DefaultPipelineBuilder } from './generation-pipeline.js';
import { createPipelineContext } from './pipeline-context.js';
import { validateSpecTemplate } from './spec-validator.js';
import type { BuildEventEmitter } from './sse.js';
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
 * @param emitter - Optional SSE emitter; if provided, each stage emits
 *   `running` / `done` / `error` events as it executes.
 * @returns A GenerationPipeline in `pending` state.
 *
 * @throws {Error} If the spec fails validation (any error).
 */
export function buildPipelineFromSpec(
  spec: AppSpecTemplate,
  generationRunId: string,
  emitter?: BuildEventEmitter,
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

  // 3. Create shared mutable context for inter-stage communication
  const ctx = createPipelineContext();

  // 4. Register all 9 stages with the shared context injected
  const builder = new DefaultPipelineBuilder();

  builder
    .addStage(new NormalizeSpecStage(ctx))
    .addStage(new ResolveBlueprintPlanStage(ctx))
    .addStage(new GenerateSchemaStage(ctx))
    .addStage(new GeneratePermissionsStage(ctx))
    .addStage(new GenerateBackendStage(ctx))
    .addStage(new GenerateFrontendStage(ctx))
    .addStage(new GenerateWorkflowsStage(ctx))
    .addStage(new GenerateFixturesTestsStage(ctx))
    .addStage(new GenerateDeploymentStage(ctx))
    .addRequiredStage('normalize-spec')
    .addRequiredStage('resolve-blueprint-plan')
    .addRequiredStage('generate-schema')
    .addRequiredStage('generate-permissions');

  // 5. Build and return (pending, not started)
  const pipeline = builder.build({ generationRunId, initialInput });

  // 6. If an SSE emitter was provided, subscribe to stage completions
  if (emitter) {
    pipeline.subscribe((result) => {
      const status = result.execution.status === 'succeeded'
        ? 'done' as const
        : result.execution.status === 'failed'
          ? 'error' as const
          : 'running' as const;
      const detail = result.execution.summary
        ?? result.execution.errorDetails
        ?? result.execution.stageName;
      emitter.emit(result.execution.stageName, status, detail);
    });
  }

  return pipeline;
}
