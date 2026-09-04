/**
 * @heynxt/agent-adapter — UI/UX Design System Prompt
 *
 * Consolidated design system knowledge extracted from Claude skills:
 *   - ui-design-system: design tokens, color palettes, typography scales
 *   - senior-frontend: React/Next.js component patterns, accessibility
 *   - saas-scaffolder: SaaS layout patterns, dashboard structure
 *   - brand-guidelines: brand consistency, visual identity
 *   - epic-design: premium UI patterns, micro-interactions
 *
 * This module exports prompt fragments that are injected into LLM calls
 * via OpenRouter during code generation stages.
 */

/* ------------------------------------------------------------------ */
/*  Design Tokens                                                     */
/* ------------------------------------------------------------------ */

export const DESIGN_TOKENS = {
  colors: {
    primary: { base: 'gray-900', hover: 'gray-800', text: 'white' },
    secondary: { base: 'white', hover: 'gray-50', text: 'gray-700', border: 'gray-300' },
    accent: { base: 'blue-600', hover: 'blue-700', text: 'white' },
    danger: { base: 'red-600', hover: 'red-700', text: 'white' },
    success: { bg: 'green-50', text: 'green-700', icon: 'green-600' },
    warning: { bg: 'amber-50', text: 'amber-700', icon: 'amber-600' },
    info: { bg: 'blue-50', text: 'blue-700', icon: 'blue-600' },
    surface: { page: 'gray-50', card: 'white', subtle: 'gray-100' },
    text: { primary: 'gray-900', secondary: 'gray-600', muted: 'gray-500', faint: 'gray-400' },
    border: { default: 'gray-200', subtle: 'gray-100', strong: 'gray-300' },
  },
  typography: {
    pageTitle: 'text-2xl font-bold text-gray-900',
    sectionHeading: 'text-lg font-semibold text-gray-900',
    cardTitle: 'text-base font-medium text-gray-900',
    body: 'text-sm text-gray-600',
    label: 'text-sm font-medium text-gray-700',
    helper: 'text-xs text-gray-500',
    badge: 'text-xs font-medium',
    stat: 'text-3xl font-bold text-gray-900',
  },
  spacing: {
    section: 'p-6',
    card: 'p-5',
    betweenSections: 'space-y-6',
    betweenFields: 'space-y-4',
    inlineGap: 'gap-2',
    headerMargin: 'mb-8',
  },
  radius: {
    sm: 'rounded-md',
    md: 'rounded-lg',
    lg: 'rounded-xl',
    full: 'rounded-full',
  },
  shadows: {
    card: 'shadow-sm',
    dropdown: 'shadow-lg',
  },
} as const;

/* ------------------------------------------------------------------ */
/*  Component Patterns (Tailwind class strings)                       */
/* ------------------------------------------------------------------ */

export const COMPONENT_PATTERNS = {
  /** Primary action button */
  buttonPrimary:
    'inline-flex items-center gap-2 px-4 py-2 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-800 transition-colors focus:outline-none focus:ring-2 focus:ring-gray-900 focus:ring-offset-2',
  /** Secondary/outline button */
  buttonSecondary:
    'inline-flex items-center gap-2 px-4 py-2 bg-white text-gray-700 text-sm font-medium rounded-lg border border-gray-300 hover:bg-gray-50 transition-colors',
  /** Danger button */
  buttonDanger:
    'inline-flex items-center gap-2 px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 transition-colors',
  /** Card container */
  card: 'bg-white rounded-xl shadow-sm border border-gray-200',
  /** Form input */
  input:
    'w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent',
  /** Select dropdown */
  select:
    'w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent',
  /** Table header cell */
  tableHeader:
    'text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider',
  /** Table data cell */
  tableCell: 'px-6 py-4 text-sm text-gray-900',
  /** Status badges */
  badgeSuccess: 'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-50 text-green-700',
  badgeWarning: 'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-50 text-amber-700',
  badgeDanger: 'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-50 text-red-700',
  badgeInfo: 'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700',
  badgeNeutral: 'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-700',
  /** Error message */
  errorMessage: 'bg-red-50 text-red-600 text-sm px-4 py-3 rounded-lg',
} as const;

/* ------------------------------------------------------------------ */
/*  LLM System Prompt: Design System                                  */
/* ------------------------------------------------------------------ */

