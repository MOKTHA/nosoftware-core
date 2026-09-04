/**
 * @heynxt/agent-adapter — UI/UX Design System Prompt
 *
 * Modern SaaS design system themed for Moktha (https://moktha.com/).
 * Icon system: Lucide React only (no emoji).
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
 *
 * THEME NOTES (replace with exact Moktha values):
 * - Primary: deep indigo / tech-blue typical of modern SaaS
 * - Secondary: clean white / light gray surfaces
 * - Accent: vibrant indigo for CTAs and links
 * - Typography: Inter / Geist / SF Pro–style sans for UI
 * - Icons: Lucide React — 1.25rem (20px) default, 1.5rem (24px) for stats/hero
 */


/* ------------------------------------------------------------------ */
/*  Design Tokens                                                     */
/* ------------------------------------------------------------------ */


export const DESIGN_TOKENS = {
  colors: {
    primary: {
      base: 'indigo-900',
      hover: 'indigo-800',
      text: 'white',
    },
    secondary: {
      base: 'white',
      hover: 'gray-50',
      text: 'gray-700',
      border: 'gray-300',
    },
    accent: {
      base: 'indigo-600',
      hover: 'indigo-700',
      text: 'white',
    },
    danger: {
      base: 'red-600',
      hover: 'red-700',
      text: 'white',
    },
    success: {
      bg: 'green-50',
      text: 'green-700',
      icon: 'green-600',
    },
    warning: {
      bg: 'amber-50',
      text: 'amber-700',
      icon: 'amber-600',
    },
    info: {
      bg: 'indigo-50',
      text: 'indigo-700',
      icon: 'indigo-600',
    },
    surface: {
      page: 'gray-50',
      card: 'white',
      subtle: 'gray-100',
    },
    text: {
      primary: 'gray-900',
      secondary: 'gray-600',
      muted: 'gray-500',
      faint: 'gray-400',
    },
    border: {
      default: 'gray-200',
      subtle: 'gray-100',
      strong: 'gray-300',
    },
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
  icons: {
    // Lucide icon sizes
    sm: 'w-4 h-4',   // dense UI, badges, inline actions
    md: 'w-5 h-5',   // default for buttons, nav, table actions
    lg: 'w-6 h-6',   // stat cards, hero, empty states
  },
} as const;


/* ------------------------------------------------------------------ */
/*  Component Patterns (Tailwind class strings)                       */
/* ------------------------------------------------------------------ */


export const COMPONENT_PATTERNS = {
  buttonPrimary:
    'inline-flex items-center gap-2 px-4 py-2 bg-indigo-900 text-white text-sm font-medium rounded-lg hover:bg-indigo-800 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-900 focus:ring-offset-2',
  buttonSecondary:
    'inline-flex items-center gap-2 px-4 py-2 bg-white text-gray-700 text-sm font-medium rounded-lg border border-gray-300 hover:bg-gray-50 transition-colors',
  buttonAccent:
    'inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:ring-offset-2',
  buttonDanger:
    'inline-flex items-center gap-2 px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 transition-colors',
  card: 'bg-white rounded-xl shadow-sm border border-gray-200',
  input:
    'w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-900 focus:border-transparent',
  select:
    'w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-900 focus:border-transparent',
  tableHeader:
    'text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider',
  tableCell: 'px-6 py-4 text-sm text-gray-900',
  badgeSuccess: 'inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-50 text-green-700',
  badgeWarning: 'inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-50 text-amber-700',
  badgeDanger: 'inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-50 text-red-700',
  badgeInfo: 'inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-50 text-indigo-700',
  badgeNeutral: 'inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-700',
  errorMessage: 'bg-red-50 text-red-600 text-sm px-4 py-3 rounded-lg',
} as const;


/* ------------------------------------------------------------------ */
/*  LLM System Prompt: Design System (Lucide)                         */
/* ------------------------------------------------------------------ */


/**
 * Full UI/UX design system prompt injected into LLM calls.
 * Themed for a modern Moktha-style SaaS product with Lucide icons.
 */
export const DESIGN_SYSTEM_PROMPT = `
## UI/UX DESIGN SYSTEM — MOKTHA-THEMED MODERN SAAS (LUCIDE ICONS)


You are a SENIOR UI/UX ENGINEER. Every page must look like a premium, modern SaaS product
with Moktha’s visual DNA: clean surfaces, strong indigo primary, vivid indigo accent,
crisp typography, generous whitespace, and modern flat icons using Lucide React.
DO NOT use emoji for UI icons.


### Icon System (Lucide React — REQUIRED)
- Library: "lucide-react"
- Default icon size: w-5 h-5 (20px)
- Use:
  - w-4 h-4 for dense UI (badges, inline actions)
  - w-5 h-5 for buttons, nav items, table row actions
  - w-6 h-6 for stat cards, empty states, hero sections
- Icon colors:
  - Neutral UI: text-gray-500 / text-gray-600
  - Primary actions: text-white on dark buttons
  - Status: text-green-600 / text-amber-600 / text-red-600 / text-indigo-600
- Always pair icons with text labels in buttons and nav items.
- Decorative icons: aria-hidden="true"
- Meaningful icons: ensure accessible labels via surrounding text or aria-label.


### Recommended Icon Mapping (use consistently)
Dashboard: LayoutDashboard  
Overview: Home  
Projects: FolderKanban / Briefcase  
Tasks: CheckSquare / ListTodo  
Users: Users  
Roles: Shield  
Settings: Settings  
Billing: CreditCard  
Usage/Analytics: BarChart3 / LineChart  
Activity: Activity  
Audit log: FileText  
Search: Search  
Filter: Filter  
Sort: ArrowUpDown  
Add/Create: Plus  
Edit: Pen / Edit  
View: Eye  
Delete: Trash2  
Duplicate: Copy  
Download: Download  
Upload: Upload  
Share: Share2  
Export: FileOutput  
Import: FileInput  
Refresh: RefreshCw  
Save: Save  
Cancel: X  
Close: X  
Back: ArrowLeft  
Next: ArrowRight  
More: MoreHorizontal  
Info: Info  
Success: CheckCircle2  
Warning: AlertTriangle  
Error: AlertCircle / XCircle  
Lock: Lock / LockKeyhole  
Unlock: Unlock  
Notifications: Bell  
Messages: MessageSquare  
Help: HelpCircle  
Docs: BookOpen  
External link: ExternalLink  

Use these mappings consistently across sidebar, pages, and components.


### Color Palette (Tailwind classes — adapt to Moktha’s exact hex if known)
- Primary actions: bg-indigo-900 text-white hover:bg-indigo-800
- Accent/CTA: bg-indigo-600 text-white hover:bg-indigo-700
- Secondary actions: bg-white text-gray-700 border border-gray-300 hover:bg-gray-50
- Danger actions: bg-red-600 text-white hover:bg-red-700
- Success: text-green-700 bg-green-50 | icon: text-green-600
- Warning: text-amber-700 bg-amber-50 | icon: text-amber-600
- Info/links: text-indigo-600 hover:text-indigo-700
- Page bg: bg-gray-50
- Cards: bg-white rounded-xl shadow-sm border border-gray-200
- Text: primary gray-900, secondary gray-600, muted gray-500


### Typography
Use a clean, modern sans (Inter/Geist/SF Pro style). If Moktha uses a custom font,
configure it globally and reference here.

- Page titles: text-2xl font-bold text-gray-900
- Section headings: text-lg font-semibold text-gray-900
- Card titles: text-base font-medium text-gray-900
- Body: text-sm text-gray-600
- Labels: text-sm font-medium text-gray-700
- Meta/helper: text-xs text-gray-500
- Stats: text-3xl font-bold text-gray-900


### Spacing (8pt grid)
- Sections: p-6
- Cards: p-5 or p-6
- Between sections: space-y-6
- Between fields: space-y-4
- Inline gaps: gap-2 or gap-3
- Page header: mb-8


### Component Patterns


PAGE HEADER (every page):
"use client";
import Link from "next/link";
import { Plus } from "lucide-react";

<div className="flex items-center justify-between mb-8">
  <div>
    <h1 className="text-2xl font-bold text-gray-900">Title</h1>
    <p className="mt-1 text-sm text-gray-500">Description</p>
  </div>
  <Link href="/entity/new" className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-900 text-white text-sm font-medium rounded-lg hover:bg-indigo-800 transition-colors">
    <Plus className="w-4 h-4" />
    <span>Add New</span>
  </Link>
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


STAT CARD (with Lucide icon):
"use client";
import { BarChart3 } from "lucide-react";

<div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
  <div className="flex items-center gap-3">
    <div className="flex items-center justify-center w-12 h-12 rounded-lg bg-indigo-50 text-indigo-600">
      <BarChart3 className="w-6 h-6" />
    </div>
    <div>
      <p className="text-sm font-medium text-gray-500">Total Items</p>
      <p className="text-3xl font-bold text-gray-900">{count}</p>
    </div>
  </div>
</div>


STATUS BADGE (with Lucide icon):
"use client";
import { CheckCircle2, AlertCircle, XCircle, Info } from "lucide-react";

<span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-50 text-green-700">
  <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" />
  Active
</span>

<span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-50 text-amber-700">
  <AlertCircle className="w-3.5 h-3.5" aria-hidden="true" />
  Pending
</span>

<span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-50 text-red-700">
  <XCircle className="w-3.5 h-3.5" aria-hidden="true" />
  Inactive
</span>

<span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-50 text-indigo-700">
  <Info className="w-3.5 h-3.5" aria-hidden="true" />
  Info
</span>


FORM INPUT:
<div>
  <label className="block text-sm font-medium text-gray-700 mb-1">Field</label>
  <input className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-900 focus:border-transparent" />
</div>


EMPTY STATE:
"use client";
import { Inbox } from "lucide-react";
import Link from "next/link";
import { Plus } from "lucide-react";

<div className="text-center py-12">
  <div className="mx-auto mb-4 flex items-center justify-center w-12 h-12 rounded-full bg-gray-100 text-gray-400">
    <Inbox className="w-6 h-6" aria-hidden="true" />
  </div>
  <p className="text-gray-500 text-lg mb-2">No items yet</p>
  <p className="text-gray-400 text-sm mb-4">Get started by creating your first item.</p>
  <Link href="/entity/new" className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-900 text-white text-sm font-medium rounded-lg hover:bg-indigo-800">
    <Plus className="w-4 h-4" />
    <span>Create</span>
  </Link>
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
"use client";
import { AlertCircle } from "lucide-react";

{error && (
  <div className="bg-red-50 text-red-600 text-sm px-4 py-3 rounded-lg mb-4 flex items-start gap-2">
    <AlertCircle className="w-4 h-4 mt-0.5" aria-hidden="true" />
    <span>{error}</span>
  </div>
)}


### Accessibility (REQUIRED)
- ALL buttons: descriptive text, no icon-only without aria-label
- ALL inputs: <label> elements with htmlFor
- ALL interactive: visible focus states (focus:ring-2)
- Contrast: text-gray-900 on white, text-white on dark backgrounds
- Semantic HTML: <main>, <nav>, <table>, <form>, <button>
- Icons:
  - Decorative: aria-hidden="true"
  - Meaningful: ensure accessible labels via surrounding text or aria-label


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
- Loading: cursor-wait, swap text to "Saving..." / "Creating..." / "Deleting..."
- Focus: focus:outline-none focus:ring-2 focus:ring-indigo-900 focus:ring-offset-2
- Error: border-red-500 + error message below in text-red-600 text-sm


### Loading & Skeleton Patterns
- Page loading: centered spinner or pulse animation
- Table loading: skeleton rows with animate-pulse bg-gray-200 rounded
- Button loading: disabled + "Saving..." / "Creating..." / "Deleting..."
- Data fetch: try/catch + error state + empty state + loaded state


### Toast / Notification Pattern (inline)
- Success: bg-green-50 border border-green-200 text-green-800 rounded-lg p-4 with CheckCircle2 icon
- Error: bg-red-50 border border-red-200 text-red-800 rounded-lg p-4 with AlertCircle icon
- Auto-dismiss after 3–5 seconds using setTimeout


### Touch Target Sizing
- Minimum interactive target: 44×44px (WCAG 2.2 Level AA)
- Buttons: min-h-[44px] (mobile-friendly)
- Links in lists: full-row clickable area with py-3
`.trim();


/* ------------------------------------------------------------------ */
/*  LLM System Prompt: Sidebar (Lucide)                               */
/* ------------------------------------------------------------------ */


/**
 * Sidebar generation instructions for the LLM.
 * Styled to match the Moktha-themed design system with Lucide icons.
 */
export const SIDEBAR_PROMPT = `
## SIDEBAR (components/Sidebar.tsx) — LUCIDE ICONS


CRITICAL: Use NAMED EXPORT — export function Sidebar (NOT export default).
The layout imports: import { Sidebar } from "@/components/Sidebar";

Use Lucide React icons ONLY. No emoji.


Example imports:
import {
  LayoutDashboard,
  FolderKanban,
  Users,
  Settings,
  LogOut,
} from "lucide-react";


Pattern:
"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import {
  LayoutDashboard,
  FolderKanban,
  Users,
  Settings,
  LogOut,
} from "lucide-react";


interface SidebarProps { appName: string; }


export function Sidebar({ appName }: SidebarProps) {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  if (pathname === "/login") return null;


  const links = [
    { href: "/", label: "Dashboard", icon: LayoutDashboard },
    { href: "/projects", label: "Projects", icon: FolderKanban },
    { href: "/users", label: "Users", icon: Users },
    { href: "/settings", label: "Settings", icon: Settings },
  ];


  return (
    <aside className="fixed left-0 top-0 bottom-0 w-64 bg-gray-900 text-white flex flex-col z-50">
      <div className="h-14 flex items-center px-5 border-b border-gray-800">
        <Link href="/" className="text-base font-semibold tracking-tight text-white no-underline">{appName}</Link>
      </div>
      <nav className="flex-1 py-4 px-3 space-y-1 overflow-y-auto">
        {links.map(link => {
          const Icon = link.icon;
          const active = pathname === link.href;
          return (
            <Link key={link.href} href={link.href}
              className={\`flex items-center gap-3 px-3 py-2 rounded-lg text-sm no-underline transition-colors \${
                active ? "bg-gray-800 text-white font-medium" : "text-gray-400 hover:text-white hover:bg-gray-800/50"
              }\`}>
              <Icon className="w-5 h-5" aria-hidden="true" />
              <span>{link.label}</span>
            </Link>
          );
        })}
      </nav>
      {user && (
        <div className="px-3 py-3 border-t border-gray-800">
          <div className="px-3 py-2 text-xs text-gray-500 truncate">{user.email}</div>
          <button onClick={logout} className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-gray-400 hover:text-white hover:bg-gray-800/50 transition-colors">
            <LogOut className="w-5 h-5" aria-hidden="true" />
            <span>Sign out</span>
          </button>
        </div>
      )}
      <div className="px-5 py-3 border-t border-gray-800 text-xs text-gray-500">Powered by NoSoftware</div>
    </aside>
  );
}
`.trim();


/* ------------------------------------------------------------------ */
/*  LLM System Prompt: Page Generation Rules (Lucide)                 */
/* ------------------------------------------------------------------ */


/**
 * Page-specific generation rules for the LLM.
 * All pages must follow the Moktha-themed design system with Lucide icons.
 */
export const PAGE_GENERATION_PROMPT = `
## Pages to generate (follow the Moktha-themed UI Design System with Lucide icons)


components/Sidebar.tsx — SIDEBAR (client): NAMED EXPORT. Nav links with Lucide icons. Logout via useAuth().


app/page.tsx — DASHBOARD (server):
  - Page header with app name and welcome
  - Stat cards: grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6
  - Each card: Lucide icon inside colored rounded square + label + count from db.select()
    - Example icons: LayoutDashboard, BarChart3, Users, FolderKanban, Activity
  - Quick action links using Moktha-style primary/accent buttons with Lucide icons


app/<entity>/page.tsx — LIST (server):
  - Page header with title + "Add New" button (top-right, Moktha primary) with Plus icon
  - Data table: bg-white rounded-xl shadow-sm border, hover rows
  - Headers: bg-gray-50 text-xs uppercase tracking-wider
  - Row actions: Edit (Pen), Delete (Trash2), View (Eye) — all w-4 h-4
  - Status badges with Lucide icons (CheckCircle2, AlertCircle, XCircle, Info)
  - Empty state with create CTA using Inbox + Plus icons


app/<entity>/[id]/page.tsx — DETAIL (server):
  - Back link at top with ArrowLeft icon
  - Card with dl grid (dt/dd pairs)
  - Action buttons: Back (ArrowLeft), Edit (Pen), Delete (Trash2 with confirmation)


app/<entity>/new/page.tsx — CREATE (client):
  - Page header
  - Form: bg-white rounded-xl shadow-sm border p-6 max-w-2xl
  - Labels + styled inputs for every field (focus ring indigo-900)
  - <select> dropdowns for FK fields (fetch related)
  - Submit: bg-indigo-900 text-white (primary) or bg-indigo-600 (accent) with Save icon
  - Cancel link with X icon
  - Error: bg-red-50 text-red-600 with AlertCircle icon
`.trim();


/* ------------------------------------------------------------------ */
/*  Installed UI/UX Skill Registry                                    */
/* ------------------------------------------------------------------ */


/**
 * Registry of installed Claude skills with their locations and capabilities.
 * Updated to reflect Lucide icon usage and Moktha theme.
 */
export const INSTALLED_SKILLS = {
  'brand-guidelines': {
    path: '.claude/skills/brand-guidelines',
    command: '/brand-guidelines',
    description: 'Brand colors, typography, logo usage, visual identity, tone of voice (extend with Moktha brand docs + Lucide icon style)',
    references: ['brand-identity-and-framework.md'],
  },
  'epic-design': {
    path: '.claude/skills/epic-design',
    command: '/epic-design',
    description: 'Cinematic 2.5D interactive websites with scroll storytelling and parallax (adapt for Moktha marketing site patterns + iconography)',
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
    description: 'SaaS project scaffolding — auth, database, billing, API, dashboard (use Moktha-themed UI tokens + Lucide icons)',
    references: [
      'architecture-patterns.md', 'auth-billing-guide.md',
      'tech-stack-comparison.md', 'saas-architecture-patterns.md',
    ],
    scripts: ['project_bootstrapper.py'],
  },
  'senior-frontend': {
    path: '.claude/skills/senior-frontend',
    command: '/senior-frontend',
    description: 'React/Next.js/TypeScript/Tailwind — components, performance, a11y, review (apply Moktha theme + Lucide icon patterns)',
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
    description: 'Design tokens, component docs, responsive calculations, dev handoff (extend with Moktha tokens + Lucide icon system)',
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
  'senior-backend': {
    path: '.claude/skills/senior-backend',
    command: '/senior-backend',
    description: 'REST APIs, microservices, database architectures, auth, security hardening',
    references: [
      'api_design_patterns.md', 'backend_security_practices.md',
      'composition_map.md', 'database_optimization_guide.md', 'forcing_questions.md',
    ],
    scripts: [
      'api_load_tester.py', 'api_scaffolder.py',
      'backend_decision_engine.py', 'database_migration_tool.py',
    ],
    profiles: ['node-express.json', 'fastapi-python.json', 'django-monolith.json', 'go-or-rust-microservice.json'],
  },
  'api-design-reviewer': {
    path: '.claude/skills/api-design-reviewer',
    command: '/api-design-reviewer',
    description: 'REST API design review — linting, breaking-change detection, design scorecards',
    references: ['api_antipatterns.md', 'rest_design_rules.md'],
    scripts: ['api_linter.py', 'api_scorecard.py', 'breaking_change_detector.py'],
  },
  'database-designer': {
    path: '.claude/skills/database-designer',
    command: '/database-designer',
    description: 'Database schema design, query optimization, migration planning, index strategies',
    references: [
      'database-design-reference.md', 'database_selection_decision_tree.md',
      'index_strategy_patterns.md', 'normalization_guide.md',
    ],
    scripts: ['index_optimizer.py', 'migration_generator.py', 'schema_analyzer.py'],
    assets: ['sample_schema.json', 'sample_query_patterns.json'],
  },
  'database-schema-designer': {
    path: '.claude/skills/database-schema-designer',
    command: '/database-schema-designer',
    description: 'ERD diagrams, schema normalization, table relationships, schema migrations',
    references: ['full-schema-examples.md'],
  },
  'senior-fullstack': {
    path: '.claude/skills/senior-fullstack',
    command: '/senior-fullstack',
    description: 'Fullstack dev toolkit — Next.js/FastAPI/MERN scaffolding, code quality, stack selection',
    references: [
      'architecture_patterns.md', 'composition_map.md',
      'development_workflows.md', 'forcing_questions.md', 'tech_stack_guide.md',
    ],
    scripts: ['code_quality_analyzer.py', 'fullstack_decision_engine.py', 'project_scaffolder.py'],
    profiles: ['saas-startup.json', 'enterprise-scale.json', 'internal-tool.json', 'marketing-site.json'],
  },
  'api-test-suite-builder': {
    path: '.claude/skills/api-test-suite-builder',
    command: '/api-test-suite-builder',
    description: 'API test generation — integration tests, contract tests, REST endpoint coverage',
    references: ['example-test-files.md'],
  },
  'senior-qa': {
    path: '.claude/skills/senior-qa',
    command: '/senior-qa',
    description: 'QA strategy, test planning, risk analysis, defect triage, regression suites',
    references: [
      'automation_patterns.md', 'composition_map.md',
      'forcing_questions.md', 'qa_methodology_guide.md', 'test_strategy_templates.md',
    ],
    scripts: [
      'qa_decision_engine.py', 'regression_suite_builder.py',
      'test_coverage_analyzer.py', 'test_plan_generator.py',
    ],
    profiles: ['web-app-testing.json', 'api-only-testing.json', 'mobile-testing.json', 'enterprise-qa.json'],
  },
  'a11y-audit': {
    path: '.claude/skills/a11y-audit',
    command: '/a11y-audit',
    description: 'Accessibility audit — WCAG conformance, ARIA, screen reader, keyboard nav',
    references: [
      'aria-patterns.md', 'audit-methodology.md', 'remediation-patterns.md', 'wcag-checklist.md',
    ],
    scripts: ['a11y_audit.py', 'a11y_report_generator.py'],
  },
  'tdd-guide': {
    path: '.claude/skills/tdd-guide',
    command: '/tdd-guide',
    description: 'Test-driven development — red-green-refactor cycles, test doubles, coverage',
    references: ['tdd-patterns.md', 'testing-best-practices.md'],
  },
  'performance-profiler': {
    path: '.claude/skills/performance-profiler',
    command: '/performance-profiler',
    description: 'Performance profiling — flame graphs, memory leaks, bundle size, Core Web Vitals',
    references: [
      'bottleneck-patterns.md', 'bundle-optimization.md',
      'memory-leak-guide.md', 'profiling-methodology.md',
    ],
    scripts: ['bundle_analyzer.py', 'memory_profiler.py', 'performance_profiler.py'],
  },
  'chaos-engineering': {
    path: '.claude/skills/chaos-engineering',
    command: '/chaos-engineering',
    description: 'Chaos engineering — failure injection, resilience testing, blast radius analysis',
    references: ['chaos-patterns.md', 'experiment-design.md', 'resilience-patterns.md'],
    scripts: ['chaos_experiment_runner.py', 'failure_injector.py'],
  },
  'security-pen-testing': {
    path: '.claude/skills/security-pen-testing',
    command: '/security-pen-testing',
    description: 'Security pen testing — OWASP Top 10, auth bypass, injection, XSS, CSRF',
    references: [
      'owasp-testing-guide.md', 'remediation-playbook.md', 'vulnerability-patterns.md',
    ],
    scripts: ['pentest_scanner.py', 'vulnerability_reporter.py'],
  },
} as const;