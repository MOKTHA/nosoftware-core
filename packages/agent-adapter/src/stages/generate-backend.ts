/**
 * @heynxt/agent-adapter — Stage 5: Generate Backend (Phase 5)
 *
 * Stub mode: generates artifact metadata for routes, services, repositories.
 *
 * Live mode (sandbox + LLM available): calls the LLM to produce Next.js
 * App Router CRUD API routes for every entity and writes them into the sandbox.
 *
 * Context reads:  sessionId
 * Context writes: apiRoutesGenerated
 */

import type { GenerationStage, GenerationStageInput, GenerationStageOutput } from '../generation-pipeline.js';
import type { PipelineContext } from '../pipeline-context.js';

export class GenerateBackendStage implements GenerationStage {
  readonly name = 'generate-backend' as const;
  readonly description = 'Generate backend modules → routes, services, repositories, models';

  constructor(private readonly ctx?: PipelineContext) {}

  validateInput(input: GenerationStageInput): boolean {
    return input.spec !== undefined && Object.keys(input.spec).length > 0;
  }

  async execute(input: GenerationStageInput): Promise<GenerationStageOutput> {
    const inputHash = await this.computeHash(
      JSON.stringify({
        spec: input.spec,
        blueprintPlan: input.blueprintPlan ?? null,
        params: input.params,
      }),
    );

    // Live mode: call LLM → write API routes into sandbox
    if (
      this.ctx?.sessionId &&
      process.env['OPENROUTER_API_KEY']
    ) {
      await this.generateBackendInSandbox(input);
    }

    const artifacts = this.generateBackendArtifacts(
      input.spec,
      input.blueprintPlan ?? null,
      input.params,
    );

    return {
      inputHash,
      outputHash: inputHash,
      artifacts,
      summary: `Generated ${artifacts.length} backend modules including routes, services, and repositories`,
      warnings: [],
    };
  }

  /* ------------------------------------------------------------------ */
  /*  Live mode: LLM + Sandbox                                         */
  /* ------------------------------------------------------------------ */

  private async generateBackendInSandbox(input: GenerationStageInput): Promise<void> {
    const { SandboxSession } = await import('@heynxt/sandbox');
    const { callOpenRouter } = await import('../llm.js');

    const session = await SandboxSession.resume(this.ctx!.sessionId!);

    // Read the schema so the LLM knows the tables
    let schemaContent = '';
    try {
      schemaContent = await session.readFile('/workspace/app/lib/schema.ts');
    } catch {
      // Schema may not exist in stub mode — that's fine
    }

    const routeCode = await callOpenRouter({
      model: 'anthropic/claude-sonnet-4',
      systemPrompt: [
        'You are a Next.js 15 App Router API route generator.',
        'Given a Drizzle schema, generate CRUD route handlers.',
        'Output ONLY TypeScript. Create one file per entity with GET (list+single), POST, PATCH, DELETE.',
        'Import db from "@/lib/db" and tables from "@/lib/schema".',
        'Use NextRequest/NextResponse from "next/server".',
        'IMPORTANT: Every route file MUST export `export const dynamic = "force-dynamic";` at the top so Next.js does not cache or pre-render it.',
        'Separate each file with "// FILE: <path>" on its own line.',
        'Paths are relative to the project root, e.g. app/api/tickets/route.ts.',
        'Do NOT use a src/ directory — there is no src/ folder in this project.',
        'Do NOT generate app/layout.tsx — it already exists.',
        'No markdown fences, no explanations, no ```typescript blocks.',
      ].join(' '),
      userPrompt: `Schema:\n${schemaContent}\n\nSpec:\n${JSON.stringify(input.spec, null, 2)}`,
    });

    // Parse multi-file output and write each file
    const files = this.parseMultiFileOutput(routeCode);
    for (const [filePath, content] of files) {
      await session.writeFile(`/workspace/app/${filePath}`, content);
    }

    if (this.ctx) {
      this.ctx.apiRoutesGenerated = true;
    }
  }

