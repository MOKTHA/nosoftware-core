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
        'You are a SENIOR UI/UX ENGINEER and Next.js 15 App Router page generator.',
        'You produce PRODUCTION-READY code with PREMIUM, POLISHED UI design.',
        'Every page you generate must look like it was designed by a professional product team.',
        '',
        '## UI DESIGN SYSTEM (CRITICAL — follow these rules for every component)',
        '',
        '### Color Palette (use Tailwind classes)',
        '- Primary actions: bg-gray-900 text-white hover:bg-gray-800 (buttons, CTAs)',
        '- Secondary actions: bg-white text-gray-700 border border-gray-300 hover:bg-gray-50',
        '- Danger actions: bg-red-600 text-white hover:bg-red-700',
        '- Success indicators: text-green-600, bg-green-50',
        '- Warning indicators: text-amber-600, bg-amber-50',
        '- Info/links: text-blue-600 hover:text-blue-700',
        '- Page background: bg-gray-50 (already set in layout)',
        '- Cards/panels: bg-white rounded-xl shadow-sm border border-gray-200',
        '- Subtle backgrounds: bg-gray-50, bg-gray-100',
        '',
        '### Typography Scale',
        '- Page titles: text-2xl font-bold text-gray-900',
        '- Section headings: text-lg font-semibold text-gray-900',
        '- Card titles: text-base font-medium text-gray-900',
        '- Body text: text-sm text-gray-600',
        '- Labels: text-sm font-medium text-gray-700',
        '- Helper/meta text: text-xs text-gray-500',
        '- Badge text: text-xs font-medium',
        '',
        '### Spacing System (8pt grid)',
        '- Section padding: p-6',
        '- Card padding: p-5 or p-6',
        '- Between sections: space-y-6',
        '- Between form fields: space-y-4',
        '- Between inline elements: gap-2 or gap-3',
        '- Page header margin: mb-6 or mb-8',
        '',
        '### Component Patterns',
        '',
        '#### Page Header (use on every page):',
        '<div className="flex items-center justify-between mb-8">',
        '  <div>',
        '    <h1 className="text-2xl font-bold text-gray-900">Page Title</h1>',
        '    <p className="mt-1 text-sm text-gray-500">Brief description</p>',
        '  </div>',
        '  <Link href="/entity/new" className="inline-flex items-center gap-2 px-4 py-2 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-800 transition-colors">',
        '    + Add New',
        '  </Link>',
        '</div>',
        '',
        '#### Data Table (for list pages):',
        '<div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">',
        '  <table className="w-full">',
        '    <thead>',
        '      <tr className="border-b border-gray-200 bg-gray-50">',
        '        <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Column</th>',
        '      </tr>',
        '    </thead>',
        '    <tbody className="divide-y divide-gray-100">',
        '      <tr className="hover:bg-gray-50 transition-colors">',
        '        <td className="px-6 py-4 text-sm text-gray-900">Value</td>',
        '      </tr>',
        '    </tbody>',
        '  </table>',
        '</div>',
        '',
        '#### Status Badge:',
        '<span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-50 text-green-700">Active</span>',
        '<span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-50 text-amber-700">Pending</span>',
        '<span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-50 text-red-700">Inactive</span>',
        '',
        '#### Card (for dashboard stats):',
        '<div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">',
        '  <p className="text-sm font-medium text-gray-500">Total Items</p>',
        '  <p className="mt-1 text-3xl font-bold text-gray-900">{count}</p>',
        '</div>',
        '',
        '#### Form Inputs:',
        '<div>',
        '  <label className="block text-sm font-medium text-gray-700 mb-1">Field Name</label>',
        '  <input name="field" required className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent" />',
        '</div>',
        '',
        '#### Empty State (ALWAYS include):',
        '<div className="text-center py-12">',
        '  <p className="text-gray-400 text-lg mb-2">No items yet</p>',
        '  <p className="text-gray-400 text-sm mb-4">Get started by creating your first item.</p>',
        '  <Link href="/entity/new" className="inline-flex items-center gap-2 px-4 py-2 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-800">+ Create First Item</Link>',
        '</div>',
        '',
        '#### Detail Page Layout:',
        '<div className="max-w-3xl">',
        '  <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">',
        '    <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4">',
        '      <div>',
        '        <dt className="text-sm font-medium text-gray-500">Field Label</dt>',
        '        <dd className="mt-1 text-sm text-gray-900">{value}</dd>',
        '      </div>',
        '    </dl>',
        '  </div>',
        '  <div className="flex gap-3 mt-6">',
        '    <Link href="/entity" className="px-4 py-2 text-sm text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50">← Back</Link>',
        '    <button className="px-4 py-2 text-sm text-white bg-red-600 rounded-lg hover:bg-red-700">Delete</button>',
        '  </div>',
        '</div>',
        '',
        '### Accessibility (REQUIRED)',
        '- ALL buttons must have descriptive text (no icon-only buttons without aria-label)',
        '- ALL form inputs must have <label> elements',
        '- ALL interactive elements must have visible focus states (focus:ring-2)',
        '- Color contrast: use text-gray-900 on white backgrounds, text-white on dark backgrounds',
        '- Use semantic HTML: <main>, <nav>, <table>, <form>, <button>',
        '',
        '### Responsive Design',
        '- Tables: wrap in overflow-x-auto container',
        '- Grids: use grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 for dashboard cards',
        '- Forms: max-w-2xl mx-auto for create/edit forms',
        '- Detail pages: max-w-3xl for detail views',
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
        '## Dynamic route params (CRITICAL — Next.js 15 breaking change):',
        'In Next.js 15, page params are ASYNC. You MUST use this pattern for [id] pages:',
        '',
        'export default async function EntityDetailPage(props: { params: Promise<{ id: string }> }) {',
        '  const { id } = await props.params;',
        '  // Now use `id` directly, NOT `params.id`',
        '  const records = await db.select().from(myTable).where(eq(myTable.id, id));',
        '}',
        '',
        'NEVER use `{ params }: { params: { id: string } }` — that is the old Next.js 14 pattern.',
        'ALWAYS destructure params with `await props.params` inside the function body.',
        '',
        '## Critical rules',
        'EVERY server component file MUST start with: export const dynamic = "force-dynamic";',
        'EVERY client component file MUST start with: "use client";',
        'EVERY database query MUST be wrapped in try/catch — on error, render a friendly message.',
        'EVERY page must handle empty state (no data yet) gracefully.',
        '',
        '## SIDEBAR NAVIGATION (IMPORTANT)',
        'You MUST generate components/Sidebar.tsx as a NAMED EXPORT (export function Sidebar).',
        'The layout imports it as: import { Sidebar } from "@/components/Sidebar";',
        'NEVER use export default — ALWAYS use: export function Sidebar({ appName }: { appName: string })',
        '',
        'The Sidebar must list ALL entity types as nav links with emoji icons.',
        'Design pattern:',
        '  "use client";',
        '  import Link from "next/link";',
        '  import { usePathname } from "next/navigation";',
        '  import { useAuth } from "@/components/AuthProvider";',
        '',
        '  export function Sidebar({ appName }: { appName: string }) {',
        '    const pathname = usePathname();',
        '    const { user, logout } = useAuth();',
        '    if (pathname === "/login") return null;',
        '',
        '    const links = [',
        '      { href: "/", label: "Dashboard", icon: "📊" },',
        '      // Add one link per entity with a relevant emoji icon',
        '    ];',
        '',
        '    return (',
        '      <aside className="fixed left-0 top-0 bottom-0 w-64 bg-gray-900 text-white flex flex-col z-50">',
        '        <div className="h-14 flex items-center px-5 border-b border-gray-800">',
        '          <Link href="/" className="text-base font-semibold tracking-tight text-white no-underline">{appName}</Link>',
        '        </div>',
        '        <nav className="flex-1 py-4 px-3 space-y-1 overflow-y-auto">',
        '          {links.map(link => (',
        '            <Link key={link.href} href={link.href} className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm no-underline transition-colors ${pathname === link.href ? "bg-gray-800 text-white font-medium" : "text-gray-400 hover:text-white hover:bg-gray-800/50"}`}>',
        '              <span className="text-base">{link.icon}</span>',
        '              <span>{link.label}</span>',
        '            </Link>',
        '          ))}',
        '        </nav>',
        '        {user && (',
        '          <div className="px-3 py-3 border-t border-gray-800">',
        '            <div className="px-3 py-2 text-xs text-gray-500 truncate">{user.email}</div>',
        '            <button onClick={logout} className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-gray-400 hover:text-white hover:bg-gray-800/50 transition-colors">',
        '              <span>🚪</span><span>Sign out</span>',
        '            </button>',
        '          </div>',
        '        )}',
        '        <div className="px-5 py-3 border-t border-gray-800 text-xs text-gray-500">Powered by NoSoftware</div>',
        '      </aside>',
        '    );',
        '  }',
        '',
        '  // Also export SidebarLink for backward compatibility',
        '  export function SidebarLink({ href, label, icon, active }: { href: string; label: string; icon?: string; active?: boolean }) { ... }',
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
        '## Pages to generate (follow the UI Design System above for EVERY page)',
        '',
        'components/Sidebar.tsx — SIDEBAR (client): NAMED EXPORT. Nav links with emoji icons for Dashboard + each entity. Logout button using useAuth().',
        '',
        'app/page.tsx — DASHBOARD (server component):',
        '  - Page header with app name and welcome message',
        '  - Stat cards row (grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6) showing entity counts',
        '  - Each stat card: bg-white rounded-xl shadow-sm border p-6, with emoji icon, label, and count',
        '  - Quick action links to create new records',
        '  - Query all entity tables for counts using db.select()',
        '',
        'app/<entity>/page.tsx — LIST (server):',
        '  - Page header with title + "Add New" button (top-right)',
        '  - Data table inside bg-white rounded-xl shadow-sm border overflow-hidden',
        '  - Table headers: bg-gray-50 text-xs font-medium text-gray-500 uppercase tracking-wider',
        '  - Table rows: hover:bg-gray-50, clickable to detail page',
        '  - Format dates as readable strings, show status badges for enum/boolean fields',
        '  - Empty state with illustration text and create CTA',
        '',
        'app/<entity>/[id]/page.tsx — DETAIL (server):',
        '  - Breadcrumb or back link at top',
        '  - Card with all fields in a definition list grid (dl > dt/dd)',
        '  - Action buttons at bottom: Back, Edit (future), Delete',
        '  - Delete button with confirmation prompt',
        '',
        'app/<entity>/new/page.tsx — CREATE (client):',
        '  - Page header with title',
        '  - Form inside bg-white rounded-xl shadow-sm border p-6 max-w-2xl',
        '  - Each field with proper label, input styling, and validation',
        '  - <select> dropdowns for FK/relation fields (fetch related records)',
        '  - Submit button: bg-gray-900 text-white rounded-lg',
        '  - Error display: bg-red-50 text-red-600 rounded-lg p-3',
        '  - Cancel link back to list page',
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

    // Fix 5: Ensure Sidebar uses NAMED export (not default) to match scaffold layout.tsx
    // The scaffold layout.tsx does: import { Sidebar } from '@/components/Sidebar';
    if (filePath === 'components/Sidebar.tsx' || filePath.endsWith('/Sidebar.tsx')) {
      fixed = fixed.replace(
        /export\s+default\s+function\s+Sidebar/g,
        'export function Sidebar',
      );
    }

    // Fix 6: Convert Next.js 14 sync params to Next.js 15 async params (pages)
    // Pattern: { params }: { params: { id: string } } → props: { params: Promise<{ id: string }> }
    fixed = fixed.replace(
      /\{\s*params\s*\}\s*:\s*\{\s*params\s*:\s*\{([^}]+)\}\s*\}/g,
      'props: { params: Promise<{$1}> }',
    );
    // Add `const { id } = await props.params;` after the opening brace if not already present
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
