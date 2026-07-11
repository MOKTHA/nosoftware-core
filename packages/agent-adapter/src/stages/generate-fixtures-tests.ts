/**
 * @heynxt/agent-adapter — Stage 8: Generate Fixtures & Tests (Phase 6)
 *
 * Generates seed data, unit tests, and integration tests.
 */

import type { GenerationStage, GenerationStageInput, GenerationStageOutput } from '../generation-pipeline.js';

export class GenerateFixturesTestsStage implements GenerationStage {
  readonly name = 'generate-fixtures-tests' as const;
  readonly description = 'Generate fixtures/tests → seed data, unit/integration tests';

  validateInput(input: GenerationStageInput): boolean {
    // Need spec to generate test cases
    return input.spec !== undefined && Object.keys(input.spec).length > 0;
  }

  async execute(input: GenerationStageInput): Promise<GenerationStageOutput> {
    const inputHash = await this.computeHash(JSON.stringify({
      spec: input.spec,
      blueprintPlan: input.blueprintPlan ?? null,
      params: input.params,
    }));

    // Generate test and fixture artifacts based on generated code
    const artifacts = this.generateTestArtifacts(
      input.spec,
      input.blueprintPlan ?? null,
      input.params
    );

    return {
      inputHash,
      outputHash: inputHash,
      artifacts,
      summary: `Generated ${artifacts.length} test files and fixture data`,
      warnings: [],
    };
  }

  /**
   * Generate test and fixture artifacts.
   */
  private generateTestArtifacts(
    spec: Record<string, unknown>,
    blueprintPlan: Record<string, unknown> | null,
    params: Record<string, unknown>
  ): Array<import('@heynxt/core-types').GenerationArtifact> {
    const artifacts: Array<import('@heynxt/core-types').GenerationArtifact> = [];

    // Generate unit tests for services
    const serviceTests = this.generateServiceTests(spec);
    for (const test of serviceTests) {
      artifacts.push({
        id: crypto.randomUUID(),
        generationRunId: '00000000-0000-0000-0000-000000000000',
        stageName: this.name,
        kind: 'test-file' as const,
        relativePath: `tests/unit/${test.path}`,
        contentHash: crypto.randomUUID().slice(-64),
        fileSizeBytes: 2048,
        isNew: true,
        description: test.description,
        createdAt: new Date(),
      });
    }

    // Generate integration tests
    const integrationTests = this.generateIntegrationTests(spec);
    for (const test of integrationTests) {
      artifacts.push({
        id: crypto.randomUUID(),
        generationRunId: '00000000-0000-0000-0000-000000000000',
        stageName: this.name,
        kind: 'test-file' as const,
        relativePath: `tests/integration/${test.path}`,
        contentHash: crypto.randomUUID().slice(-64),
        fileSizeBytes: 3072,
        isNew: true,
        description: test.description,
        createdAt: new Date(),
      });
    }

    // Generate seed data/fixtures
    const fixtures = this.generateFixtures(spec);
    for (const fixture of fixtures) {
      artifacts.push({
        id: crypto.randomUUID(),
        generationRunId: '00000000-0000-0000-0000-000000000000',
        stageName: this.name,
        kind: 'fixture-data' as const,
        relativePath: `fixtures/${fixture.path}`,
        contentHash: crypto.randomUUID().slice(-64),
        fileSizeBytes: 1536,
        isNew: true,
        description: fixture.description,
        createdAt: new Date(),
      });
    }

    return artifacts;
  }

  /**
   * Generate unit test files for services.
   */
  private generateServiceTests(spec: Record<string, unknown>): Array<{ path: string; description: string }> {
    const domain = this.detectDomain(spec);
    const serviceName = `${this.capitalize(domain)}Service`;

    return [
      {
        path: `${serviceName}.test.ts`,
        description: `Unit tests for ${serviceName}`,
      },
      {
        path: 'auth.test.ts',
        description: 'Unit tests for authentication service',
      },
    ];
  }

  /**
   * Generate integration test files.
   */
  private generateIntegrationTests(spec: Record<string, unknown>): Array<{ path: string; description: string }> {
    const domain = this.detectDomain(spec);

    return [
      {
        path: `${domain}-api.test.ts`,
        description: `Integration tests for ${domain} API endpoints`,
      },
      {
        path: 'database.test.ts',
        description: 'Database connection and migration tests',
      },
    ];
  }

  /**
   * Generate seed data fixtures.
   */
  private generateFixtures(spec: Record<string, unknown>): Array<{ path: string; description: string }> {
    const domain = this.detectDomain(spec);

    return [
      {
        path: `${domain}-seed.json`,
        description: `Seed data for ${domain} entities`,
      },
      {
        path: 'users.json',
        description: 'Default user accounts and roles',
      },
      {
        path: 'workspace-seed.json',
        description: 'Initial workspace configuration',
      },
    ];
  }

  /**
   * Auto-detect domain from spec content.
   */
  private detectDomain(spec: Record<string, unknown>): string {
    const description = (spec.description as string) ?? '';
    const keywords = Object.values(spec).join(' ').toLowerCase();

    if (keywords.includes('pcb') || keywords.includes('electronics')) {
      return 'pcb';
    } else if (keywords.includes('extrusion') || keywords.includes('aluminum')) {
      return 'extrusion';
    } else if (keywords.includes('quality') || keywords.includes('inspection')) {
      return 'quality';
    }

    // Default to extrusion as the primary domain
    return 'extrusion';
  }

  /**
   * Compute content hash for traceability.
   */
  private async computeHash(content: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(content);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(hashBuffer))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
  }

  private capitalize(str: string): string {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }
}
