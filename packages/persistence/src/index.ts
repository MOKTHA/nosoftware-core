/**
 * @heynxt/persistence
 *
 * Drizzle ORM boundary for the HeyNXT platform.
 *
 * Exports:
 *   - All `pgTable` definitions (one per entity)
 *   - All `pgEnum` definitions (status enums, role names, etc.)
 *
 * Future exports (to be added in follow-up tasks):
 *   - `db` — the configured Drizzle database client
 *   - Migration helpers
 *
 * All table columns use camelCase naming to match the Zod schema shapes
 * in `@heynxt/core-types` 1:1 — see individual table files for details.
 */

export * from './schema/index.js';
