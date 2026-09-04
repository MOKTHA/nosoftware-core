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
        'Generate pages using Tailwind CSS for styling.',
        '',
        '## Two kinds of pages',
        '1. SERVER components (list, detail, dashboard) — directly import db and query.',
        '2. CLIENT components (create/edit forms) — MUST start with "use client" and use fetch() to call API routes.',
        '',
        '## Server component imports',
        'import { db } from "@/lib/db";',
        'import { myTable } from "@/lib/schema";  // use actual table names',
        'import Link from "next/link";',
        'import { eq } from "drizzle-orm";',
        '',
        '## Client component imports (for forms)',
        '"use client";',
        'import { useState, useEffect } from "react";',
        'import { useRouter } from "next/navigation";',
        '',
        '## Critical rules',
        'EVERY server component file MUST start with: export const dynamic = "force-dynamic";',
        'EVERY client component file MUST start with: "use client";',
        'EVERY database query MUST be wrapped in try/catch — on error, render a friendly message.',
        'EVERY page must handle empty state (no data yet) gracefully.',
        '',
        '## SIDEBAR NAVIGATION (IMPORTANT)',
        'You MUST also generate components/Sidebar.tsx that replaces the scaffold placeholder.',
        'The Sidebar should list ALL entity types as nav links in the sidebar.',
        'Import { SidebarLink } from "@/components/Sidebar" is available — but you should',
        'generate a FULL Sidebar component with proper nav links for each entity.',
        'Pattern:',
        '  "use client";',
        '  import Link from "next/link";',
        '  import { usePathname } from "next/navigation";',
        '  import { useAuth } from "@/components/AuthProvider";',
        '  // Include Dashboard link + one link per entity',
        '  // Include logout button at the bottom using useAuth().logout',
        '',
        '## Foreign Key / Relation Fields in Forms (CRITICAL)',
        'When a form has a foreign key field (e.g. userId, projectId, categoryId):',
        '- NEVER render a plain text input asking for a UUID.',
        '- ALWAYS render a <select> dropdown that fetches the related records.',
        '- If no records exist, show a "Create" link next to the dropdown.',
        'Pattern for relation fields in create forms:',
        '',
        '  const [relatedItems, setRelatedItems] = useState<Array<{id: string; name: string}>>([]);',
        '  useEffect(() => {',
        '    fetch("/api/related-entity").then(r => r.json()).then(data => {',
        '      setRelatedItems(Array.isArray(data) ? data : []);',
        '    }).catch(() => {});',
        '  }, []);',
        '',
        '  // In the form JSX:',
        '  <div>',
        '    <label>Related Entity</label>',
        '    <div className="flex items-center gap-2">',
        '      <select name="relatedEntityId" required className="flex-1 ...">',
        '        <option value="">Select...</option>',
        '        {relatedItems.map(item => (',
        '          <option key={item.id} value={item.id}>{item.name || item.email || item.title || item.id.slice(0,8)}</option>',
        '        ))}',
        '      </select>',
        '      {relatedItems.length === 0 && (',
        '        <Link href="/related-entity/new" className="text-sm text-blue-600 hover:underline whitespace-nowrap">+ Create</Link>',
        '      )}',
        '    </div>',
        '  </div>',
        '',
        '## Create/edit form pattern (CLIENT component):',
        '"use client";',
        'import { useState, useEffect } from "react";',
        'import { useRouter } from "next/navigation";',
        'import Link from "next/link";',
        '',
        'export default function CreateEntityPage() {',
        '  const router = useRouter();',
        '  const [error, setError] = useState("");',
        '  const [loading, setLoading] = useState(false);',
        '  // Fetch related entities for any FK dropdowns (see pattern above)',
        '',
        '  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {',
        '    e.preventDefault();',
        '    setLoading(true);',
        '    setError("");',
        '    const formData = new FormData(e.currentTarget);',
        '    const data = Object.fromEntries(formData.entries());',
        '    try {',
        '      const res = await fetch("/api/entity", {',
        '        method: "POST",',
        '        headers: { "Content-Type": "application/json" },',
        '        body: JSON.stringify(data),',
        '      });',
        '      if (!res.ok) {',
        '        const body = await res.json();',
        '        throw new Error(body.error || "Request failed");',
        '      }',
        '      router.push("/entity");',
        '      router.refresh();',
        '    } catch (err) {',
        '      setError((err as Error).message);',
        '    } finally {',
        '      setLoading(false);',
        '    }',
        '  }',
        '',
        '  return (',
        '    <form onSubmit={handleSubmit}>',
        '      {error && <p className="text-red-600">{error}</p>}',
        '      <input name="fieldName" required />',
        '      {/* Use <select> for FK fields — see pattern above */}',
        '      <button type="submit" disabled={loading}>{loading ? "Creating..." : "Create"}</button>',
        '    </form>',
        '  );',
        '}',
        '',
        'IMPORTANT: NEVER use <form method="POST" action="..."> — that sends URL-encoded data, not JSON.',
        'ALWAYS use onSubmit + fetch() with JSON body as shown above.',
        '',
        '## Pages to generate',
        'components/Sidebar.tsx — SIDEBAR (client): nav links for Dashboard + each entity. Include logout button using useAuth().',
        'app/page.tsx — DASHBOARD (server component): app name, nav cards linking to entity lists, entity counts.',
        'app/<entity>/page.tsx — LIST (server): table with all records, link to /new and /[id].',
        'app/<entity>/[id]/page.tsx — DETAIL (server): show all fields, edit/delete buttons.',
        'app/<entity>/new/page.tsx — CREATE (client): form with fetch() POST. Use dropdowns for FK fields.',
        '',
        '## File format',
        'Separate each file with "// FILE: <path>" on its own line.',
        'Do NOT use route groups like (dashboard) or (auth).',
        'Do NOT use a src/ directory.',
        'Do NOT generate app/layout.tsx, app/globals.css, app/login/page.tsx, or components/AuthProvider.tsx.',
        'Do NOT generate app/api/auth/* routes — those exist in the scaffold.',
        'Do NOT include adminUsers in your queries or pages — it is for auth only.',
        '',
        'Output ONLY TypeScript/TSX. No markdown fences, no explanations.',
      ].join('\n'),
      userPrompt: `Schema:\n${schemaContent}\n\nSpec:\n${JSON.stringify(input.spec, null, 2)}`,
    });

    const files = this.parseMultiFileOutput(pageCode);
    for (const [filePath, content] of files) {
      const fixed = this.postProcessFrontendCode(content, filePath);
      await session.writeFile(`/workspace/app/${filePath}`, fixed);
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

      // Guard: skip scaffold files that must not be overwritten.
      // app/page.tsx and components/Sidebar.tsx ARE allowed — the LLM
      // generates proper versions to replace the scaffold placeholders.
      const scaffoldOnly = [
        'app/layout.tsx',
        'app/globals.css',
        'app/login/page.tsx',
        'components/AuthProvider.tsx',
        'app/api/auth/login/route.ts',
        'app/api/auth/me/route.ts',
        'app/api/auth/logout/route.ts',
        'app/api/auth/seed/route.ts',
      ];
      if (scaffoldOnly.includes(path)) {
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
  /*  Post-process: fix common LLM frontend code issues                */
  /* ------------------------------------------------------------------ */

  /**
   * Automatically fix common LLM-generated frontend code problems:
   * - Convert <form method="POST" action="..."> to client component with fetch()
   * - Fix generic error messages
   * - Ensure create/new pages are client components
   */
  private postProcessFrontendCode(code: string, filePath: string): string {
    let fixed = code;

    // Fix 1: If this is a create/new page using <form method="POST" action="...">,
    // inject "use client" and convert to onSubmit + fetch
    const isCreatePage = filePath.includes('/new/') || filePath.includes('/create');
    const hasFormAction = /method\s*=\s*["']POST["']/i.test(fixed) && /action\s*=\s*["']/i.test(fixed);

    if (isCreatePage && hasFormAction) {
      // Extract the action URL
      const actionMatch = fixed.match(/action\s*=\s*["']([^"']+)["']/);
      const apiUrl = actionMatch?.[1] ?? '/api/unknown';

      // Remove method and action attributes from the form
      fixed = fixed.replace(/\s*method\s*=\s*["']POST["']/gi, '');
      fixed = fixed.replace(/\s*action\s*=\s*["'][^"']*["']/gi, '');

      // Ensure "use client" is at the top
      if (!fixed.includes('"use client"') && !fixed.includes("'use client'")) {
        fixed = `"use client";\n${fixed}`;
      }

      // Add useState/useRouter imports if not present
      if (!fixed.includes('useState')) {
        fixed = fixed.replace(
          /^("use client";\s*)/m,
          `$1\nimport { useState } from "react";\nimport { useRouter } from "next/navigation";\n`,
        );
      }
    }

    // Fix 2: Ensure create/new pages have "use client" even without form action
    if (isCreatePage && !fixed.includes('"use client"') && !fixed.includes("'use client'")) {
      // If it has a <form> tag at all, it should be a client component
      if (/<form/i.test(fixed)) {
        fixed = `"use client";\n${fixed}`;
      }
    }

    // Fix 3: Remove export const dynamic from client components
    // (client components can't export dynamic)
    if (fixed.includes('"use client"') || fixed.includes("'use client'")) {
      fixed = fixed.replace(/export\s+const\s+dynamic\s*=\s*["']force-dynamic["'];\s*/g, '');
    }

    // Fix 4: Replace generic error strings with actual error in catch blocks
    fixed = fixed.replace(
      /\{\s*error:\s*["'`](?:Failed to|Error|Could not|Unable to)[^"'`]*["'`]\s*\}/g,
      '{ error: (err as Error).message }',
    );

    return fixed;
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
    // Industrial domains
    if (keywords.includes('pcb') || keywords.includes('electronics')) return 'pcb';
    if (keywords.includes('extrusion') || keywords.includes('aluminum')) return 'extrusion';
    if (keywords.includes('quality') || keywords.includes('inspection')) return 'quality';
    // Generic domains
    if (keywords.includes('task') || keywords.includes('project')) return 'tasks';
    if (keywords.includes('user') || keywords.includes('customer')) return 'users';
    if (keywords.includes('order') || keywords.includes('booking')) return 'orders';
    if (keywords.includes('product') || keywords.includes('inventory')) return 'products';
    // Fallback: extract first noun-like word from appName or spec
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