/**
 * Full UI/UX design system prompt injected into LLM calls.
 * Covers: color palette, typography, spacing, component patterns,
 * accessibility, responsive design, and page layout conventions.
 */
export const DESIGN_SYSTEM_PROMPT = `
## UI/UX DESIGN SYSTEM (CRITICAL — follow for every component)

You are a SENIOR UI/UX ENGINEER. Every page must look professionally designed.

### Color Palette (Tailwind classes)
- Primary actions: bg-gray-900 text-white hover:bg-gray-800
- Secondary actions: bg-white text-gray-700 border border-gray-300 hover:bg-gray-50
- Danger actions: bg-red-600 text-white hover:bg-red-700
- Success: text-green-700 bg-green-50 | Warning: text-amber-700 bg-amber-50
- Info/links: text-blue-600 hover:text-blue-700
- Page bg: bg-gray-50 | Cards: bg-white rounded-xl shadow-sm border border-gray-200
- Text: primary gray-900, secondary gray-600, muted gray-500

### Typography
- Page titles: text-2xl font-bold text-gray-900
- Section headings: text-lg font-semibold text-gray-900
- Card titles: text-base font-medium text-gray-900
- Body: text-sm text-gray-600 | Labels: text-sm font-medium text-gray-700
- Meta/helper: text-xs text-gray-500 | Stats: text-3xl font-bold text-gray-900

### Spacing (8pt grid)
- Sections: p-6 | Cards: p-5 or p-6
- Between sections: space-y-6 | Between fields: space-y-4
- Inline gaps: gap-2 or gap-3 | Page header: mb-8

### Component Patterns

PAGE HEADER (every page):
<div className="flex items-center justify-between mb-8">
  <div>
    <h1 className="text-2xl font-bold text-gray-900">Title</h1>
    <p className="mt-1 text-sm text-gray-500">Description</p>
  </div>
  <Link href="/entity/new" className="inline-flex items-center gap-2 px-4 py-2 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-800 transition-colors">+ Add New</Link>
</div>

DATA TABLE:
<div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
  <table className="w-full">
    <thead><tr className="border-b border-gray-200 bg-gray-50">
      <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Col</th>
    </tr></thead>
    <tbody className="divide-y divide-gray-100">
      <tr className="hover:bg-gray-50 transition-colors">
        <td className="px-6 py-4 text-sm text-gray-900">Value</td>
      </tr>
    </tbody>
  </table>
</div>

STAT CARD:
<div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
  <div className="flex items-center gap-3">
    <span className="text-2xl">📊</span>
    <div>
      <p className="text-sm font-medium text-gray-500">Total Items</p>
      <p className="text-3xl font-bold text-gray-900">{count}</p>
    </div>
  </div>
</div>

STATUS BADGE:
<span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-50 text-green-700">Active</span>
<span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-50 text-amber-700">Pending</span>
<span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-50 text-red-700">Inactive</span>

FORM INPUT:
<div>
  <label className="block text-sm font-medium text-gray-700 mb-1">Field</label>
  <input className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent" />
</div>

EMPTY STATE:
<div className="text-center py-12">
  <p className="text-gray-400 text-lg mb-2">No items yet</p>
  <p className="text-gray-400 text-sm mb-4">Get started by creating your first item.</p>
  <Link href="/entity/new" className="inline-flex items-center gap-2 px-4 py-2 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-800">+ Create</Link>
</div>

DETAIL PAGE:
<div className="max-w-3xl">
  <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
    <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4">
      <div>
        <dt className="text-sm font-medium text-gray-500">Label</dt>
        <dd className="mt-1 text-sm text-gray-900">{value}</dd>
      </div>
    </dl>
  </div>
</div>

ERROR DISPLAY:
{error && <div className="bg-red-50 text-red-600 text-sm px-4 py-3 rounded-lg mb-4">{error}</div>}

### Accessibility (REQUIRED)
- ALL buttons: descriptive text, no icon-only without aria-label
- ALL inputs: <label> elements with htmlFor
- ALL interactive: visible focus states (focus:ring-2)
- Contrast: text-gray-900 on white, text-white on dark backgrounds
- Semantic HTML: <main>, <nav>, <table>, <form>, <button>

### Responsive Design
- Tables: wrap in overflow-x-auto
- Dashboard grids: grid-cols-1 sm:grid-cols-2 lg:grid-cols-3
- Forms: max-w-2xl mx-auto
- Detail pages: max-w-3xl

### Micro-interactions
- Buttons: transition-colors on hover
- Table rows: hover:bg-gray-50 transition-colors
- Links: hover:underline or hover color change
- Loading states: disabled:opacity-50 + "Loading..." text swap

### Component States (ALWAYS implement)
- Default → Hover → Active → Focus → Disabled → Loading
- Disabled: opacity-50 cursor-not-allowed pointer-events-none
- Loading: cursor-wait, swap text to "Loading...", add disabled
- Focus: focus:outline-none focus:ring-2 focus:ring-gray-900 focus:ring-offset-2
- Error: border-red-500 + error message below in text-red-600 text-sm

### Loading & Skeleton Patterns
- Page loading: centered spinner or pulse animation
- Table loading: skeleton rows with animate-pulse bg-gray-200 rounded
- Button loading: disabled + "Saving..." / "Creating..." / "Deleting..."
- Data fetch: try/catch + error state + empty state + loaded state

### Toast / Notification Pattern (inline)
- Success: bg-green-50 border border-green-200 text-green-800 rounded-lg p-4
- Error: bg-red-50 border border-red-200 text-red-800 rounded-lg p-4
- Auto-dismiss after 3-5 seconds using setTimeout

### Touch Target Sizing
- Minimum interactive target: 44×44px (WCAG 2.2 Level AA)
- Buttons: min-h-[44px] (mobile-friendly)
- Links in lists: full-row clickable area with py-3
`.trim();

