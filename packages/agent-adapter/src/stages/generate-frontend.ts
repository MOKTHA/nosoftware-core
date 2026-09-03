/**
 * @heynxt/agent-adapter — Stage 6: Generate Frontend (Phase 5)
 *
 * Stub mode: generates artifact metadata for pages, components, forms.
 *
 * Live mode (sandbox + LLM available): calls the LLM to produce Next.js
 * App Router pages with React Server Components and writes them into the sandbox.
 *
 * Context reads:  sessionId
 * Context writes: frontendGenerated
 */

import type { GenerationStage, GenerationStageInput, GenerationStageOutput } from '../generation-pipeline.js';
import type { PipelineContext } from '../pipeline-context.js';

export class GenerateFrontendStage implements GenerationStage {
  readonly name = 'generate-frontend' as const;
  readonly description = 'Generate frontend modules → pages, components, forms, lists';

  constructor(private readonly ctx?: PipelineContext) {}

  validateInput(input: GenerationStageInput): boolean {
    return input.spec !== undefined && Object.keys(input.spec).length > 0;
  }

  async execute(input: GenerationStageInput): Promise<GenerationStageOutput> {
    const inputHash = await this.computeHash(
      JSON.stringify({ spec: input.spec, params: input.params }),
    );

    // Live mode: call LLM → write pages into sandbox
    if (
      this.ctx?.sessionId &&
      process.env['OPENROUTER_API_KEY']
    ) {
      await this.generateFrontendInSandbox(input);
    }

    const artifacts = this.generateFrontendArtifacts(input.spec, input.params);

    return {
      inputHash,
      outputHash: inputHash,
      artifacts,
      summary: `Generated ${artifacts.length} frontend components including pages and forms`,
      warnings: [],
    };
  }

  /* ------------------------------------------------------------------ */
  /*  Live mode: LLM + Sandbox                                         */
  /* ------------------------------------------------------------------ */

