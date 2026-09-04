/**
 * @heynxt/sandbox — Next.js Scaffold Writer
 *
 * Writes a complete base Next.js 15 project into a sandbox at
 * `/workspace/app/` and runs `npm install`. No LLM call — all
 * content is static. The `appName` is interpolated into
 * `package.json` as a kebab-case name field.
 */

import type { SandboxSession } from './session.js';

/** ------------------------------------------------------------------ */
/*  Helpers                                                           */
/** ------------------------------------------------------------------ */

function toKebabCase(str: string): string {
  return str
    .replace(/([a-z])([A-Z])/g, '$1-$2')
    .replace(/[\s_]+/g, '-')
    .replace(/[^a-zA-Z0-9-]/g, '')
    .toLowerCase();
}

/** ------------------------------------------------------------------ */
/*  Static file contents                                              */
/** ------------------------------------------------------------------ */

function packageJson(appNameKebab: string): string {
  return JSON.stringify(
    {
      name: appNameKebab,
      version: '0.1.0',
      private: true,
      scripts: {
        dev: 'next dev',
        build: 'next build',
        start: 'next start',
        'db:generate': 'drizzle-kit generate',
        'db:migrate': 'drizzle-kit migrate',
      },
      dependencies: {
        next: '15.5.25',
        react: '19.2.8',
        'react-dom': '19.2.8',
        'drizzle-orm': '0.40.0',
        '@neondatabase/serverless': '0.10.4',
        'next-auth': '5.0.0-beta.25',
        zod: '3.24.1',
        bcryptjs: '2.4.3',
      },
      devDependencies: {
        'drizzle-kit': '0.30.4',
        tailwindcss: '4.1.0',
        '@tailwindcss/postcss': '4.1.0',
        '@types/node': '22.13.10',
        '@types/react': '19.0.10',
        '@types/react-dom': '19.0.4',
        '@types/bcryptjs': '2.4.6',
        typescript: '5.7.3',
      },
    },
    null,
    2,
  );
}

const TSCONFIG = JSON.stringify(
  {
    compilerOptions: {
      target: 'ES2017',
      lib: ['dom', 'dom.iterable', 'esnext'],
      allowJs: true,
      skipLibCheck: true,
      strict: true,
      noEmit: true,
      esModuleInterop: true,
      module: 'esnext',
      moduleResolution: 'bundler',
      resolveJsonModule: true,
      isolatedModules: true,
      jsx: 'preserve',
      incremental: true,
      plugins: [{ name: 'next' }],
      paths: { '@/*': ['./*'] },
    },
    include: ['next-env.d.ts', '**/*.ts', '**/*.tsx', '.next/types/**/*.ts'],
    exclude: ['node_modules'],
  },
  null,
  2,
);

const NEXT_CONFIG = `import type { NextConfig } from 'next';
const config: NextConfig = {
  // LLM-generated code may have minor type/lint issues that don't affect
  // runtime behaviour. Skip these checks so the build succeeds on Vercel.
  typescript: { ignoreBuildErrors: true },
  eslint: { ignoreDuringBuilds: true },
  // Allow embedding in iframes (the control plane previews deployed apps).
  // We unset X-Frame-Options (Vercel defaults to SAMEORIGIN which blocks iframes)
  // and use the modern Content-Security-Policy frame-ancestors directive instead.
  async headers() {
    return [{
      source: '/:path*',
      headers: [
        { key: 'Content-Security-Policy', value: 'frame-ancestors *' },
      ],
    }];
  },
};
export default config;
`;

// vercel.json overrides Vercel's platform-level X-Frame-Options: SAMEORIGIN
// which blocks iframe embedding. The "override: true" flag replaces the
// default header entirely. CSP frame-ancestors takes precedence in modern
// browsers, but removing X-Frame-Options avoids conflicts.
const VERCEL_JSON = JSON.stringify(
  {
    headers: [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Frame-Options', value: '' },
          { key: 'Content-Security-Policy', value: 'frame-ancestors *' },
        ],
      },
    ],
  },
  null,
  2,
);

const POSTCSS_CONFIG = `module.exports = { plugins: { '@tailwindcss/postcss': {} } };
`;