/* ------------------------------------------------------------------ */
/*  LLM System Prompt: Sidebar                                        */
/* ------------------------------------------------------------------ */

/**
 * Sidebar generation instructions for the LLM.
 */
export const SIDEBAR_PROMPT = `
## SIDEBAR (components/Sidebar.tsx)

CRITICAL: Use NAMED EXPORT — export function Sidebar (NOT export default).
The layout imports: import { Sidebar } from "@/components/Sidebar";

Pattern:
"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";

interface SidebarProps { appName: string; }

export function Sidebar({ appName }: SidebarProps) {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  if (pathname === "/login") return null;

  const links = [
    { href: "/", label: "Dashboard", icon: "📊" },
    // One per entity with relevant emoji
  ];

  return (
    <aside className="fixed left-0 top-0 bottom-0 w-64 bg-gray-900 text-white flex flex-col z-50">
      <div className="h-14 flex items-center px-5 border-b border-gray-800">
        <Link href="/" className="text-base font-semibold tracking-tight text-white no-underline">{appName}</Link>
      </div>
      <nav className="flex-1 py-4 px-3 space-y-1 overflow-y-auto">
        {links.map(link => (
          <Link key={link.href} href={link.href}
            className={\`flex items-center gap-3 px-3 py-2 rounded-lg text-sm no-underline transition-colors \${
              pathname === link.href ? "bg-gray-800 text-white font-medium" : "text-gray-400 hover:text-white hover:bg-gray-800/50"
            }\`}>
            <span className="text-base">{link.icon}</span>
            <span>{link.label}</span>
          </Link>
        ))}
      </nav>
      {user && (
        <div className="px-3 py-3 border-t border-gray-800">
          <div className="px-3 py-2 text-xs text-gray-500 truncate">{user.email}</div>
          <button onClick={logout} className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-gray-400 hover:text-white hover:bg-gray-800/50 transition-colors">
            <span>🚪</span><span>Sign out</span>
          </button>
        </div>
      )}
      <div className="px-5 py-3 border-t border-gray-800 text-xs text-gray-500">Powered by NoSoftware</div>
    </aside>
  );
}

export function SidebarLink({ href, label, icon, active }: { href: string; label: string; icon?: string; active?: boolean }) {
  return (
    <Link href={href}
      className={\`flex items-center gap-3 px-3 py-2 rounded-lg text-sm no-underline transition-colors \${
        active ? "bg-gray-800 text-white font-medium" : "text-gray-400 hover:text-white hover:bg-gray-800/50"
      }\`}>
      {icon && <span className="text-base">{icon}</span>}
      <span>{label}</span>
    </Link>
  );
}
`.trim();

/* ------------------------------------------------------------------ */
/*  LLM System Prompt: Page Generation Rules                          */
/* ------------------------------------------------------------------ */

/**
 * Page-specific generation rules for the LLM.
 */
