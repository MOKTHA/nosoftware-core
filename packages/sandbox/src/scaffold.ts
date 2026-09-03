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
        next: '15.3.0',
        react: '19.0.0',
        'react-dom': '19.0.0',
        'drizzle-orm': '0.40.0',
        '@neondatabase/serverless': '0.10.4',
        'next-auth': '5.0.0-beta.25',
        zod: '3.24.1',
      },
      devDependencies: {
        'drizzle-kit': '0.30.4',
        tailwindcss: '4.1.0',
        '@tailwindcss/postcss': '4.1.0',
        '@types/node': '22.13.10',
        '@types/react': '19.0.10',
        '@types/react-dom': '19.0.4',
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
      paths: { '@/*': ['./src/*'] },
    },
    include: ['next-env.d.ts', '**/*.ts', '**/*.tsx', '.next/types/**/*.ts'],
    exclude: ['node_modules'],
  },
  null,
  2,
);

const NEXT_CONFIG = `import type { NextConfig } from 'next';
const config: NextConfig = {};
export default config;
`;

const POSTCSS_CONFIG = `module.exports = { plugins: { '@tailwindcss/postcss': {} } };
`;

const DRIZZLE_CONFIG = `import { defineConfig } from 'drizzle-kit';
export default defineConfig({
  schema: './src/db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: { url: process.env.DATABASE_URL! },
});
`;

const DB_LIB = `import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import * as schema from '../db/schema';
const sql = neon(process.env.DATABASE_URL!);
export const db = drizzle(sql, { schema });
`;

const GLOBALS_CSS = `@import "tailwindcss";
`;

const ROOT_LAYOUT = `import './globals.css';
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="en"><body>{children}</body></html>;
}
`;

const HOME_PAGE = `export default function Home() {
  return <main className="p-8">Loading...</main>;
}
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

  // Write all scaffold files
  const files: Array<[string, string]> = [
    [`${base}/package.json`, packageJson(appNameKebab)],
    [`${base}/tsconfig.json`, TSCONFIG],
    [`${base}/next.config.ts`, NEXT_CONFIG],
    [`${base}/postcss.config.js`, POSTCSS_CONFIG],
    [`${base}/drizzle.config.ts`, DRIZZLE_CONFIG],
    [`${base}/src/lib/db.ts`, DB_LIB],
    [`${base}/src/app/globals.css`, GLOBALS_CSS],
    [`${base}/src/app/layout.tsx`, ROOT_LAYOUT],
    [`${base}/src/app/page.tsx`, HOME_PAGE],
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
