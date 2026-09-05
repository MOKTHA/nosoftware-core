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
      userPrompt: `Schema:\n${schemaContent}\n\nSpec:\n${JSON.stringify(input.spec, null, 2)}`,
      systemPrompt: [
        'You are a Next.js 15 App Router API route generator producing PRODUCTION-READY code.',
        '',
        '###Output rules (CRITICAL)',
        'Output ONLY TypeScript. No markdown fences, no explanations.',

        '',
        '## Imports',
        'import { db } from "@/lib/db";',
        'import { myTable } from "@/lib/schema";  // use the actual exported table names from the schema',
        'import { NextRequest, NextResponse } from "next/server";',
        'import { eq } from "drizzle-orm";',
        'Do NOT import from libraries not in package.json.',
        
        '',
        '## Error handling (CRITICAL)',
        'EVERY catch block MUST return the ACTUAL error message:',
        '  catch (err) { return NextResponse.json({ error: (err as Error).message }, { status: 500 }); }',
        'NEVER return a generic message like "Failed to create user" — always use (err as Error).message.',
        '',
        '## POST handler pattern:',
        'export async function POST(req: NextRequest) {',
        '  try {',
        '    const body = await req.json();',
        '    // Only pass user-provided fields — id/createdAt/updatedAt have DB defaults',
        '    const [record] = await db.insert(myTable).values({',
        '      name: body.name,  // only the fields the user sends',
        '    }).returning();',
        '    return NextResponse.json(record, { status: 201 });',
        '  } catch (err) {',
        '    return NextResponse.json({ error: (err as Error).message }, { status: 500 });',
        '  }',
        '}',
        '',
        '## IMPORTANT insert rules:',
        '- Do NOT pass id, createdAt, or updatedAt in .values() — they have database defaults.',
        '- Only pass the user-supplied fields from req.json().',
        '- Always use .returning() to get the created record back.',
        '',
        '## GET handler (IMPORTANT for dropdown support):',
        'The GET handler MUST return a plain JSON array of records.',
        'The frontend uses GET /api/<entity> to populate <select> dropdowns for FK fields.',
        'Pattern:',
        'export async function GET() {',
        '  try {',
        '    const records = await db.select().from(myTable);',
        '    return NextResponse.json(records);',
        '  } catch (err) {',
        '    return NextResponse.json({ error: (err as Error).message }, { status: 500 });',
        '  }',
        '}',
        '',
        '## Dynamic route params (CRITICAL — Next.js 15 breaking change):',
        'In Next.js 15, route params are ASYNC. You MUST use this pattern for [id] routes:',
        '',
        'export async function GET(req: NextRequest, props: { params: Promise<{ id: string }> }) {',
        '  const { id } = await props.params;',
        '  // Now use `id` directly, NOT `params.id`',
        '}',
        '',
        'NEVER use `{ params }: { params: { id: string } }` — that is the old Next.js 14 pattern.',
        'ALWAYS destructure params with `await props.params` inside the function body.',
        'This applies to GET, PATCH, PUT, DELETE in [id] routes.',
        '',
        '## Other handlers:',
        'EVERY file MUST start with: export const dynamic = "force-dynamic";',
        'PATCH/PUT: parse body, use eq(table.id, id) for WHERE.',
        'DELETE: use eq(table.id, id), return { success: true }.',
        '',
        '## File format',
        'Create one file per entity: app/api/<entity>/route.ts',
        'For single-item routes with dynamic [id]: app/api/<entity>/[id]/route.ts',
        'Separate each file with "// FILE: <path>" on its own line.',
        'Do NOT use a src/ directory.',
        'Do NOT generate app/layout.tsx or any app/api/auth/* routes — they already exist.',
        '',
        
      ].join('\n'),
    });

    // Parse multi-file output, post-process, and write each file
    const files = this.parseMultiFileOutput(routeCode);
    for (const [filePath, content] of files) {
      const fixed = this.postProcessBackendCode(content);
      await session.writeFile(`/workspace/app/${filePath}`, fixed);
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

      // Guard: strip route groups like (dashboard), (auth), etc.
      path = path.replace(/\([^)]+\)\//g, '');

      // Guard: skip scaffold files and auth routes
      if (
        path === 'app/layout.tsx' ||
        path === 'app/globals.css' ||
        path === 'app/page.tsx' ||
        path.startsWith('app/api/auth/')
      ) {
        continue;
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
  /*  Post-process: fix common LLM code issues                         */
  /* ------------------------------------------------------------------ */

  /**
   * Automatically fix common LLM-generated backend code problems:
   * - Replace generic error messages with actual error text
   * - Ensure .returning() is used on INSERTs
   * - Remove id/createdAt/updatedAt from INSERT values
   */
  private postProcessBackendCode(code: string): string {
    let fixed = code;

    // Fix 1: Replace generic catch-block error messages with (err as Error).message
    // Catches patterns like: { error: "Failed to create ..." } or { error: `Failed to ...` }
    fixed = fixed.replace(
      /\{\s*error:\s*["'`](?:Failed to|Error|Could not|Unable to)[^"'`]*["'`]\s*\}/g,
      '{ error: (err as Error).message }',
    );

    // Fix 2: Also catch: { message: "..." } pattern
    fixed = fixed.replace(
      /\{\s*message:\s*["'`](?:Failed to|Error|Could not|Unable to)[^"'`]*["'`]\s*\}/g,
      '{ error: (err as Error).message }',
    );

    // Fix 3: Ensure catch blocks have the err parameter
    // Replace: } catch { with } catch (err) {
    fixed = fixed.replace(
      /\}\s*catch\s*\{/g,
      '} catch (err) {',
    );

    // Fix 4: Replace catch (error) with catch (err) for consistency
    // Then replace error.message with (err as Error).message
    fixed = fixed.replace(
      /catch\s*\(\s*error\s*\)/g,
      'catch (err)',
    );
    fixed = fixed.replace(
      /error\.message/g,
      '(err as Error).message',
    );

    // Fix 5: Convert Next.js 14 sync params to Next.js 15 async params
    // Pattern: { params }: { params: { id: string } } → props: { params: Promise<{ id: string }> }
    fixed = fixed.replace(
      /\{\s*params\s*\}\s*:\s*\{\s*params\s*:\s*\{([^}]+)\}\s*\}/g,
      'props: { params: Promise<{$1}> }',
    );
    // Then add `const { id } = await props.params;` after the opening brace if not already present
    if (fixed.includes('props: { params: Promise<') && !fixed.includes('await props.params')) {
      fixed = fixed.replace(
        /(props:\s*\{\s*params:\s*Promise<\{[^}]+\}>\s*\}\s*)\)\s*\{/g,
        '$1) {\n  const { id } = await props.params;',
      );
      // Remove direct params.id references (now just use `id`)
      fixed = fixed.replace(/params\.id/g, 'id');
    }

    return fixed;
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
    // Industrial domains
    if (keywords.includes('pcb') || keywords.includes('electronics')) return 'pcb';
    if (keywords.includes('extrusion') || keywords.includes('aluminum')) return 'extrusion';
    if (keywords.includes('quality') || keywords.includes('inspection')) return 'quality';
    // Generic domains
    if (keywords.includes('task') || keywords.includes('project')) return 'tasks';
    if (keywords.includes('user') || keywords.includes('customer')) return 'users';
    if (keywords.includes('order') || keywords.includes('booking')) return 'orders';
    if (keywords.includes('product') || keywords.includes('inventory')) return 'products';
    // Fallback: extract from appName or spec
    const appName = (spec['appName'] as string) ?? '';
    if (appName) {
      const slug = appName.toLowerCase().replace(/[^a-z]+/g, '-').replace(/^-|-$/g, '');
      return slug || 'items';
    }
    return 'items';
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