export const PAGE_GENERATION_PROMPT = `
## Pages to generate (follow the UI Design System for EVERY page)

components/Sidebar.tsx — SIDEBAR (client): NAMED EXPORT. Nav links with emoji icons. Logout via useAuth().

app/page.tsx — DASHBOARD (server):
  - Page header with app name and welcome
  - Stat cards: grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6
  - Each card: emoji icon + label + count from db.select()
  - Quick action links

app/<entity>/page.tsx — LIST (server):
  - Page header with title + "Add New" button (top-right)
  - Data table: bg-white rounded-xl shadow-sm border, hover rows
  - Headers: bg-gray-50 text-xs uppercase tracking-wider
  - Format dates, status badges for enums/booleans
  - Empty state with create CTA

app/<entity>/[id]/page.tsx — DETAIL (server):
  - Back link at top
  - Card with dl grid (dt/dd pairs)
  - Action buttons: Back, Delete (with confirmation)

app/<entity>/new/page.tsx — CREATE (client):
  - Page header
  - Form: bg-white rounded-xl shadow-sm border p-6 max-w-2xl
  - Labels + styled inputs for every field
  - <select> dropdowns for FK fields (fetch related)
  - Submit: bg-gray-900 text-white | Error: bg-red-50 text-red-600
  - Cancel link
`.trim();

/* ------------------------------------------------------------------ */
/*  Installed UI/UX Skill Registry                                    */
/* ------------------------------------------------------------------ */

/**
 * Registry of installed Claude skills with their locations and capabilities.
 * Used by the pipeline to know which skills are available and where
 * reference material lives for dynamic prompt enrichment.
 */
export const INSTALLED_SKILLS = {
  'brand-guidelines': {
    path: '.claude/skills/brand-guidelines',
    command: '/brand-guidelines',
    description: 'Brand colors, typography, logo usage, visual identity, tone of voice',
    references: ['brand-identity-and-framework.md'],
  },
  'epic-design': {
    path: '.claude/skills/epic-design',
    command: '/epic-design',
    description: 'Cinematic 2.5D interactive websites with scroll storytelling and parallax',
    references: [
      'text-animations.md', 'inter-section-effects.md', 'depth-system.md',
      'motion-system.md', 'directional-reveals.md', 'performance.md',
      'accessibility.md', 'asset-pipeline.md', 'examples.md',
    ],
    scripts: ['inspect-assets.py', 'validate-layers.js'],
  },
  'saas-scaffolder': {
    path: '.claude/skills/saas-scaffolder',
    command: '/saas-scaffolder',
    description: 'SaaS project scaffolding — auth, database, billing, API, dashboard',
    references: [
      'architecture-patterns.md', 'auth-billing-guide.md',
      'tech-stack-comparison.md', 'saas-architecture-patterns.md',
    ],
    scripts: ['project_bootstrapper.py'],
  },
  'senior-frontend': {
    path: '.claude/skills/senior-frontend',
    command: '/senior-frontend',
    description: 'React/Next.js/TypeScript/Tailwind — components, performance, a11y, review',
    references: [
      'react_patterns.md', 'nextjs_optimization_guide.md',
      'frontend_best_practices.md', 'composition_map.md', 'forcing_questions.md',
    ],
    scripts: [
      'frontend_scaffolder.py', 'frontend_decision_engine.py',
      'component_generator.py', 'bundle_analyzer.py',
    ],
    profiles: ['next-app-router.json', 'remix-or-sveltekit.json', 'vite-spa.json', 'astro-or-static.json'],
  },
  'ui-design-system': {
    path: '.claude/skills/ui-design-system',
    command: '/ui-design-system',
    description: 'Design tokens, component docs, responsive calculations, dev handoff',
    references: [
      'token-generation.md', 'component-architecture.md',
      'responsive-calculations.md', 'developer-handoff.md',
    ],
    scripts: ['design_token_generator.py'],
    assets: ['design_system_doc_template.md'],
  },
  'ux-researcher-designer': {
    path: '.claude/skills/ux-researcher-designer',
    command: '/ux-researcher-designer',
    description: 'UX research — personas, journey maps, usability testing, research synthesis',
    references: [
      'persona-methodology.md', 'journey-mapping-guide.md',
      'usability-testing-frameworks.md', 'example-personas.md',
    ],
    scripts: ['persona_generator.py'],
    assets: ['research_plan_template.md'],
  },
} as const;
