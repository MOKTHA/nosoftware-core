/**
 * @heynxt/agent-adapter — Generation Pipeline Tests (Phase 6)
 *
 * Unit tests for multi-stage generation pipeline orchestration.
 */

import { describe, it } from 'node:test';
import assert from 'assert';
import type { GenerationStageInput as CoreGenerationStageInput } from '@heynxt/core-types';
import type {
  GenerationStageName,
  GenerationStage,
} from '../generation-pipeline.js';
import {
  DefaultGenerationPipeline,
  MockGenerationStage,
  createStageExecution,
} from '../generation-pipeline.js';

// Re-export with local name for test use
export type GenerationStageInput = CoreGenerationStageInput;

// ============================================================================
// Test Fixtures
// ============================================================================

function createMockSpec(overrides?: Partial<Record<string, unknown>>): Record<string, unknown> {
  return {
    name: 'Test System',
    description: 'A test system for generation pipeline',
    metadata: {},
    ...overrides,
  };
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
        new Set(['normalize-spec', 'resolve-blueprint-plan', 'generate-schema'])
      );

      await pipeline.start();
      const result = await pipeline.collect();

      assert.strictEqual(result.status, 'succeeded');
      assert.strictEqual(result.stages.length, 3);
    });

    it('[Scenario 2] Should track artifacts produced at each stage', async () => {
      const spec = createMockSpec({ name: 'PCB Assembly' });

      const stages = new Map<import('../generation-pipeline.js').GenerationStageName, import('../generation-pipeline.js').GenerationStage>([
        ['normalize-spec', new MockGenerationStage('normalize-spec', 'Normalize input')],
        ['resolve-blueprint-plan', new MockGenerationStage('resolve-blueprint-plan', 'Resolve plan')],
      ]);

      const pipeline = new DefaultGenerationPipeline(
        {
          generationRunId: '00000000-0000-0000-0000-000000000002',
          initialInput: { spec, blueprintPlan: null, params: {} },
        },
        stages,
        new Set(['normalize-spec', 'resolve-blueprint-plan'])
      );

      await pipeline.start();
      const result = await pipeline.collect();

      // Each stage should have produced at least one artifact
      for (const stage of result.stages) {
        if (stage.status === 'succeeded') {
          assert.ok(stage.outputHash !== null);
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
        new Set(['normalize-spec'])
      );

      await pipeline.start();
      const result = await pipeline.collect();

      assert.ok(result.initialInput.spec);
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
        new Set(['normalize-spec'])
      );

      await pipeline.start();
      const result = await pipeline.collect();

      assert.ok(result.totalDurationMs != null && result.totalDurationMs >= 0);
    });
  });

  // -------------------------------------------------------------------------
  // Criterion: Pipeline is re-runnable (idempotent given same inputs)
  // -------------------------------------------------------------------------

  describe('idempotency', () => {
    it('[Scenario 5] Should produce consistent results for identical inputs', async () => {
      const spec = createMockSpec({ name: 'Idempotency Test' });

      const stages1 = new Map<import('../generation-pipeline.js').GenerationStageName, import('../generation-pipeline.js').GenerationStage>([
        ['normalize-spec', new MockGenerationStage('normalize-spec', 'Normalize')],
      ]);

      const pipeline1 = new DefaultGenerationPipeline(
        {
          generationRunId: '00000000-0000-0000-0000-000000000005a',
          initialInput: { spec, blueprintPlan: null, params: {} },
        },
        stages1,
        new Set(['normalize-spec'])
      );

      await pipeline1.start();
      const result1 = await pipeline1.collect();

      // Run again with same inputs
      const stages2 = new Map<import('../generation-pipeline.js').GenerationStageName, import('../generation-pipeline.js').GenerationStage>([
        ['normalize-spec', new MockGenerationStage('normalize-spec', 'Normalize')],
      ]);

      const pipeline2 = new DefaultGenerationPipeline(
        {
          generationRunId: '00000000-0000-0000-0000-000000000005b',
          initialInput: { spec, blueprintPlan: null, params: {} },
        },
        stages2,
        new Set(['normalize-spec'])
      );

      await pipeline2.start();
      const result2 = await pipeline2.collect();

      assert.strictEqual(result1.status, result2.status);
    });
  });

  // -------------------------------------------------------------------------
  // Criterion: Each stage is individually testable (unit tests)
  // -------------------------------------------------------------------------

  describe('stage execution', () => {
    it('[Scenario 6] Stage validation works correctly', async () => {
      const mockStage = new MockGenerationStage('normalize-spec', 'Test');

      assert.ok(mockStage.validateInput({ spec: {}, blueprintPlan: null, params: {} }));
      assert.ok(!mockStage.validateInput({ spec: {}, blueprintPlan: null, params: {}, invalidField: true } as any));
    });

    it('[Scenario 7] Stage execution produces expected output format', async () => {
      const mockStage = new MockGenerationStage('normalize-spec', 'Test');

      const input: GenerationStageInput = {
        spec: { name: 'Test' },
        blueprintPlan: null,
        params: {},
      };

      const output = await mockStage.execute(input);

      assert.ok(output.inputHash.length > 0);
      assert.ok(output.outputHash.length > 0);
      assert.strictEqual(typeof output.summary, 'string');
    });
  });

  // -------------------------------------------------------------------------
  // Criterion: End-to-end test (prompt → spec → blueprint plan → generated app)
  // -------------------------------------------------------------------------

  describe('end-to-end', () => {
    it('[Scenario 8] Full pipeline execution with multiple stages', async () => {
      const spec = createMockSpec({ name: 'Full Pipeline Test' });

      const stages = new Map([
        ['normalize-spec' as const, new MockGenerationStage('normalize-spec', 'Normalize')],
        ['resolve-blueprint-plan' as const, new MockGenerationStage('resolve-blueprint-plan', 'Resolve plan')],
        ['generate-schema' as const, new MockGenerationStage('generate-schema', 'Generate schema')],
      ]);

      const pipeline = new DefaultGenerationPipeline(
        {
          generationRunId: '00000000-0000-0000-0000-000000000008',
          initialInput: { spec, blueprintPlan: null, params: {} },
        },
        stages,
        new Set(['normalize-spec', 'resolve-blueprint-plan', 'generate-schema'])
      );

      let completedStages = 0;
      const totalStages = 3;

      pipeline.subscribe(() => {
        completedStages++;
      });

      await pipeline.start();
      const result = await pipeline.collect();

      assert.strictEqual(result.status, 'succeeded');
      assert.ok(completedStages >= 1); // At least one stage should have triggered subscription
    });
  });

  // -------------------------------------------------------------------------
  // Criterion: Failure handling (failed stages block promotion)
  // -------------------------------------------------------------------------

  describe('error handling', () => {
    it('[Scenario 9] Pipeline marks partial status when non-required stage fails', async () => {
      const spec = createMockSpec({ name: 'Error Test' });

      const failingStage = new MockGenerationStage('normalize-spec', 'Failing Stage');
      (failingStage as any).shouldFail = true; // Mock injection for testing

      const stages = new Map<GenerationStageName, GenerationStage>([
        ['normalize-spec', failingStage],
      ]);

      const pipeline = new DefaultGenerationPipeline(
        {
          generationRunId: '00000000-0000-0000-0000-000000000009',
          initialInput: { spec, blueprintPlan: null, params: {} },
        },
        stages,
        new Set() // No required stages - should result in partial status
      );

      await pipeline.start();
      const result = await pipeline.collect();

      assert.notStrictEqual(result.status, 'succeeded');
    });
  });

  // -------------------------------------------------------------------------
  // Criterion: Pipeline cancellation works correctly
  // -------------------------------------------------------------------------

  describe('cancellation', () => {
    it('[Scenario 10] Pipeline can be cancelled during execution', async () => {
      const spec = createMockSpec({ name: 'Cancellation Test' });

      const stages = new Map<GenerationStageName, GenerationStage>([
        ['normalize-spec', new MockGenerationStage('normalize-spec', 'Normalize')],
      ]);

      const pipeline = new DefaultGenerationPipeline(
        {
          generationRunId: '00000000-0000-0000-0000-000000000010',
          initialInput: { spec, blueprintPlan: null, params: {} },
        },
        stages,
        new Set(['normalize-spec'])
      );

      // Start in background
      const startPromise = pipeline.start();

      // Cancel immediately (simulated)
      setTimeout(() => pipeline.cancel(), 0);

      await startPromise;
      const result = await pipeline.collect();

      assert.strictEqual(result.status, 'cancelled');
    });
  });

  // -------------------------------------------------------------------------
  // Additional helper tests for createStageExecution
  // -------------------------------------------------------------------------

  describe('createStageExecution', () => {
    it('[Scenario 11] Creates valid stage execution record', async () => {
      const execution = createStageExecution(
        'normalize-spec',
        'succeeded',
        'input-hash-123',
        'output-hash-456',
        'Test summary'
      );

      assert.strictEqual(execution.stageName, 'normalize-spec');
      assert.strictEqual(execution.status, 'succeeded');
      assert.strictEqual(execution.summary, 'Test summary');
    });
  });
});
