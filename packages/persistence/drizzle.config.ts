/**
 * drizzle-kit configuration — drives migration generation and application.
 *
 * Used by the scripts in package.json:
 *   pnpm db:migrate:generate  → `drizzle-kit generate`
 *   pnpm db:migrate           → `drizzle-kit migrate`
 *
 * Schema entry: `dist/schema/index.js` (the compiled barrel re-export of all
 * tables — drizzle-kit resolves this via CJS and ESM `.js` imports in the
 * source files are not directly loadable, so we point at the built output).
 * Run `pnpm build` in this package before running drizzle-kit commands.
 * Output directory: `drizzle/` (SQL migrations)
 *
 * Connection:
 *   Reads DATABASE_URL from the environment. Copy `.env.example` to `.env`
 *   (or `packages/persistence/.env`) and ensure it contains the local dev
 *   connection string. See docs/dev-setup.md and docker-compose.yml.
 *
 * Driver / dialect:
 *   Uses the `postgres` (postgres.js) driver for local Postgres 15 dev
 *   (matching docker-compose.yml). For Neon serverless production the
 *   `@neondatabase/serverless` driver can be added later without changes
 *   to this config — the schema definitions are driver-agnostic.
 *
 * Notes:
 *   - drizzle-kit 0.24+ uses `dialect: 'postgresql'` (not `driver: 'pg'`
 *     which was the pre-0.22 syntax). See
 *     https://orm.drizzle.team/kit-docs/config-reference for details.
 *   - `migrationsFolder` has been renamed to `out` in some docs; both work
 *     in 0.24. We use `out` for forwards compatibility.
 */
import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './dist/schema/index.js',
  out: './drizzle',
  dialect: 'postgresql',

  // drizzle-kit requires explicit `dbCredentials` — it does NOT auto-read
  // DATABASE_URL. Wire the env var through here so `pnpm db:migrate` works
  // after setting DATABASE_URL in the shell (or via .env / dotenv in CI).
  dbCredentials: {
    url: process.env.DATABASE_URL ?? 'postgresql://heynxt:heynxt@127.0.0.1:5432/heynxt',
  },
});
