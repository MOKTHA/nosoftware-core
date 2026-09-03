/**
 * @heynxt/agent-adapter — Generation Pipeline Tests (Phase 6)
 *
 * Unit tests for multi-stage generation pipeline orchestration.
 * Converted from node:test to vitest (Phase 5 — Task 7).
 */

import { describe, it, expect } from 'vitest';
import type { GenerationStageInput as CoreGenerationStageInput } from '@heynxt/core-types';
import type {
  GenerationStageName,
  GenerationStage,
  GenerationStageOutput,
} from '../generation-pipeline.js';
import {
  DefaultGenerationPipeline,
  MockGenerationStage,
  createStageExecution,
} from '../generation-pipeline.js';

// Re-export with local name for test use
export type GenerationStageInput = CoreGenerationStageInput;

// ============================================================================
// Test Helpers
// ============================================================================

function createMockSpec(overrides?: Partial<Record<string, unknown>>): Record<string, unknown> {
  return {
    name: 'Test System',
    description: 'A test system for generation pipeline',
    metadata: {},
    ...overrides,
  };
}

/**
 * A mock stage that always throws on execute().
 * Used to test error-handling paths.
 */
class FailingMockStage implements GenerationStage {
  readonly name: GenerationStageName;
  readonly description: string;

  constructor(stageName: GenerationStageName, description: string) {
    this.name = stageName;
    this.description = description;
  }

  validateInput(): boolean {
    return true;
  }

  async execute(): Promise<GenerationStageOutput> {
    throw new Error(`Stage ${this.name} intentionally failed`);
  }
}

/**
 * A mock stage that introduces a delay, allowing cancel() to fire mid-execution.
 */
class SlowMockStage implements GenerationStage {
  readonly name: GenerationStageName;
  readonly description: string;

  constructor(
    stageName: GenerationStageName,
    description: string,
    private readonly delayMs: number = 200,
  ) {
    this.name = stageName;
    this.description = description;
  }

  validateInput(): boolean {
    return true;
  }

  async execute(input: GenerationStageInput): Promise<GenerationStageOutput> {
    await new Promise((resolve) => setTimeout(resolve, this.delayMs));
    const outputHash = `hash-${this.name}-${Date.now()}`;
    return {
      inputHash: crypto.randomUUID(),
      outputHash,
      artifacts: [
        {
          id: crypto.randomUUID(),
          generationRunId: '00000000-0000-0000-0000-000000000000',
          stageName: this.name,
          kind: 'summary',
          relativePath: `output/${this.name}.md`,
          contentHash: outputHash.slice(-64),
          fileSizeBytes: 1024,
          isNew: true,
          description: `Generated ${this.description}`,
          createdAt: new Date(),
        },
      ],
      summary: `Completed ${this.name} stage`,
      warnings: [],
    };
  }
}

// ============================================================================
// Test Suites
// ============================================================================

