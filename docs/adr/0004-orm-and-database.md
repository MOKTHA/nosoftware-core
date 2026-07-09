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
- Drizzle + Neon means production depends on two Vercel-ecosystem services; mitigated by keeping the abstraction boundary tight (a `packages/persistence` package or similar will hold all Drizzle queries, making provider swap possible if needed)

### Neutral
- Local development will require either a local Neon setup or a docker-compose Postgres for `DATABASE_URL`. To keep local dev friction low, we recommend a `docker-compose.yml` with Postgres 15 mirroring Neon's Postgres version, used via `pnpm dev:db`. Decision: **add `docker-compose.yml` with Postgres 15 in a follow-up task, Task 2**.

## Follow-ups

- Task 2 (planned): add `docker-compose.yml` for local Postgres dev to mirror Neon in CI/local
- Task 3 (planned): choose and configure test framework — Vitest with an in-memory or local-Postgres adapter for schema tests
- Task 4 (planned): implement control-plane DB tables corresponding to the schemas defined in this task (User, Organization, Workspace, Role)

## References

- Vercel template schema: `https://github.com/vercel-labs/coding-agent-template` → `lib/db/schema.ts`
- Drizzle ORM docs: `https://orm.drizzle.team`
- Neon docs: `https://neon.tech/docs`
- Heystack graphify report: `graphify/coding-agent-template/GRAPH_REPORT.md`
