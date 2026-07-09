# @heynxt/persistence

The persistence layer for the HeyNXT platform. This package owns all Drizzle ORM
code: table definitions, migrations, and (in a follow-up) the database client.

## What it exposes

- **Table schemas** — Drizzle `pgTable` definitions, one per entity, derived 1:1
  from the Zod schemas in `@heynxt/core-types`. Column names and types match the
  Zod field shapes so mapping between runtime validation and DB reads is trivial.
  - 9 tables: `users`, `organizations`, `workspaces`, `role_assignments`,
    `projects`, `tasks`, `generation_runs`, `artifacts`, `audit_log`
  - 12 Postgres enums (one per Zod `.enum` shape)
  - 19 indexes covering the common lookups, composite uniques, and FK-backed queries
  - FK constraints for all parent→child edges except polymorphic ones
- **`db` client** — (TODO) The configured Drizzle database client. Will be added
  in Phase 1.6 once the schema is proven with the first migration.
- **Migrations** — The `drizzle/` directory holds generated migration files.
  The first migration (`0000_great_sunspot.sql`) creates all 12 enums, 9 tables,
  21 FK constraints, and 19 indexes. Run `pnpm db:migrate:generate` to create a
  new migration from schema changes, and `pnpm db:migrate` to apply pending
  migrations to Postgres.

## Design decisions

- **camelCase DB columns** — Both the TypeScript key and the Postgres column name
  use camelCase (e.g. `workspaceId`, `createdAt`). This keeps the Drizzle ↔ Zod
  mapping 1:1 with no `mapFromView` transforms. See ADR-0004 for the full
  rationale.
- **`text()` over `uuid()` for IDs** — UUIDs are generated client-side as strings
  matching `z.string().uuid()`. Using `text()` keeps the column portable and
  aligned with the Zod contract.
- **JSONB for structured data** — `snapshot` (generation runs), `before`/`after`/
  `metadata` (audit log) are stored as `jsonb` columns. The TS types are inferred
  from the corresponding Zod schemas.
- **Enums as Postgres enums** — All Zod enum types (status fields, role names,
  artifact kinds, etc.) are defined as `pgEnum` and used via `.enum()` columns.

## References

- ADR-0004: Database choice (Neon serverless vs. local Postgres + ORM)
- ADR-0001: Monorepo and package boundaries
- `packages/core-types/src/schemas/` — Zod source of truth
- `buildplan.md` — Phase 1 exit criteria