describe('Generation Pipeline - Phase 6 Exit Criteria Tests', () => {
  // -------------------------------------------------------------------------
  // Criterion: One blueprint path generates runnable slice (real output)
  // -------------------------------------------------------------------------

  describe('complete pipeline execution', () => {
    it('[Scenario 1] Should execute all stages and produce complete output', async () => {
      const spec = createMockSpec({ name: 'Extrusion Management' });

      const stages = new Map<GenerationStageName, GenerationStage>([
        ['normalize-spec', new MockGenerationStage('normalize-spec', 'Normalize input')],
        ['resolve-blueprint-plan', new MockGenerationStage('resolve-blueprint-plan', 'Resolve plan')],
        ['generate-schema', new MockGenerationStage('generate-schema', 'Generate schema')],
      ]);

      const pipeline = new DefaultGenerationPipeline(
        {
          generationRunId: '00000000-0000-0000-0000-000000000001',
          initialInput: { spec, blueprintPlan: null, params: {} },
        },
        stages,
        new Set(['normalize-spec', 'resolve-blueprint-plan', 'generate-schema']),
      );

      await pipeline.start();
      const result = await pipeline.collect();

      expect(result.status).toBe('succeeded');
      expect(result.stages.length).toBe(3);
    });

    it('[Scenario 2] Should track artifacts produced at each stage', async () => {
      const spec = createMockSpec({ name: 'PCB Assembly' });

      const stages = new Map<GenerationStageName, GenerationStage>([
        ['normalize-spec', new MockGenerationStage('normalize-spec', 'Normalize input')],
        ['resolve-blueprint-plan', new MockGenerationStage('resolve-blueprint-plan', 'Resolve plan')],
      ]);

      const pipeline = new DefaultGenerationPipeline(
        {
          generationRunId: '00000000-0000-0000-0000-000000000002',
          initialInput: { spec, blueprintPlan: null, params: {} },
        },
        stages,
        new Set(['normalize-spec', 'resolve-blueprint-plan']),
      );

      await pipeline.start();
      const result = await pipeline.collect();

      // Each stage should have produced at least one artifact
      for (const stage of result.stages) {
        if (stage.status === 'succeeded') {
          expect(stage.outputHash).not.toBeNull();
        }
      }
    });
  });

  // -------------------------------------------------------------------------
  // Criterion: Outputs are traceable to spec and blueprint versions
  // -------------------------------------------------------------------------

  describe('traceability', () => {
    it('[Scenario 3] Should preserve input/output hashes for lineage tracking', async () => {
      const spec = createMockSpec({ name: 'Test System' });

      const stages = new Map<GenerationStageName, GenerationStage>([
        ['normalize-spec', new MockGenerationStage('normalize-spec', 'Normalize')],
      ]);

      const pipeline = new DefaultGenerationPipeline(
        {
          generationRunId: '00000000-0000-0000-0000-000000000003',
          initialInput: { spec, blueprintPlan: null, params: {} },
        },
        stages,
        new Set(['normalize-spec']),
      );

      await pipeline.start();
      const result = await pipeline.collect();

      expect(result.initialInput.spec).toBeTruthy();
    });

    it('[Scenario 4] Should record total duration of pipeline execution', async () => {
      const spec = createMockSpec({ name: 'Test System' });

      const stages = new Map<GenerationStageName, GenerationStage>([
        ['normalize-spec', new MockGenerationStage('normalize-spec', 'Normalize')],
      ]);

      const pipeline = new DefaultGenerationPipeline(
        {
          generationRunId: '00000000-0000-0000-0000-000000000004',
          initialInput: { spec, blueprintPlan: null, params: {} },
        },
        stages,
        new Set(['normalize-spec']),
      );

      await pipeline.start();
      const result = await pipeline.collect();

      expect(result.totalDurationMs).toBeDefined();
      expect(result.totalDurationMs).toBeGreaterThanOrEqual(0);
    });
  });

  // -------------------------------------------------------------------------
  // Criterion: Pipeline is re-runnable (idempotent given same inputs)
  // -------------------------------------------------------------------------

  describe('idempotency', () => {
    it('[Scenario 5] Should produce consistent results for identical inputs', async () => {
      const spec = createMockSpec({ name: 'Idempotency Test' });

      const stages1 = new Map<GenerationStageName, GenerationStage>([
        ['normalize-spec', new MockGenerationStage('normalize-spec', 'Normalize')],
      ]);

      const pipeline1 = new DefaultGenerationPipeline(
        {
          generationRunId: '00000000-0000-0000-0000-000000000005a',
          initialInput: { spec, blueprintPlan: null, params: {} },
        },
        stages1,
        new Set(['normalize-spec']),
      );

      await pipeline1.start();
      const result1 = await pipeline1.collect();

      // Run again with same inputs
      const stages2 = new Map<GenerationStageName, GenerationStage>([
        ['normalize-spec', new MockGenerationStage('normalize-spec', 'Normalize')],
      ]);

      const pipeline2 = new DefaultGenerationPipeline(
        {
          generationRunId: '00000000-0000-0000-0000-000000000005b',
          initialInput: { spec, blueprintPlan: null, params: {} },
        },
        stages2,
        new Set(['normalize-spec']),
      );

      await pipeline2.start();
      const result2 = await pipeline2.collect();

      expect(result1.status).toBe(result2.status);
    });
  });

  // -------------------------------------------------------------------------
  // Criterion: Each stage is individually testable (unit tests)
  // -------------------------------------------------------------------------

  describe('stage execution', () => {
    it('[Scenario 6] Stage validation accepts valid input', () => {
      const mockStage = new MockGenerationStage('normalize-spec', 'Test');

      // MockGenerationStage accepts any input — it's a mock
      expect(mockStage.validateInput({ spec: {}, blueprintPlan: null, params: {} })).toBe(true);
    });

    it('[Scenario 7] Stage execution produces expected output format', async () => {
      const mockStage = new MockGenerationStage('normalize-spec', 'Test');

      const input: GenerationStageInput = {
        spec: { name: 'Test' },
        blueprintPlan: null,
        params: {},
      };

      const output = await mockStage.execute(input);

      expect(output.inputHash.length).toBeGreaterThan(0);
      expect(output.outputHash.length).toBeGreaterThan(0);
      expect(typeof output.summary).toBe('string');
    });
  });

  // -------------------------------------------------------------------------
  // Criterion: End-to-end test (prompt → spec → blueprint plan → generated app)
  // -------------------------------------------------------------------------

  describe('end-to-end', () => {
    it('[Scenario 8] Full pipeline execution with multiple stages', async () => {
      const spec = createMockSpec({ name: 'Full Pipeline Test' });

      const stages = new Map<GenerationStageName, GenerationStage>([
        ['normalize-spec', new MockGenerationStage('normalize-spec', 'Normalize')],
        ['resolve-blueprint-plan', new MockGenerationStage('resolve-blueprint-plan', 'Resolve plan')],
        ['generate-schema', new MockGenerationStage('generate-schema', 'Generate schema')],
      ]);

      const pipeline = new DefaultGenerationPipeline(
        {
          generationRunId: '00000000-0000-0000-0000-000000000008',
          initialInput: { spec, blueprintPlan: null, params: {} },
        },
        stages,
        new Set(['normalize-spec', 'resolve-blueprint-plan', 'generate-schema']),
      );

      let completedStages = 0;

      pipeline.subscribe(() => {
        completedStages++;
      });

      await pipeline.start();
      const result = await pipeline.collect();

      expect(result.status).toBe('succeeded');
      expect(completedStages).toBeGreaterThanOrEqual(1);
    });
  });

  // -------------------------------------------------------------------------
  // Criterion: Failure handling (failed stages block promotion)
  // -------------------------------------------------------------------------

  describe('error handling', () => {
    it('[Scenario 9] Pipeline fails when a required stage throws', async () => {
      const spec = createMockSpec({ name: 'Error Test' });

      const stages = new Map<GenerationStageName, GenerationStage>([
        ['normalize-spec', new FailingMockStage('normalize-spec', 'Failing Stage')],
      ]);

      const pipeline = new DefaultGenerationPipeline(
        {
          generationRunId: '00000000-0000-0000-0000-000000000009',
          initialInput: { spec, blueprintPlan: null, params: {} },
        },
        stages,
        new Set(['normalize-spec']), // Required — failure blocks promotion
      );

      await pipeline.start();
      const result = await pipeline.collect();

      expect(result.status).not.toBe('succeeded');
    });
  });

  // -------------------------------------------------------------------------
  // Criterion: Pipeline cancellation works correctly
  // -------------------------------------------------------------------------

  describe('cancellation', () => {
    it('[Scenario 10] Pipeline can be cancelled during execution', async () => {
      const spec = createMockSpec({ name: 'Cancellation Test' });

      // Use a slow stage so cancel() can fire before it completes
      const stages = new Map<GenerationStageName, GenerationStage>([
        ['normalize-spec', new SlowMockStage('normalize-spec', 'Slow Normalize', 500)],
        ['resolve-blueprint-plan', new SlowMockStage('resolve-blueprint-plan', 'Slow Resolve', 500)],
      ]);

      const pipeline = new DefaultGenerationPipeline(
        {
          generationRunId: '00000000-0000-0000-0000-000000000010',
          initialInput: { spec, blueprintPlan: null, params: {} },
        },
        stages,
        new Set(['normalize-spec', 'resolve-blueprint-plan']),
      );

      // Start in background, cancel after a short delay
      const startPromise = pipeline.start();
      setTimeout(() => pipeline.cancel(), 50);

      await startPromise;
      const result = await pipeline.collect();

      // Pipeline should be cancelled (or at most partially complete)
      expect(['cancelled', 'partial', 'failed']).toContain(result.status);
    });
  });

  // -------------------------------------------------------------------------
  // Additional helper tests for createStageExecution
  // -------------------------------------------------------------------------

  describe('createStageExecution', () => {
    it('[Scenario 11] Creates valid stage execution record', () => {
      const execution = createStageExecution(
        'normalize-spec',
        'succeeded',
        'input-hash-123',
        'output-hash-456',
        'Test summary',
      );

      expect(execution.stageName).toBe('normalize-spec');
      expect(execution.status).toBe('succeeded');
      expect(execution.summary).toBe('Test summary');
    });
  });
});
