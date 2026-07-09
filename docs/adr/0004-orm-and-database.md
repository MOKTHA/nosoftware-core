# ADR-0004: ORM and Database Choice for Control Plane

**Status**: Accepted
**Date**: 2026-07-09
**Deciders**: Architecture Team (pskbmohan)

## Context

HeyNXT Core needs persistence for control-plane entities (User, Organization, Workspace, Project, Task, Artifact, GenerationRun, approval records, audit log). Phase 1 requires a working database layer before any UI or domain work can land.

Two leading options were evaluated:
1. **Prisma + Postgres** (local or managed) — mature ORM, schema-first DSL, large ecosystem
2. **Drizzle ORM + Neon Serverless Postgres** — the pattern used by `vercel-labs/coding-agent-template`

## Decision

**Adopt Drizzle ORM + Neon Serverless Postgres.**

## Rationale

1. **Pattern continuity with the agent substrate reference.** Hard rule #1 forbids rebuilding what the Vercel coding-agent template already provides. The Vercel template defines 7 tables (`users`, `tasks`, `connectors`, `accounts`, `keys`, `taskMessages`, `settings`) in `lib/db/schema.ts` using Drizzle. Adopting Drizzle in heynxt-core lets our control-plane tables map 1:1 to Vercel's shape, dramatically reducing the Phase 2 agent-adapter integration cost.

2. **TypeScript-native, schema-in-code.** Drizzle schemas are plain TS objects. This matches the repo's strict TypeScript stance and composes naturally with Zod schemas already declared in `@heynxt/core-types`. We can derive runtime validation shapes from TS types and generate migrations from the same schema.

3. **Lightweight migration footprint.** Drizzle-kit migrations live in `packages/*/drizzle/` or a top-level `migrations/` directory. Same mental model as the Vercel template's 21 numbered snapshots (`lib/db/migrations/`).

4. **Neon serverless fits the Next.js UI deployment target.** Control plane UI will be Next.js (see `apps/web`). Neon serverless Postgres is the natural Postgres pair — HTTP-based, branchable, fits Vercel deployment, free tier available.

5. **Edge-friendly.** Drizzle doesn't depend on Node-only primitives. Compatible with serverless and Workers-style runtimes as the platform scales.

## Considered Alternatives

### Prisma + Postgres

**Pros**:
- More mature; larger community; richer docs
- Prisma Studio for visual data exploration
- Generated client with excellent TypeScript inference
- Battle-tested at scale

**Cons**:
- Different paradigm than Vercel template — creates a seam when integrating Phase 2 agent-adapter
- Prisma migration format is not Drizzle-compatible; migrations would diverge
- Heavier runtime; cold-start penalty in serverless
- `prisma generate` step creates code-generation dependency that Drizzle doesn't require for most use cases

**Verdict**: rejected. The cognitive and mechanical mismatch with the Vercel template pattern outweighs Prisma's ecosystem maturity for this repo.

### Plain SQL (pg/postgres.js + manual queries)

**Pros**: minimal dependencies, no abstraction tax

**Cons**: no type safety, no migration management, manual schema drift tracking, high maintenance cost

**Verdict**: rejected. Not worth the maintenance cost for a platform with 10+ entity tables planned.

### SQLite / Turso for local dev

**Pros**: zero-setup for local dev and tests

**Cons**: different query engine than production Postgres; can mask SQL dialect bugs; not suitable as the primary persistence layer

**Verdict**: rejected as primary, but can be adopted later for local vitest fixtures if needed.

## Consequences

### Positive
- Phase 2 agent-adapter can map directly to Vercel template patterns
- Schema-as-code aligns with Zod-first contract approach
- No code-generation step required beyond migrations
- Neon serverless integrates cleanly with Next.js API routes

