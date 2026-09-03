/**
 * @heynxt/agent-adapter — Pipeline End-to-End Integration Tests
 *
 * Exercises the full path from fixture → validation → pipeline build
 * → pipeline execution using the helpdesk ticketing fixture.
 * No LLM calls — deterministic, fast, runs in CI.
 */

import { describe, it, expect } from 'vitest';
import { helpdeskTicketingFixture } from '@heynxt/prompt-spec';
import { validateSpecTemplate } from '../spec-validator.js';
import { buildPipelineFromSpec } from '../pipeline-factory.js';

// ============================================================================
// Test suites
// ============================================================================

describe('Pipeline E2E — helpdesk ticketing fixture', () => {
  // ─── 1. Validation gate ──────────────────────────────────────────

  it('helpdeskTicketingFixture passes validation with valid: true and zero errors', () => {
    const result = validateSpecTemplate(helpdeskTicketingFixture);

    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  // ─── 2. Pipeline construction ────────────────────────────────────

  it('buildPipelineFromSpec returns a pipeline with status "pending"', () => {
    const pipeline = buildPipelineFromSpec(
      helpdeskTicketingFixture,
      'd0000000-0000-0000-0000-000000000001',
    );

    expect(pipeline.status).toBe('pending');
  });

  // ─── 3. Pipeline execution ───────────────────────────────────────

  it('after start(), pipeline status is "succeeded" or "partial"', async () => {
    const pipeline = buildPipelineFromSpec(
      helpdeskTicketingFixture,
      'd0000000-0000-0000-0000-000000000002',
    );

    await pipeline.start();

    expect(['succeeded', 'partial']).toContain(pipeline.status);
  });

  // ─── 4. Stage results ───────────────────────────────────────────

  it('getStageResults() returns results for all registered stages', async () => {
    const pipeline = buildPipelineFromSpec(
      helpdeskTicketingFixture,
      'd0000000-0000-0000-0000-000000000003',
    );

    await pipeline.start();

    const results = pipeline.getStageResults();

    // The pipeline has 4 required stages registered
    expect(results.length).toBeGreaterThanOrEqual(4);

    // Each result should have an execution record with a stage name
    for (const result of results) {
      expect(result.execution.stageName).toBeTruthy();
      expect(['succeeded', 'failed', 'cancelled']).toContain(
        result.execution.status,
      );
    }
  });
});