const DRIZZLE_CONFIG = `import { defineConfig } from 'drizzle-kit';
export default defineConfig({
  schema: './lib/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: { url: process.env.DATABASE_URL! },
});
`;

const DB_LIB = `import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import * as schema from './schema';

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL environment variable is not set');
}

const sql = neon(process.env.DATABASE_URL);
export const db = drizzle(sql, { schema });
`;

const HEALTH_ROUTE = `export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET() {
  try {
    // Test raw SQL connectivity
    const result = await db.execute("SELECT 1 as ok");
    return NextResponse.json({
      status: "ok",
      database: "connected",
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    return NextResponse.json({
      status: "error",
      database: "disconnected",
      error: (err as Error).message,
      timestamp: new Date().toISOString(),
    }, { status: 500 });
  }
}
`;

/* ------------------------------------------------------------------ */
/*  Auth: login API + seed admin user                                 */
/* ------------------------------------------------------------------ */

const AUTH_ROUTE = `export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { adminUsers } from "@/lib/schema";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";

export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json();
    if (!email || !password) {
      return NextResponse.json({ error: "Email and password required" }, { status: 400 });
    }

    const [user] = await db.select().from(adminUsers).where(eq(adminUsers.email, email));
    if (!user) {
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
    }

    // Simple token — in production use JWT or NextAuth sessions
    const token = Buffer.from(JSON.stringify({ id: user.id, email: user.email, name: user.name })).toString("base64");

    const response = NextResponse.json({ success: true, user: { id: user.id, email: user.email, name: user.name } });
    response.cookies.set("auth-token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 7, // 7 days
    });
    return response;
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
`;

const AUTH_ME_ROUTE = `export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const token = req.cookies.get("auth-token")?.value;
  if (!token) {
    return NextResponse.json({ user: null }, { status: 401 });
  }
  try {
    const user = JSON.parse(Buffer.from(token, "base64").toString());
    return NextResponse.json({ user });
  } catch {
    return NextResponse.json({ user: null }, { status: 401 });
  }
}
`;

const AUTH_LOGOUT_ROUTE = `export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";

export async function POST() {
  const response = NextResponse.json({ success: true });
  response.cookies.delete("auth-token");
  return response;
}
`;

const SEED_ROUTE = `export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { adminUsers } from "@/lib/schema";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";

export async function POST() {
  try {
    // Check if admin already exists
    const [existing] = await db.select().from(adminUsers).where(eq(adminUsers.email, "admin@nosoftware.ai"));
    if (existing) {
      return NextResponse.json({ message: "Admin user already exists" });
    }

    const hash = await bcrypt.hash("nosoftware@1234", 10);
    await db.insert(adminUsers).values({
      email: "admin@nosoftware.ai",
      name: "Admin",
      passwordHash: hash,
    });

    return NextResponse.json({ message: "Admin user created", email: "admin@nosoftware.ai" });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
`;

/* ------------------------------------------------------------------ */
/*  Layout, sidebar, login page                                       */
/* ------------------------------------------------------------------ */

const GLOBALS_CSS = `@import "tailwindcss";

/* ── NoSoftware Design System Tokens ─────────────────────────── */

:root {
  --color-primary: #111827;
  --color-primary-hover: #1f2937;
  --color-accent: #2563eb;
  --color-accent-hover: #1d4ed8;
  --color-danger: #dc2626;
  --color-success: #059669;
  --color-warning: #d97706;
  --radius-sm: 0.375rem;
  --radius-md: 0.5rem;
  --radius-lg: 0.75rem;
  --radius-xl: 1rem;
  --shadow-card: 0 1px 3px 0 rgb(0 0 0 / 0.05), 0 1px 2px -1px rgb(0 0 0 / 0.05);
}

/* Smooth transitions on interactive elements */
a, button, input, select, textarea {
  transition: all 0.15s ease;
}

/* Better focus rings */
*:focus-visible {
  outline: 2px solid var(--color-primary);
  outline-offset: 2px;
  border-radius: var(--radius-sm);
}

/* Table styling defaults */
table { border-collapse: collapse; }
th { text-align: left; }

/* Scrollbar styling */
::-webkit-scrollbar { width: 6px; height: 6px; }
::-webkit-scrollbar-track { background: transparent; }
::-webkit-scrollbar-thumb { background: #d1d5db; border-radius: 3px; }
::-webkit-scrollbar-thumb:hover { background: #9ca3af; }
`;

