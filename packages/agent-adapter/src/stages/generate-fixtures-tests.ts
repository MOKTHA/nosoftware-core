/**
 * @heynxt/agent-adapter — Stage 8: Generate Fixtures & Tests (Phase 6)
 *
 * Stub mode: generates artifact metadata for tests and fixtures.
 *
 * Live mode (sandbox + LLM available): calls the LLM with QA skills
 * preloaded to produce actual test files (unit, integration, E2E) and
 * seed data, then writes them into the sandbox.
 *
 * Context reads:  sessionId
 * Context writes: testsGenerated
 */

import type { GenerationStage, GenerationStageInput, GenerationStageOutput } from '../generation-pipeline.js';
import type { PipelineContext } from '../pipeline-context.js';

export class GenerateFixturesTestsStage implements GenerationStage {
  readonly name = 'generate-fixtures-tests' as const;
  readonly description = 'Generate fixtures/tests → seed data, unit/integration tests';

  constructor(private readonly ctx?: PipelineContext) {}

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

    // Live mode: call LLM with QA skills → write test files into sandbox
    if (
      this.ctx?.sessionId &&
      process.env['OPENROUTER_API_KEY']
    ) {
      await this.generateTestsInSandbox(input);
    }

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

  /* ------------------------------------------------------------------ */
  /*  Live mode: LLM + Sandbox (QA skills loaded)                       */
  /* ------------------------------------------------------------------ */

  private async generateTestsInSandbox(input: GenerationStageInput): Promise<void> {
    const { SandboxSession } = await import('@heynxt/sandbox');
    const { callModelWithSkills } = await import('../llm.js');

    const session = await SandboxSession.resume(this.ctx!.sessionId!);

    // Read schema and existing API routes for test context
    let schemaContent = '';
    let apiRoutes = '';
    try {
      schemaContent = await session.readFile('/workspace/app/lib/schema.ts');
    } catch { /* skip */ }

    // Discover generated API route files
    try {
      const ls = await session.runCommand('find', [
        '/workspace/app/app/api',
        '-name', 'route.ts',
        '-type', 'f',
      ], { cwd: '/workspace/app' });
      const routeFiles = (ls.stdout || '').trim().split('\n').filter(Boolean);

      for (const routeFile of routeFiles.slice(0, 10)) { // Cap at 10 files
        try {
          const content = await session.readFile(routeFile);
          apiRoutes += `// FILE: ${routeFile.replace('/workspace/app/', '')}\n${content}\n\n`;
        } catch { /* skip */ }
      }
    } catch { /* skip */ }

    // Generate test files with QA skills
    const testCode = await callModelWithSkills({
      model: 'anthropic/claude-sonnet-4',
      // Preload QA skills via the Agent SDK nextTurnParams pattern
      skills: ['senior-qa', 'tdd-guide', 'api-test-suite-builder'],
      includeReferences: false,
      input: [
        `Schema:\n${schemaContent}`,
        '',
        `API Routes:\n${apiRoutes}`,
        '',
        `Spec:\n${JSON.stringify(input.spec, null, 2)}`,
      ].join('\n'),
      systemPrompt: [
        'You are a QA engineer generating comprehensive tests for a Next.js 15 app.',
        'Generate unit tests, API integration tests, and seed data.',
        '',
        '## Test Stack',
        'Use Vitest (already in devDependencies). Import from "vitest":',
        'import { describe, it, expect, beforeAll, afterAll } from "vitest";',
        '',
        '## Test Types to Generate',
        '',
        '### 1. API Route Tests (integration)',
        'Test every CRUD endpoint: GET (list), GET (by id), POST (create), PATCH (update), DELETE.',
        'Pattern:',
        '  describe("GET /api/<entity>", () => {',
        '    it("should return an array of records", async () => {',
        '      const res = await fetch(`${BASE_URL}/api/<entity>`);',
        '      expect(res.status).toBe(200);',
        '      const data = await res.json();',
        '      expect(Array.isArray(data)).toBe(true);',
        '    });',
        '  });',
        '',
        '### 2. Schema Validation Tests (unit)',
        'Verify that required fields are enforced, UUIDs are auto-generated,',
        'timestamps default correctly, and FK constraints exist.',
        '',
        '### 3. Seed Data (fixtures)',
        'Generate realistic seed data as TypeScript files that can be',
        'imported and inserted via Drizzle ORM:',
        '  import { db } from "@/lib/db";',
        '  import { myTable } from "@/lib/schema";',
        '  export async function seed() { await db.insert(myTable).values([...]); }',
        '',
        '## File Format',
        'Separate each file with "// FILE: <path>" on its own line.',
        'Test files go in: __tests__/<name>.test.ts',
        'Seed files go in: __tests__/fixtures/<name>.seed.ts',
        '',
        '## Rules',
        '- Make tests deterministic — no random data in assertions.',
        '- Use realistic field values (not "test123" or "foo").',
        '- Each test must clean up after itself or be idempotent.',
        '- Export const dynamic = "force-dynamic" is NOT needed in test files.',
        '- Output ONLY TypeScript. No markdown fences, no explanations.',
      ].join('\n'),
      maxSteps: 3,
    });

    // Parse and write test files
    const files = this.parseMultiFileOutput(testCode);
    for (const [filePath, content] of files) {
      await session.writeFile(`/workspace/app/${filePath}`, content);
    }

    if (this.ctx) {
      (this.ctx as Record<string, unknown>)['testsGenerated'] = true;
    }
  }

  /**
   * Parse LLM output that uses "// FILE: <path>" separators.
   */
  private parseMultiFileOutput(raw: string): Map<string, string> {
    const output = raw.replace(/^```[a-z]*\n?/gm, '').replace(/```$/gm, '');
    const files = new Map<string, string>();
    const parts = output.split(/^\/\/\s*FILE:\s*/m);

    for (const part of parts) {
      if (!part.trim()) continue;
      const newlineIdx = part.indexOf('\n');
      if (newlineIdx === -1) continue;
      let path = part.slice(0, newlineIdx).trim();
      const content = part.slice(newlineIdx + 1).trim();
      if (path.startsWith('src/')) path = path.slice(4);
      if (path && content) {
        files.set(path, content);
      }
    }
    return files;
  }

  /* ------------------------------------------------------------------ */
  /*  Stub artifact generation (always runs)                            */
  /* ------------------------------------------------------------------ */

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
    const keywords = Object.values(spec).join(' ').toLowerCase();

    if (keywords.includes('pcb') || keywords.includes('electronics')) {
      return 'pcb';
    } else if (keywords.includes('extrusion') || keywords.includes('aluminum')) {
      return 'extrusion';
    } else if (keywords.includes('quality') || keywords.includes('inspection')) {
      return 'quality';
    } else if (keywords.includes('task') || keywords.includes('project')) {
      return 'tasks';
    } else if (keywords.includes('user') || keywords.includes('customer')) {
      return 'users';
    } else if (keywords.includes('order') || keywords.includes('booking')) {
      return 'orders';
    } else if (keywords.includes('product') || keywords.includes('inventory')) {
      return 'products';
    }

    const appName = (spec['appName'] as string) ?? '';
    if (appName) return appName.toLowerCase().replace(/[^a-z]+/g, '-').replace(/^-|-$/g, '') || 'app';
    return 'app';
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
