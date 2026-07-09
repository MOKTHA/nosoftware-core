/**
 * @heynxt/persistence
 *
 * Drizzle ORM boundary for the HeyNXT platform.
 *
 * Exports:
 *   - `db` / `getDb` — the configured Drizzle database client (singleton)
 *   - `HeyNxtDb` — type alias for the client
 *   - All `pgTable` definitions (one per entity)
 *   - All `pgEnum` definitions (status enums, role names, etc.)
 *
 * All table columns use camelCase naming to match the Zod schema shapes
 * in `@heynxt/core-types` 1:1 — see individual table files for details.
 *
 * Migrations are generated via drizzle-kit and live under `drizzle/`.
 * Apply with `pnpm db:migrate`.
 */

// Client (singleton)
export { db, getDb, type HeyNxtDb } from './client.js';

// Schema (tables + enums)
export * from './schema/index.js';