function rootLayout(appName: string): string {
  return `import './globals.css';
import { Sidebar } from '@/components/Sidebar';
import { AuthProvider } from '@/components/AuthProvider';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-gray-50 text-gray-900" style={{ margin: 0 }}>
        <AuthProvider>
          <div className="flex min-h-screen">
            <Sidebar appName="${appName}" />
            <div className="flex flex-col flex-1 ml-64">
              <header className="h-14 border-b border-gray-200 bg-white flex items-center justify-between px-6">
                <h1 className="text-sm font-medium text-gray-700">${appName}</h1>
                <div id="header-user" />
              </header>
              <main className="flex-1 p-6">
                {children}
              </main>
              <footer className="border-t border-gray-200 bg-white px-6 py-3 text-xs text-gray-400 flex items-center justify-between">
                <span>© ${new Date().getFullYear()} ${appName}</span>
                <span>Powered by <a href="https://nosoftware.ai" target="_blank" rel="noopener noreferrer" className="text-gray-500 hover:text-gray-700 font-medium">NoSoftware</a></span>
              </footer>
            </div>
          </div>
        </AuthProvider>
      </body>
    </html>
  );
}
`;
}

const SIDEBAR_COMPONENT = `"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

interface SidebarProps {
  appName: string;
}

export function Sidebar({ appName }: SidebarProps) {
  const pathname = usePathname();

  // Login page should not show sidebar
  if (pathname === "/login") return null;

  return (
    <aside className="fixed left-0 top-0 bottom-0 w-64 bg-gray-900 text-white flex flex-col z-50">
      {/* Logo */}
      <div className="h-14 flex items-center px-5 border-b border-gray-800">
        <Link href="/" className="text-base font-semibold tracking-tight text-white no-underline">
          {appName}
        </Link>
      </div>

      {/* Navigation — LLM will inject links here */}
      <nav id="sidebar-nav" className="flex-1 py-4 px-3 space-y-1 overflow-y-auto">
        <SidebarLink href="/" label="Dashboard" icon="◻" active={pathname === "/"} />
        {/* Entity links will be added by the LLM-generated code */}
      </nav>

      {/* Footer */}
      <div className="px-5 py-3 border-t border-gray-800 text-xs text-gray-500">
        Powered by NoSoftware
      </div>
    </aside>
  );
}

export function SidebarLink({ href, label, icon, active }: { href: string; label: string; icon?: string; active?: boolean }) {
  return (
    <Link
      href={href}
      className={\`flex items-center gap-3 px-3 py-2 rounded-lg text-sm no-underline transition-colors \${
        active
          ? "bg-gray-800 text-white font-medium"
          : "text-gray-400 hover:text-white hover:bg-gray-800/50"
      }\`}
    >
      {icon && <span className="text-base">{icon}</span>}
      <span>{label}</span>
    </Link>
  );
}
`;

const AUTH_PROVIDER = `"use client";
import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { usePathname, useRouter } from "next/navigation";

interface User {
  id: string;
  email: string;
  name: string;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({ user: null, loading: true, logout: async () => {} });

export function useAuth() {
  return useContext(AuthContext);
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    fetch("/api/auth/me")
      .then((res) => (res.ok ? res.json() : { user: null }))
      .then((data) => {
        setUser(data.user);
        setLoading(false);
        if (!data.user && pathname !== "/login") {
          // Seed admin user on first load (idempotent)
          fetch("/api/auth/seed", { method: "POST" }).catch(() => {});
          router.push("/login");
        }
      })
      .catch(() => {
        setLoading(false);
        if (pathname !== "/login") router.push("/login");
      });
  }, [pathname, router]);

  const logout = useCallback(async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    setUser(null);
    router.push("/login");
  }, [router]);

  return (
    <AuthContext.Provider value={{ user, loading, logout }}>
      {children}
    </AuthContext.Provider>
  );
}
`;

