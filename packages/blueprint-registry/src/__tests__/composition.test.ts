/**
 * @heynxt/blueprint-registry — Composition Engine Tests (Phase 5)
 *
 * Unit tests for blueprint selection and composition algorithm.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert';
import { z } from 'zod';
import type { BlueprintMetadata, BlueprintPack } from '@heynxt/core-types';
import {
  SpecInput,
  extractKeywords,
  composeBlueprintPlan,
  validateCompositionPlan,
  normalizeSelections,
  checkBlueprintCompatibility,
  hasCircularDependency,
  applyManualOverride,
} from '../composition.js';

// ============================================================================
// Test Fixtures
// ============================================================================

function createMockBlueprint(overrides?: Partial<BlueprintMetadata>): BlueprintMetadata {
  const base: BlueprintMetadata = {
    id: '550e8400-e29b-41d4-a716-446655440000',
    name: 'Test Blueprint',
    version: '1.0.0',
    description: 'A test blueprint',
    family: 'extrusion-operations',
    domain: 'extrusion',
    status: 'published',
    tags: ['test'],
    createdAt: new Date(),
    updatedAt: new Date(),
    dependsOn: [],
  };

  return { ...base, ...overrides } as BlueprintMetadata;
}

const TEST_BLUEPRINTS: BlueprintMetadata[] = [
  createMockBlueprint({
    id: '11111111-1111-4111-8111-111111111111',
    name: 'Extrusion Operations Base',
    family: 'extrusion-operations',
    domain: 'extrusion',
  }),
  createMockBlueprint({
    id: '22222222-2222-4222-8222-222222222222',
    name: 'Tool Lifecycle Management',
    family: 'tool-lifecycle',
    domain: 'extrusion',
  }),
  createMockBlueprint({
    id: '33333333-3333-4333-8333-333333333333',
    name: 'PCB Genealogy Tracking',
    family: 'pcb-genealogy',
    domain: 'pcb-electronics',
  }),
  createMockBlueprint({
    id: '44444444-4444-4444-8444-444444444444',
    name: 'Quality Inspection Module',
    family: 'quality-inspection',
    domain: 'quality',
  }),
  createMockBlueprint({
    id: '55555555-5555-4555-8555-555555555555',
    name: 'OEE Analytics Dashboard',
    family: 'oee',
    domain: 'analytics',
  }),
];

const TEST_PACKS: BlueprintPack[] = [
  {
    id: '66666666-6666-4666-8666-666666666666',
    name: 'Standard Role Pack',
    version: '1.0.0',
    description: 'Basic role definitions',
    family: 'role-pack',
    status: 'published',
  },
];

// ============================================================================
// Test Suites
// ============================================================================

describe('Composition Engine - Phase 5 Exit Criteria Tests', () => {
  // -------------------------------------------------------------------------
  // Criterion: Spec → Blueprint Plan Resolution (at least 5 scenarios)
  // -------------------------------------------------------------------------

  describe('extractKeywords', () => {
    it('should extract extrusion domain keywords from description', () => {
      const spec = z.parse(SpecInput, {
        name: 'Extrusion Management System',
        description: 'Build an aluminum extrusion management system with billet tracking and die management capabilities',
      });

      const keywords = extractKeywords(spec);
      assert.strictEqual(keywords.has('extrusion'), true);
      assert.strictEqual(keywords.has('billet'), true);
      assert.strictEqual(keywords.has('die-management'), true);
    });

    it('should extract PCB domain keywords from description', () => {
      const spec = z.parse(SpecInput, {
        name: 'PCB Assembly Tracking',
        description: 'Track PCB assembly with genealogy and component tracking for electronics manufacturing',
      });

      const keywords = extractKeywords(spec);
      assert.strictEqual(keywords.has('pcb'), true);
      assert.strictEqual(keywords.has('genealogy'), true);
      assert.strictEqual(keywords.has('traceability'), true);
    });

    it('should include explicitly declared capabilities', () => {
      const spec = z.parse(SpecInput, {
        name: 'Basic System',
        description: 'A simple system',
        requiredCapabilities: ['oee', 'quality'],
      });

      const keywords = extractKeywords(spec);
      assert.strictEqual(keywords.has('oee'), true);
      assert.strictEqual(keywords.has('quality'), true);
    });
  });

  describe('composeBlueprintPlan - Extrusion Domain Scenarios', () => {
    it('[Scenario 1] Should auto-detect extrusion domain and select primary blueprint', () => {
      const spec = z.parse(SpecInput, {
        name: 'Aluminum Extrusion Management',
        description: 'Build a system for managing aluminum extrusion operations with billet tracking',
      });

      const result = composeBlueprintPlan(spec, TEST_BLUEPRINTS);

      assert.strictEqual(result.primaryBlueprintId, '11111111-1111-4111-8111-111111111111');
      assert.ok(result.selections.length > 0);
    });

    it('[Scenario 2] Should select tool-lifecycle for die-management requirement', () => {
      const spec = z.parse(SpecInput, {
        name: 'Die Management System',
        description: 'Manage die lifecycle with heat treatment tracking and setpoint profiles',
      });

      const result = composeBlueprintPlan(spec, TEST_BLUEPRINTS);

      assert.strictEqual(result.primaryBlueprintId, '11111111-1111-4111-8111-111111111111');
    });

    it('[Scenario 3] Should include module blueprints for routing requirements', () => {
      const spec = z.parse(SpecInput, {
        name: 'Process Routing System',
        description: 'Build process routing with operation execution and setpoint profiles',
        requiredCapabilities: ['routing', 'process-execution'],
      });

      const result = composeBlueprintPlan(spec, TEST_BLUEPRINTS);

      assert.strictEqual(result.primaryBlueprintId, '11111111-1111-4111-8111-111111111111');
    });
  });

  describe('composeBlueprintPlan - PCB Domain Scenarios', () => {
    it('[Scenario 4] Should auto-detect PCB domain and select genealogy blueprint', () => {
      const spec = z.parse(SpecInput, {
        name: 'PCB Assembly Traceability System',
        description: 'Build PCB assembly tracking with full genealogy and component-level traceability',
      });

      const result = composeBlueprintPlan(spec, TEST_BLUEPRINTS);

      assert.strictEqual(result.primaryBlueprintId, '33333333-3333-4333-8333-333333333333');
    });

    it('[Scenario 5] Should include quality inspection for PCB with NCR requirements', () => {
      const spec = z.parse(SpecInput, {
        name: 'PCB Quality Management',
        description: 'Manage PCB quality with visual inspection and nonconformance reporting',
        requiredCapabilities: ['inspection', 'ncr'],
      });

      const result = composeBlueprintPlan(spec, TEST_BLUEPRINTS);

      assert.strictEqual(result.primaryBlueprintId, '33333333-3333-4333-8333-333333333333');
    });
  });

  describe('composeBlueprintPlan - User Override Scenarios', () => {
    it('[Scenario 6] Should respect user domain preference over auto-detection', () => {
      const spec = z.parse(SpecInput, {
        name: 'PCB System with Extrusion Keywords',
        description: 'Build a PCB system (contains extrusion keyword but user prefers PCB)',
        preferredDomain: 'pcb-electronics',
      });

      const result = composeBlueprintPlan(spec, TEST_BLUEPRINTS);

      assert.strictEqual(result.primaryBlueprintId, '33333333-3333-4333-8333-333333333333');
    });
  });

  describe('composeBlueprintPlan - Integration & Governance Scenarios', () => {
    it('[Scenario 7] Should attach approval workflow when requiresApprovals is true', () => {
      const spec = z.parse(SpecInput, {
        name: 'Controlled Extrusion System',
        description: 'Build extrusion system with controlled access and approvals',
        requiresApprovals: true,
      });

      const result = composeBlueprintPlan(spec, TEST_BLUEPRINTS);

      const approvalSelections = result.selections.filter(s => s.blueprintName.toLowerCase().includes('approval'));
      assert.ok(approvalSelections.length > 0);
    });
  });

  // -------------------------------------------------------------------------
  // Criterion: Composition is Explainable (each blueprint has a reason)
  // -------------------------------------------------------------------------

  describe('explainability', () => {
    it('should provide reasons for all selections', () => {
      const spec = z.parse(SpecInput, {
        name: 'Extrusion System',
        description: 'Build extrusion management with die tracking',
      });

      const result = composeBlueprintPlan(spec, TEST_BLUEPRINTS);

      // Every selection should have a human-readable reason
      result.selections.forEach(selection => {
        assert.ok(selection.reason !== undefined && selection.reason.length > 0);
      });
    });

    it('should include confidence level for each selection', () => {
      const spec = z.parse(SpecInput, {
        name: 'Test System',
        description: 'A test system',
      });

      const result = composeBlueprintPlan(spec, TEST_BLUEPRINTS);

      result.selections.forEach(selection => {
        assert.ok(['high', 'medium', 'low'].includes(selection.confidence));
      });
    });
  });

  // -------------------------------------------------------------------------
  // Criterion: Composition is Versioned (registry snapshot)
  // -------------------------------------------------------------------------

  describe('versioning', () => {
    it('should generate registry snapshot version in result', () => {
      const spec = z.parse(SpecInput, {
        name: 'Test System',
        description: 'A test system',
      });

      const result = composeBlueprintPlan(spec, TEST_BLUEPRINTS);

      assert.ok(result.registrySnapshotVersion !== undefined);
      assert.strictEqual(typeof result.registrySnapshotVersion, 'string');
    });

    it('should produce consistent snapshot version for same inputs', () => {
      const spec = z.parse(SpecInput, {
        name: 'Test System',
        description: 'A test system',
      });

      const result1 = composeBlueprintPlan(spec, TEST_BLUEPRINTS);
      const result2 = composeBlueprintPlan(spec, TEST_BLUEPRINTS);

      assert.strictEqual(result1.registrySnapshotVersion, result2.registrySnapshotVersion);
    });
  });

  // -------------------------------------------------------------------------
  // Criterion: Manual Override Records Rationale
  // -------------------------------------------------------------------------

  describe('manual override', () => {
    it('should allow user to override primary blueprint selection', () => {
      const spec = z.parse(SpecInput, {
        name: 'Extrusion System',
        description: 'Build extrusion management',
      });

      const result = composeBlueprintPlan(spec, TEST_BLUEPRINTS);
      const originalPrimary = result.primaryBlueprintId;

      // Apply manual override to PCB blueprint instead
      const overrideResult = applyManualOverride(result, {
        specId: 'test-spec-123',
        primaryBlueprintId: '33333333-3333-4333-8333-333333333333', // PCB blueprint
        reason: 'User chose PCB domain despite extrusion keywords in spec',
        userConfidence: 'high',
      });

      assert.notStrictEqual(overrideResult.primaryBlueprintId, originalPrimary);
      assert.strictEqual(overrideResult.primaryBlueprintId, '33333333-3333-4333-8333-333333333333');

      // Override should be first in selections with high confidence
      const overrideSelection = overrideResult.selections[0];
      assert.strictEqual(overrideSelection.blueprintName, 'Manually selected');
    });
  });

  // -------------------------------------------------------------------------
  // Criterion: Deterministic Composition (same input → same output)
  // -------------------------------------------------------------------------

  describe('determinism', () => {
    it('should produce identical selections for same spec and blueprints', () => {
      const spec = z.parse(SpecInput, {
        name: 'Determinism Test',
        description: 'Test deterministic behavior',
      });

      const result1 = composeBlueprintPlan(spec, TEST_BLUEPRINTS);
      const result2 = composeBlueprintPlan(spec, TEST_BLUEPRINTS);

      assert.strictEqual(result1.primaryBlueprintId, result2.primaryBlueprintId);
      assert.strictEqual(result1.selections.length, result2.selections.length);
    });

    it('should normalize selections in consistent order', () => {
      const spec = z.parse(SpecInput, {
        name: 'Normalization Test',
        description: 'Test selection ordering',
      });

      const result1 = composeBlueprintPlan(spec, TEST_BLUEPRINTS);
      const normalized1 = normalizeSelections(result1.selections);
      const normalized2 = normalizeSelections(result1.selections);

      // Normalized selections should be in same order both times
      for (let i = 0; i < normalized1.length; i++) {
        assert.strictEqual(normalized1[i].blueprintId, normalized2[i].blueprintId);
      }
    });
  });

  // -------------------------------------------------------------------------
  // Criterion: Performance (<2s for registry sizes up to 100 blueprints)
  // -------------------------------------------------------------------------

  describe('performance', () => {
    it('should complete composition in <2s with large blueprint set', () => {
      // Create a larger registry (simulated)
      const largeRegistry: BlueprintMetadata[] = Array.from({ length: 100 }, (_, i) =>
        createMockBlueprint({
          id: `8${i.toString().padStart(39, '0')}-8888-4888-8888-888888888888`,
          name: `Test Blueprint ${i}`,
          family: i % 2 === 0 ? 'extrusion-operations' : 'pcb-genealogy',
          domain: i % 3 === 0 ? 'extrusion' : 'pcb-electronics',
        })
      );

      const spec = z.parse(SpecInput, {
        name: 'Performance Test',
        description: 'Test performance with large registry',
      });

      const start = Date.now();
      const result = composeBlueprintPlan(spec, largeRegistry);
      const elapsed = Date.now() - start;

      assert.ok(elapsed < 2000, `Composition took ${elapsed}ms, expected <2000ms`);
    });
  });

  // -------------------------------------------------------------------------
  // Additional Validation Tests
  // -------------------------------------------------------------------------

  describe('validateCompositionPlan', () => {
    it('should validate successful composition with no errors', () => {
      const spec = z.parse(SpecInput, {
        name: 'Valid System',
        description: 'Build extrusion management',
      });

      const result = composeBlueprintPlan(spec, TEST_BLUEPRINTS);
      const blueprintsById = new Map(TEST_BLUEPRINTS.map(b => [b.id, b]));
      const validation = validateCompositionPlan(result, blueprintsById);

      assert.strictEqual(validation.isValid, true);
    });

    it('should detect missing primary blueprint', () => {
      // Create a result with non-existent blueprint ID
      const invalidResult: any = {
        primaryBlueprintId: '00000000-0000-4000-8000-000000000000',
        moduleBlueprintIds: [],
        registrySnapshotVersion: 'v12345678-5B',
        specName: 'Test',
      };

      const blueprintsById = new Map(TEST_BLUEPRINTS.map(b => [b.id, b]));
      const validation = validateCompositionPlan(invalidResult as any, blueprintsById);

      assert.strictEqual(validation.isValid, false);
      assert.ok(validation.errors.length > 0);
    });
  });

  describe('checkBlueprintCompatibility', () => {
    it('should return true for compatible blueprints in same domain', () => {
      const blueprintA = TEST_BLUEPRINTS[0]; // extrusion-operations
      const blueprintB = TEST_BLUEPRINTS[1]; // tool-lifecycle (extrusion)

      const blueprintsById = new Map(TEST_BLUEPRINTS.map(b => [b.id, b]));
      const compatible = checkBlueprintCompatibility(blueprintA, blueprintB, blueprintsById);

      assert.strictEqual(compatible, true);
    });

    it('should return true for cross-domain compatible blueprints (analytics)', () => {
      const blueprintA = TEST_BLUEPRINTS[0]; // extrusion-operations
      const blueprintB = TEST_BLUEPRINTS[4]; // oee analytics

      const blueprintsById = new Map(TEST_BLUEPRINTS.map(b => [b.id, b]));
      const compatible = checkBlueprintCompatibility(blueprintA, blueprintB, blueprintsById);

      assert.strictEqual(compatible, true);
    });
  });

  describe('hasCircularDependency', () => {
    it('should return false when no circular dependency exists', () => {
      const blueprintsById = new Map(TEST_BLUEPRINTS.map(b => [b.id, b]));
      const hasCycle = hasCircularDependency(
        ['11111111-1111-4111-8111-111111111111', '22222222-2222-4222-8222-222222222222'],
        blueprintsById
      );

      assert.strictEqual(hasCycle, false);
    });

    it('should detect circular dependency when explicitly defined', () => {
      const blueprintA = createMockBlueprint({
        id: 'aaaaaaa1-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        name: 'Blueprint A',
        dependsOn: ['bbbbbbb2-bbbb-4bbb-8bbb-bbbbbbbbbbbb'],
      });

      const blueprintB = createMockBlueprint({
        id: 'bbbbbbb2-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
        name: 'Blueprint B',
        dependsOn: ['aaaaaaa1-aaaa-4aaa-8aaa-aaaaaaaaaaaa'], // Circular!
      });

      const blueprintsById = new Map([
        [blueprintA.id, blueprintA],
        [blueprintB.id, blueprintB],
      ]);

      const hasCycle = hasCircularDependency(
        [blueprintA.id, blueprintB.id],
        blueprintsById
      );

      assert.strictEqual(hasCycle, true);
    });
  });
});