### Negative
- Neon has a cold-start cost (mitigated by HTTP-based connect vs. TCP)
- Drizzle's docs are lighter than Prisma's (mitigated: Vercel template serves as working reference)
- Drizzle + Neon means production depends on two Vercel-ecosystem services; mitigated by keeping the abstraction boundary tight (`packages/persistence` owns all Drizzle code, making provider swap possible if needed)

### Neutral
- Local development requires a local Postgres mirroring Neon. **Landed in Task 3**: `docker-compose.yml` runs `postgres:15-alpine` with credentials `heynxt/heynxt/heynxt` on `127.0.0.1:5432`, matching Neon's default Postgres 15 major version. See `docs/dev-setup.md`.

## Implementation status (as of 2026-07-09)

### Task 4 — Drizzle persistence layer (this session)

- Added `packages/persistence` with `drizzle-orm ^0.33`, `postgres ^3.4`, and `drizzle-kit ^0.24`
- Defined `pgTable` definitions 1:1 with the Zod schemas in `@heynxt/core-types`:
  - 9 tables: `users`, `organizations`, `workspaces`, `role_assignments`, `projects`, `tasks`, `generation_runs`, `artifacts`, `audit_log`
  - 12 Postgres enums (one per Zod `.enum` shape)
  - camelCase column names (matches Zod field names 1:1, no `mapFromView`)
  - `text()` for UUIDs (client-generated via Zod), `timestamp({ mode: 'date' })` for dates
  - JSONB for `snapshot` on `generation_runs` and `before`/`after`/`metadata` on `audit_log`, typed via Drizzle's `$type<T>()`
  - 19 indexes (scoped queries, lookup-by-fk, composite unique on `workspaces(organizationId, slug)`, `projects(workspaceId, slug)`, `generation_runs(taskId, runNumber)`)
  - FK constraints added for all parent→child edges except polymorphic ones (`audit_log.entityId`, `audit_log.actorId` which can be 'system')
  - `role_assignments` uses composite UNIQUE constraint (not PRIMARY KEY) because the natural key contains a nullable `workspaceId`; see the table's docstring for the NULL-equality caveat
- `drizzle.config.ts` points at the compiled `dist/schema/index.js` (drizzle-kit resolves via CJS and cannot load ESM `.js` imports from `.ts` source directly); `db:migrate:generate` runs `pnpm build` as a prerequisite
- First migration: `drizzle/0000_great_sunspot.sql` (12 CREATE TYPE, 9 CREATE TABLE, 21 ALTER TABLE FK, 19 CREATE INDEX)
- **Deferred to Phase 1.6**: `db` client wired into `apps/web` API routes

### Decisions locked in (Task 4)

| Decision | Value | Rationale |
|---|---|---|
| Package location | `packages/persistence` | `@heynxt/core-types` is the leaf package (CLAUDE.md hard rule — acyclic deps); adding Drizzle deps there breaks the contract |
| Column casing | camelCase (DB + TS) | 1:1 mapping with Zod field names; no transform layer |
| ID column type | `text()`, not `uuid()` | IDs are client-generated `z.string().uuid()`; matches Zod contract, avoids DB-generated UUID |
| Timestamp mode | `{ mode: 'date' }` | Returns JS `Date` objects, matches `z.coerce.date()` |
| Migration output | `drizzle/` in `packages/persistence` | Single-source-of-truth migrations tied to schema source |
| Migration script chain | `pnpm build && drizzle-kit generate` | drizzle-kit needs compiled `.js` output |

## Follow-ups (all landed)

- ✅ Task 3: `docker-compose.yml` with Postgres 15
- ✅ Task 4: `packages/persistence` with Drizzle table definitions + first migration
- Phase 1.6 (pending): wire `db` client into `apps/web` API routes

## References

- Vercel template schema: `https://github.com/vercel-labs/coding-agent-template` → `lib/db/schema.ts`
- Drizzle ORM docs: `https://orm.drizzle.team`
- Neon docs: `https://neon.tech/docs`
- Heystack graphify report: `graphify/coding-agent-template/GRAPH_REPORT.md`