  private async generateFrontendInSandbox(input: GenerationStageInput): Promise<void> {
    const { SandboxSession } = await import('@heynxt/sandbox');
    const { callOpenRouter } = await import('../llm.js');

    const session = await SandboxSession.resume(this.ctx!.sessionId!);

    // Read the schema so pages match the data model
    let schemaContent = '';
    try {
      schemaContent = await session.readFile('/workspace/app/lib/schema.ts');
    } catch {
      // Tolerate missing schema in stub mode
    }

    const pageCode = await callOpenRouter({
      model: 'anthropic/claude-sonnet-4',
      systemPrompt: [
        'You are a Next.js 15 App Router page generator producing PRODUCTION-READY code.',
        'Generate pages using Tailwind CSS for styling. Use React Server Components.',
        '',
        '## Imports',
        'Import db from "@/lib/db" and tables from "@/lib/schema" for server-side queries.',
        'Only import modules from: "next/server", "next/link", "next/navigation", "react", "@/lib/db", "@/lib/schema", "drizzle-orm".',
        'Do NOT import from libraries not in package.json.',
        '',
        '## Critical rules',
        'EVERY file MUST start with: export const dynamic = "force-dynamic";',
        'EVERY database query MUST be wrapped in try/catch — on error, render a user-friendly message, never throw.',
        'EVERY page must handle empty state (no data yet) gracefully — show a message, never crash.',
        'Use `eq` from "drizzle-orm" for WHERE clauses.',
        '',
        '## Pages to generate',
        'Generate app/page.tsx as a DASHBOARD home page: a clean landing with the app name, navigation cards linking to each entity list, and a summary count for each entity (use try/catch around the count query).',
        'For each entity: generate a list page, a detail page (app/entity/[id]/page.tsx), and a create page (app/entity/new/page.tsx).',
        'List pages should use an HTML <table> with Tailwind styling. Detail pages should show all fields.',
        'Create pages should have a <form> with method="POST" action to the API route.',
        '',
        '## File format',
        'Separate each file with "// FILE: <path>" on its own line.',
        'Paths are relative to the project root, e.g. app/tickets/page.tsx, app/tickets/[id]/page.tsx.',
        'Do NOT use route groups like (dashboard) or (auth) — put pages directly under app/.',
        'Do NOT use a src/ directory.',
        'Do NOT generate app/layout.tsx or app/globals.css — they already exist.',
        '',
        'Output ONLY TypeScript/TSX. No markdown fences, no explanations.',
      ].join('\n'),
      userPrompt: `Schema:\n${schemaContent}\n\nSpec:\n${JSON.stringify(input.spec, null, 2)}`,
    });

    const files = this.parseMultiFileOutput(pageCode);
    for (const [filePath, content] of files) {
      await session.writeFile(`/workspace/app/${filePath}`, content);
    }

    if (this.ctx) {
      this.ctx.frontendGenerated = true;
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
      // These cause Next.js build failures when the group doesn't have its own layout.
      path = path.replace(/\([^)]+\)\//g, '');

      // Guard: skip layout/globals that already exist from the scaffold.
      // app/page.tsx is allowed — the LLM generates a proper dashboard to
      // replace the scaffold placeholder.
      if (path === 'app/layout.tsx' || path === 'app/globals.css') {
        continue;
      }

      if (path && content) {
        // Ensure every page is force-dynamic so Next.js doesn't try to
        // statically pre-render pages that query the database at build time.
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

  private generateFrontendArtifacts(
    spec: Record<string, unknown>,
    params: Record<string, unknown>,
  ): Array<import('@heynxt/core-types').GenerationArtifact> {
    const artifacts: Array<import('@heynxt/core-types').GenerationArtifact> = [];

    const pageDefinitions = this.generatePages(spec);
    for (const page of pageDefinitions) {
      artifacts.push({
        id: crypto.randomUUID(),
        generationRunId: '00000000-0000-0000-0000-000000000000',
        stageName: this.name,
        kind: 'source-file' as const,
        relativePath: `pages/${page.path.replace(/\//g, '_')}.tsx`,
        contentHash: crypto.randomUUID().slice(-64),
        fileSizeBytes: 4096,
        isNew: true,
        description: `Page component for ${page.title}`,
        createdAt: new Date(),
      });
    }

    const components = this.generateComponents(spec);
    for (const component of components) {
      artifacts.push({
        id: crypto.randomUUID(),
        generationRunId: '00000000-0000-0000-0000-000000000000',
        stageName: this.name,
        kind: 'source-file' as const,
        relativePath: `components/${component.name}.tsx`,
        contentHash: crypto.randomUUID().slice(-64),
        fileSizeBytes: 2048,
        isNew: true,
        description: `UI component for ${component.description}`,
        createdAt: new Date(),
      });
    }

    const formDefinitions = this.generateForms(spec);
    for (const form of formDefinitions) {
      artifacts.push({
        id: crypto.randomUUID(),
        generationRunId: '00000000-0000-0000-0000-000000000000',
        stageName: this.name,
        kind: 'source-file' as const,
        relativePath: `forms/${form.entity.toLowerCase()}-form.tsx`,
        contentHash: crypto.randomUUID().slice(-64),
        fileSizeBytes: 3072,
        isNew: true,
        description: `Form for ${form.entity}`,
        createdAt: new Date(),
      });
    }

    return artifacts;
  }

  private generatePages(spec: Record<string, unknown>): Array<{ path: string; title: string }> {
    const domain = this.detectDomain(spec);
    return [
      { path: `/${domain}`, title: `${this.capitalize(domain)} List` },
      { path: `/${domain}/new`, title: `Create ${this.capitalize(domain)}` },
      { path: `/${domain}/:id`, title: `${this.capitalize(domain)} Details` },
    ];
  }

  private generateComponents(spec: Record<string, unknown>): Array<{ name: string; description: string }> {
    const domain = this.detectDomain(spec);
    return [
      { name: `${this.capitalize(domain)}Table`, description: 'Data table for listing' },
      { name: `${this.capitalize(domain)}Card`, description: 'Card component for display' },
      { name: 'StatusBadge', description: 'Status indicator badge' },
    ];
  }

  private generateForms(spec: Record<string, unknown>): Array<{ entity: string }> {
    const domain = this.detectDomain(spec);
    return [
      { entity: this.capitalize(domain) },
      { entity: 'Filter' },
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