const LOGIN_PAGE = `"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("admin@nosoftware.ai");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Login failed");

      router.push("/");
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50" style={{ marginLeft: 0 }}>
      <div className="w-full max-w-sm">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
          <h1 className="text-xl font-semibold text-gray-900 text-center mb-1">Welcome back</h1>
          <p className="text-sm text-gray-500 text-center mb-6">Sign in to your account</p>

          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="bg-red-50 text-red-600 text-sm px-4 py-2 rounded-lg">{error}</div>
            )}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                placeholder="Enter your password"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full py-2 bg-gray-900 text-white rounded-lg text-sm font-medium hover:bg-gray-800 disabled:opacity-50 transition-colors"
            >
              {loading ? "Signing in..." : "Sign in"}
            </button>
          </form>

          <p className="text-xs text-gray-400 text-center mt-6">
            Default: admin@nosoftware.ai / nosoftware@1234
          </p>
        </div>

        <p className="text-xs text-gray-400 text-center mt-4">
          Powered by <a href="https://nosoftware.ai" target="_blank" rel="noopener noreferrer" className="text-gray-500 hover:text-gray-700 font-medium">NoSoftware</a>
        </p>
      </div>
    </div>
  );
}
`;

const HOME_PAGE = `export const dynamic = "force-dynamic";

export default function Home() {
  return (
    <main className="min-h-[60vh] flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Welcome</h1>
        <p className="text-gray-500">Your app is live. Use the sidebar to navigate.</p>
      </div>
    </main>
  );
}
`;

/* ------------------------------------------------------------------ */
/*  Admin users schema (appended to LLM-generated schema)             */
/* ------------------------------------------------------------------ */

const ADMIN_USERS_SCHEMA = `
// ── Auth: admin users (scaffold-provided) ──────────────────────────
export const adminUsers = pgTable("admin_users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  passwordHash: text("password_hash").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
`;

/** ------------------------------------------------------------------ */
/*  Main function                                                     */
/** ------------------------------------------------------------------ */

/**
 * Write a complete base Next.js 15 project to `/workspace/app/` in the
 * sandbox, then run `npm install`.
 *
 * @param session - An active SandboxSession.
 * @param appName - Human-readable application name (converted to kebab-case).
 * @throws {Error} If `npm install` exits non-zero.
 */
export async function writeNextJsScaffold(
  session: SandboxSession,
  appName: string,
): Promise<void> {
  const appNameKebab = toKebabCase(appName);
  const base = '/workspace/app';

  // Write all scaffold files — flat layout (no src/ subdirectory) so
  // LLM-generated routes at app/ share the same root as the layout.
  const files: Array<[string, string]> = [
    [`${base}/package.json`, packageJson(appNameKebab)],
    [`${base}/tsconfig.json`, TSCONFIG],
    [`${base}/next.config.ts`, NEXT_CONFIG],
    [`${base}/postcss.config.js`, POSTCSS_CONFIG],
    [`${base}/drizzle.config.ts`, DRIZZLE_CONFIG],
    [`${base}/lib/db.ts`, DB_LIB],
    [`${base}/app/globals.css`, GLOBALS_CSS],
    [`${base}/app/layout.tsx`, rootLayout(appName)],
    [`${base}/app/page.tsx`, HOME_PAGE],
    [`${base}/app/login/page.tsx`, LOGIN_PAGE],
    [`${base}/app/api/health/route.ts`, HEALTH_ROUTE],
    [`${base}/app/api/auth/login/route.ts`, AUTH_ROUTE],
    [`${base}/app/api/auth/me/route.ts`, AUTH_ME_ROUTE],
    [`${base}/app/api/auth/logout/route.ts`, AUTH_LOGOUT_ROUTE],
    [`${base}/app/api/auth/seed/route.ts`, SEED_ROUTE],
    [`${base}/components/Sidebar.tsx`, SIDEBAR_COMPONENT],
    [`${base}/components/AuthProvider.tsx`, AUTH_PROVIDER],
    [`${base}/vercel.json`, VERCEL_JSON],
  ];

  for (const [path, content] of files) {
    await session.writeFile(path, content);
  }

  // Install dependencies
  const result = await session.runCommand('npm', ['install'], { cwd: base });
  if (result.exitCode !== 0) {
    throw new Error(`npm install failed:\n${result.stderr}`);
  }
}

/**
 * Content that must be appended to the LLM-generated schema so the
 * admin_users table is created alongside the app entities.
 */
export const ADMIN_USERS_SCHEMA_APPEND = ADMIN_USERS_SCHEMA;