  /**
   * Parse LLM output that uses "// FILE: <path>" separators.
   * Strips markdown fences and normalises paths (removes leading src/).
   */
  private parseMultiFileOutput(raw: string): Map<string, string> {
    // Strip markdown fences the LLM may wrap output in
    const output = raw.replace(/^```[a-z]*\n?/gm, '').replace(/```$/gm, '');

    const files = new Map<string, string>();
    const parts = output.split(/^\/\/\s*FILE:\s*/m);

    for (const part of parts) {
      if (!part.trim()) continue;
      const newlineIdx = part.indexOf('\n');
      if (newlineIdx === -1) continue;
      let path = part.slice(0, newlineIdx).trim();
      const content = part.slice(newlineIdx + 1).trim();

      // Guard: strip leading src/ if the LLM used it despite instructions
      if (path.startsWith('src/')) {
        path = path.slice(4);
      }

      if (path && content) {
        // Ensure every API route is force-dynamic so Next.js doesn't
        // try to pre-render routes that query the database at build time.
        const dynamicExport = 'export const dynamic = "force-dynamic";';
        const finalContent = content.includes('force-dynamic')
          ? content
          : `${dynamicExport}\n\n${content}`;
        files.set(path, finalContent);
      }
    }
    return files;
  }

  /* ------------------------------------------------------------------ */
  /*  Stub artifact generation (always runs)                            */
  /* ------------------------------------------------------------------ */

  private generateBackendArtifacts(
    spec: Record<string, unknown>,
    blueprintPlan: Record<string, unknown> | null,
    params: Record<string, unknown>,
  ): Array<import('@heynxt/core-types').GenerationArtifact> {
    const artifacts: Array<import('@heynxt/core-types').GenerationArtifact> = [];

    const routeDefinitions = this.generateRoutes(spec);
    for (const route of routeDefinitions) {
      artifacts.push({
        id: crypto.randomUUID(),
        generationRunId: '00000000-0000-0000-0000-000000000000',
        stageName: this.name,
        kind: 'source-file' as const,
        relativePath: `routes/${route.path.replace(/\//g, '_')}.ts`,
        contentHash: crypto.randomUUID().slice(-64),
        fileSizeBytes: 2048,
        isNew: true,
        description: `API route handler for ${route.method} ${route.path}`,
        createdAt: new Date(),
      });
    }

    const services = this.generateServices(spec);
    for (const service of services) {
      artifacts.push({
        id: crypto.randomUUID(),
        generationRunId: '00000000-0000-0000-0000-000000000000',
        stageName: this.name,
        kind: 'source-file' as const,
        relativePath: `services/${service.name}.ts`,
        contentHash: crypto.randomUUID().slice(-64),
        fileSizeBytes: 3072,
        isNew: true,
        description: `Service layer for ${service.description}`,
        createdAt: new Date(),
      });
    }

    const repositories = this.generateRepositories(spec);
    for (const repo of repositories) {
      artifacts.push({
        id: crypto.randomUUID(),
        generationRunId: '00000000-0000-0000-0000-000000000000',
        stageName: this.name,
        kind: 'source-file' as const,
        relativePath: `repositories/${repo.entity.toLowerCase()}.ts`,
        contentHash: crypto.randomUUID().slice(-64),
        fileSizeBytes: 1536,
        isNew: true,
        description: `Repository for ${repo.entity} entity`,
        createdAt: new Date(),
      });
    }

    return artifacts;
  }

  private generateRoutes(spec: Record<string, unknown>): Array<{ path: string; method: string }> {
    const domain = this.detectDomain(spec);
    const basePath = `/${domain}`;
    return [
      { path: basePath, method: 'GET' },
      { path: basePath, method: 'POST' },
      { path: `${basePath}/:id`, method: 'GET' },
      { path: `${basePath}/:id`, method: 'PUT' },
      { path: `${basePath}/:id`, method: 'DELETE' },
    ];
  }

  private generateServices(spec: Record<string, unknown>): Array<{ name: string; description: string }> {
    const domain = this.detectDomain(spec);
    return [
      { name: `${this.capitalize(domain)}Service`, description: `Main service for ${domain} operations` },
      { name: 'AuthService', description: 'Authentication and authorization' },
    ];
  }

  private generateRepositories(spec: Record<string, unknown>): Array<{ entity: string }> {
    const domain = this.detectDomain(spec);
    return [
      { entity: `${this.capitalize(domain)}Repository` },
      { entity: 'BaseRepository' },
    ];
  }

  private detectDomain(spec: Record<string, unknown>): string {
    const keywords = Object.values(spec).join(' ').toLowerCase();
    if (keywords.includes('pcb') || keywords.includes('electronics')) return 'pcb';
    if (keywords.includes('extrusion') || keywords.includes('aluminum')) return 'extrusion';
    if (keywords.includes('quality') || keywords.includes('inspection')) return 'quality';
    return 'extrusion';
  }

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
