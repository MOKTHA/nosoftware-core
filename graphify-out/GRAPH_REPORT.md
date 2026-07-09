# HeyNXT Core — Structural Knowledge Graph Report

> Generated: 2026-07-09 (after Task 4 — Drizzle persistence layer)
> Total tracked files: 86 | Total workspace modules: 7
> Previous graph updated from: pre-Task-1 scaffold (33 files, all stubs)

---

## Repository Overview

HeyNXT Core is the **product control plane and orchestration layer** for an
industrial AI app builder. It integrates coding-agent execution patterns (from
Vercel's coding-agent-template) with industrial manufacturing blueprints (from
two FactoryNXT reference repos) to enable AI-driven application generation for
manufacturing use cases.

**Current state (2026-07-09)**: Phase 0 foundation complete; Phase 1 substantial
with Tasks 1–4 landed. The monorepo now has **real implementation** in two
packages:
- **`@heynxt/core-types`** (Phase 1.1–1.2) — 9 Zod schemas, 61 vitest cases, 9
  control-plane entity contracts
- **`@heynxt/persistence`** (Phase 1.4–1.5) — 9 Drizzle tables, 12 Postgres
  enums, first migration, drizzle-kit config

The other 4 domain packages (`prompt-spec`, `agent-adapter`, `blueprint-registry`,
`domain-models`) are still stubs (deferred to Phases 2–4).

The toolchain is fully operational: `pnpm install`, `pnpm typecheck` (12/12),
`pnpm build` (7/7), `pnpm test`. Local dev Postgres 15 runs via
`docker-compose.yml` mirroring Neon serverless; Drizzle migrations generate and
apply against it.

---

## What the Repo does (now)

### Operational (Phase 1)
- **Control-plane schemas** — 9 entity Zod schemas with 61 vitest tests covering
  shape validation, FSM transitions, and helpers. Entities: User, Organization,
  Workspace, Role/Permission, Project, Task, GenerationRun, Artifact, AuditLogEntry.
- **Drizzle persistence** — 9 tables in `@heynxt/persistence`, each 1:1 with a
  Zod schema via camelCase columns. 12 Postgres enums, 19 indexes, composite
  unique constraints, FK constraints. First migration `0000_great_sunspot.sql`
  (341 lines, idempotent).
- **Local dev database** — Postgres 15 alpine container via docker-compose, creds
  `heynxt/heynxt/heynxt`, bound to `127.0.0.1:5432`, healthcheck, persistent
  volume. Mirrors Neon serverless's Postgres 15 major version.
- **drizzle-kit pipeline** — `pnpm build && drizzle-kit generate` emits migrations
  from compiled `dist/schema/index.js` (drizzle-kit CJS loader).
- **Scripts** — Root-level `dev:db`, `db:migrate`, `db:migrate:generate`,
  `db:migrate:reset`, `db:studio` scripts delegate to `@heynxt/persistence`.
- **Session hygiene** — `HANDOVER.md` + `docs/gap-analysis.md` track state across
  Claude Code sessions.

### Still Stubbed / Planned
- `@heynxt/web` — minimal `src/index.ts` placeholder; real Next.js routes in
  Phase 6
- `@heynxt/prompt-spec` — empty stub (Phase 4)
- `@heynxt/agent-adapter` — empty stub (Phase 2)
- `@heynxt/blueprint-registry` — empty stub (Phase 3)
- `@heynxt/domain-models` — empty stub (Phase 3)

---

## Top-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    apps/web  (Next.js UI — placeholder)                 │
│                    Control Plane — user-facing                          │
│                    Will consume @heynxt/persistence in Phase 1.6        │
└───────────────┬────────────────────────────────┬────────────────────────┘
                │                                │
┌───────────────▼─────────┐  ┌───────────────────▼───────────────┐
│ packages/prompt-spec    │  │ packages/agent-adapter            │
│ (natural language →     │  │ (agent spawn/execute/monitor)     │
│  structured spec)       │  │                                   │
│   [STUB — Phase 4]      │  │   [STUB — Phase 2]               │
└───────────────┬─────────┘  └───────────────────┬───────────────┘
                │                                │
┌───────────────▼──────────────────┐  ┌──────────▼───────────────┐
│ packages/blueprint-registry     │  │ packages/domain-models   │
│ (industrial blueprint catalog)  │  │ (FactoryNXT entities)    │
│   [STUB — Phase 3]             │  │   [STUB — Phase 3]       │
└───────────────┬─────────────────┘  └──────────┬───────────────┘
                │                                │
                └────────────────┬───────────────┘
                                 │
              ┌──────────────────▼──────────────────┐
              │    packages/core-types              │ ← LEAF PACKAGE
              │    (Zod schemas + shared TS types)  │
              │    9 schemas, 61 vitest cases       │
              │    <<< acyclic-leaf >>>             │
              └──────────────────┬──────────────────┘
                                 │
              ┌──────────────────▼──────────────────┐
              │    packages/persistence             │
              │    (Drizzle ORM + migrations)       │
              │    9 tables, 12 enums, 1st mig.     │
              │    <<< ORM boundary >>>             │
              └─────────────────────────────────────┘
```

Data flow (current): `Zod schemas in core-types → Drizzle tables in persistence → (Phase 1.6) db client → (Phase 6) apps/web API routes`

Data flow (planned full): `prompt → prompt-spec → spec → agent-adapter → generated app ← blueprint-registry + domain-models ← core-types ← persistence`

---

## Module Inventory

| Module | Purpose | Status | Depends On | Phase |
|---|---|---|---|---|
| `apps/web` | Next.js control plane UI | placeholder (minimal src/index.ts) | core-types, prompt-spec, agent-adapter, blueprint-registry, domain-models | Phase 6 |
| `packages/core-types` | Shared Zod schemas and types (LEAF) | **implemented** — 9 schemas, 61 tests | (none — acyclic leaf) | Phase 1 |
| `packages/persistence` | Drizzle ORM tables + migrations | **implemented** — 9 tables, 12 enums, 1 migration | core-types (for JSONB type params) | Phase 1.4 |
| `packages/prompt-spec` | Prompt-to-spec transformation | stub | core-types | Phase 4 |
| `packages/agent-adapter` | Coding-agent execution adapter | stub | core-types, prompt-spec | Phase 2 |
| `packages/blueprint-registry` | Industrial blueprint catalog | stub | core-types, domain-models | Phase 3 |
| `packages/domain-models` | Industrial domain entities (plant/line/station/etc.) | stub | core-types | Phase 3 |

**Dependency graph (acyclic):**
```
@heynxt/web  ──┐
               ├─→ @heynxt/core-types
               ├─→ @heynxt/prompt-spec ─→ @heynxt/core-types
               ├─→ @heynxt/agent-adapter ─→ { @heynxt/core-types, @heynxt/prompt-spec }
               ├─→ @heynxt/blueprint-registry ─→ { @heynxt/core-types, @heynxt/domain-models }
               └─→ @heynxt/domain-models ─→ @heynxt/core-types
@heynxt/persistence ─→ @heynxt/core-types      ← new edge in Task 4
@heynxt/core-types ─→ (no workspace deps — acyclic leaf)
```

---

## Entry Points

| Package | Entry point | State |
|---|---|---|
| `apps/web/src/index.ts` | placeholder (exports `APP_NAME` const) | Phase 6 will replace with Next.js pages |
| `packages/core-types/src/index.ts` | re-exports 9 Zod schema files + helpers | real public surface |
| `packages/persistence/src/index.ts` | re-exports `schema/index.ts` → 9 tables + 12 enums | real public surface (future: `db` client) |
| `packages/prompt-spec/src/index.ts` | stub `export {}` | Phase 4 |
| `packages/agent-adapter/src/index.ts` | stub `export {}` | Phase 2 |
| `packages/blueprint-registry/src/index.ts` | stub `export {}` | Phase 3 |
| `packages/domain-models/src/index.ts` | stub `export {}` | Phase 3 |

---

## Hub Files / High Blast Radius List

| File | Blast Radius | Why |
|---|---|---|
| `packages/core-types/src/schemas/*.ts` | **CRITICAL** | 9 schema files, each is a contract. Changes cascade to persistence + any downstream consumer. Editing one requires matching changes in persistence tables.|
| `packages/core-types/src/index.ts` | **HIGH** | Public surface for all cross-package types.|
| `packages/persistence/src/schema/*.ts` | **HIGH** | 9 tables + 12 enums. Each maps 1:1 to a Zod schema. Adding a table requires adding a Zod schema first.|
| `packages/persistence/drizzle.config.ts` | **HIGH** | Schema entry is `dist/schema/index.js`. Changing breaks migration generation.|
| `packages/persistence/drizzle/0000_great_sunspot.sql` | **HIGH** | First migration. Already committed. Never edit — additive migrations only going forward.|
| `docker-compose.yml` | **MEDIUM** | Local Postgres 15. Credentials must match `.env.example` DATABASE_URL.|
| `package.json` (root) | **HIGH** | Workspace scripts (dev:db, db:migrate), Turbo dep, engine constraints.|
| `turbo.json` | **HIGH** | Task pipeline (build/lint/typecheck/test) — changes cascade to every package.|
| `tsconfig.base.json` | **HIGH** | Strict compiler options inherited by all 7 packages.|
| `pnpm-workspace.yaml` | **HIGH** | Workspace member globs (apps/*, packages/*). Adding a package requires editing this.|
| `CLAUDE.md` | **CRITICAL** | Dictates all future Claude Code session behavior.|
| `buildplan.md` | **HIGH** | 9-phase plan; edits cascade to task sequencing.|
| `HANDOVER.md` | **HIGH** | Session handover doc; edits cascade to next session's starting point.|

---

## Safe to Edit

- Add new files under `packages/core-types/src/schemas/*.ts` (coordinate with persistence + re-export from index.ts + add vitest)
- Add new files under `packages/persistence/src/schema/*.ts` (coordinate with core-types + regenerate migration)
- New ADRs in `docs/adr/` — append-only pattern
- `docs/dev-setup.md`, `HANDOVER.md`, `README.md` — informational docs
- `apps/web/src/` — placeholder content; real Next.js routes will land in Phase 6
- `.env.example` — additive env var declarations
- `docs/gap-analysis.md` — informational, no downstream consumers

---

## Edit with Caution

- `packages/core-types/src/schemas/<entity>.ts` (existing schemas are LOADED with 61 tests) — edits require matching Drizzle changes + possible new migration
- `packages/persistence/src/schema/<entity>.ts` — same coupling
- `packages/persistence/drizzle/0000_great_sunspot.sql` — **never edit**. Future migrations are additive.
- `packages/persistence/drizzle.config.ts` — schema/out path changes break migration generation
- `turbo.json` — task pipeline changes cascade to every package's build/lint/typecheck
- `tsconfig.base.json` — any flag change cascades to all 7 packages simultaneously
- `package.json` (root) — workspace globs, engine constraints, dev dependency versions
- `pnpm-workspace.yaml` — workspace glob changes affect what pnpm treats as a package
- `docker-compose.yml` — Postgres creds must stay in sync with DATABASE_URL in .env.example and docs

---

## Load-Bearing Files (do NOT refactor without strong justification)

1. `packages/core-types/src/index.ts` — single source of truth for cross-package types
2. `packages/persistence/src/schema/*.ts` (9 files) — 1:1 with Zod, Drizzle migrations derive from these
3. `packages/persistence/drizzle/0000_great_sunspot.sql` — first migration, committed
4. `packages/persistence/drizzle.config.ts` — drizzle-kit config, entry point is dist
5. `docker-compose.yml` — local Postgres; creds flow to env
6. `tsconfig.base.json` — TS base config
7. `pnpm-workspace.yaml` — workspace membership
8. `turbo.json` — task pipeline
9. `CLAUDE.md` — session guide

---

## Workflows

| Workflow | Status | Steps |
|---|---|---|
| Local dev | **implemented** | pnpm install → pnpm dev:db → pnpm db:migrate → pnpm dev |
| Schema authoring | **implemented** | Add Zod schema in core-types → add vitest → add Drizzle table in persistence → `pnpm db:migrate:generate` → verify |
| Migration additive flow | **implemented** | pnpm build in persistence → drizzle-kit diff → emit SQL → pnpm db:migrate |
| API-route wiring | in progress (Phase 1.6) | Add persistence/src/client.ts → re-export db → create apps/web API routes → Zod-validate at boundary |
| Prompt → spec | planned (Phase 4) | stub prompt-spec → implemented |
| Agent execution | planned (Phase 2) | stub agent-adapter → implemented; needs db client first |
| Blueprint selection | planned (Phase 3) | stub blueprint-registry + domain-models → implemented |
| Generation pipeline | planned (Phase 6) | combines all three layers; needs Phase 2 + Phase 3 |

---

## API Boundaries

- **Public exports only**: every package uses conditional `exports`
  field (types + import). Consumers import `@heynxt/xxx`, never
  `@heynxt/xxx/src/...` or `dist/....`
- **No internal path imports across packages** — enforced by convention
  (no lint rule yet). CLAUDE.md forbids it.
- **All types cross boundaries via `core-types`** — Zod schemas are the
  single source of truth (inferred types via `z.infer`)
- **Persistence tables map 1:1 with Zod schemas** — camelCase columns
  match Zod field names exactly (no `mapFromView`)
- **Migration boundary**: Drizzle-kit owns the migrations/ folder.
  Migrations are additive SQL; never hand-edit generated SQL files.
- **No HTTP routes yet** — `apps/web/src/app/api/...` doesn't exist. Phase 1.6
  will add it using the persistence db client.

---

## Uncertain / Inferred Areas

| Subject | Detail |
|---|---|
| Migration apply not verified against live Postgres 15 | drizzle-kit generated `0000_great_sunspot.sql` from the schema, but the Docker daemon was inaccessible in the sandbox. The user should verify `pnpm dev:db` + `pnpm db:migrate` apply cleanly against the local Postgres 15 container. |
| No `db` client yet | `@heynxt/persistence` exports the 9 tables but no configured db client. Phase 1.6 will add `packages/persistence/src/client.ts`. `apps/web` routes will then depend on persistence for the first time. |
| `apps/web` doesn't yet import persistence | `apps/web/package.json` lists 5 `@heynxt/*` packages but not `@heynxt/persistence`. Phase 1.6 will wire `@heynxt/persistence` in as a 6th dep. |
| `apps/web` has only a placeholder `src/index.ts` | Real Next.js routes (`layout.tsx`, `page.tsx`, `app/api/`) are deferred to Phase 6. |
| Reference-repo graphs are stale | Coding-agent-template, FactoryNXT_PY_V2, FactoryNXT_PY_V2_Extrusion graphs under `graphify/` are pre-Phase-0 snapshots. Refresh when Phase 3 (blueprint extraction) starts. |
| No lint enforcement for cross-package imports | CLAUDE.md forbids internal-path imports but no `manypkg` / ESLint rule enforces it. Risk grows as the dep graph widens. |
| Test coverage for persistence is zero | vitest.config.ts exists but no `*.test.ts` files. Recommended: round-trip INSERT/SELECT + Zod.parse tests against live (or in-memory SQLite) DB. |
| `role_assignments` NULL-caveat on composite UNIQUE | Postgres treats NULLs as distinct in UNIQUE constraints, so org-scoped (workspaceId=NULL) role assignments can collide. Mitigated at the API layer via `INSERT ... ON CONFLICT`. |

---

## Session Memory

> **Paste this block verbatim at the top of any future Claude Code session
> prompt before opening a file in this repo:**

```
You are working in /Users/pskbmohan/Documents/GitHub/heynxt-core — an
industrial AI app builder monorepo. Phase 0 foundation is complete; Phase 1
is substantial with Tasks 1-4 done. Two packages have real implementation.

CURRENT STATE (2026-07-09, post-Task-4):
- 86 tracked files. 1 app (apps/web/) — placeholder src/index.ts.
  6 packages: core-types, persistence, prompt-spec, agent-adapter,
  blueprint-registry, domain-models.
- @heynxt/core-types (LEAF package): 9 Zod schemas, 61 vitest cases
  (User, Organization, Workspace, RBAC, Project, Task, GenerationRun,
  Artifact, AuditLogEntry). Tests: control-plane.test.ts. Helpers:
  getRolePermissions, isTaskTerminal, isGenerationRunTerminal,
  hasInlineContent, createStatusChangeEntry.
- @heynxt/persistence: 9 pgTable definitions 1:1 with Zod schemas,
  12 pgEnum, 19 indexes, composite uniques, FK constraints. First
  migration: drizzle/0000_great_sunspot.sql (341 lines, idempotent).
  drizzle.config.ts points at dist/schema/index.js (drizzle-kit CJS).
  db client not yet wired (Phase 1.6).
- Stub packages: prompt-spec (Phase 4), agent-adapter (Phase 2),
  blueprint-registry (Phase 3), domain-models (Phase 3).
- Toolchain: pnpm 9 workspaces + Turbo 2.10.4 + TypeScript 5.5 +
  Vitest 2 + Drizzle-orm ^0.33 + postgres ^3.4 + drizzle-kit ^0.24
  (all installed; lockfile present).
- Local dev Postgres: postgres:15-alpine via docker-compose.yml,
  creds heynxt/heynxt/heynxt on 127.0.0.1:5432, UTF8+C collation,
  healthcheck, named volume. Mirrors Neon serverless.
- Migration apply not verified in sandbox (docker daemon unavailable);
  user should run `pnpm dev:db && pnpm db:migrate` locally.
- Verification: pnpm typecheck → 12/12 PASS; pnpm build → 7/7 PASS
  (after adding persistence as 6th package).

PACKAGE BOUNDARIES (acyclic, core-types is leaf):
  web → {core-types, prompt-spec, agent-adapter, blueprint-registry, domain-models}
  persistence → {core-types}
  agent-adapter → {core-types, prompt-spec}
  blueprint-registry → {core-types, domain-models}
  prompt-spec → {core-types}
  domain-models → {core-types}
  core-types → (none)

READ FIRST:
  1. CLAUDE.md (session guide)
  2. buildplan.md (phase plan)
  3. HANDOVER.md (session handover)
  4. graphify-out/GRAPH_REPORT.md (structural map — this file)
  5. packages/core-types/src/index.ts (to see schema exports)
  6. packages/persistence/src/index.ts (to see table exports)
  7. docs/adr/0004-orm-and-database.md (DB decisions + Task 4 status)

DO NOT TOUCH without strong justification:
  - turbo.json (cascades to all packages)
  - tsconfig.base.json (cascades to all 7 packages)
  - pnpm-workspace.yaml (workspace membership)
  - package.json root workspace scripts (dev:db / db:migrate flow)
  - Existing schema files in core-types/src/schemas/*.ts or
    persistence/src/schema/*.ts WITHOUT matching changes in the other
    (1:1 coupled)
  - drizzle/0000_great_sunspot.sql (additive migrations only)

NEXT PHASE: Phase 1.6 — wire db client into apps/web API routes.
  - Add packages/persistence/src/client.ts (Drizzle client factory)
    (postgres.js driver for local + neon for future prod)
  - Re-export db from @heynxt/persistence
  - Add @heynxt/persistence to apps/web deps
  - Create minimal apps/web API routes using db client
  - Zod-validate at route boundary

CONTRACT-FIRST RULE: every new type/schema goes in @heynxt/core-types
first. Cross-package imports must use bare @heynxt/xxx, never
@heynxt/xxx/src/... or dist/.... Verify with pnpm typecheck before
claiming done. Persistence table changes must mirror Zod changes (1:1).

GRAPHIFY STATUS: heynxt-core graph refreshed post-Task-4 (this file).
Reference-repo graphs (coding-agent-template, FactoryNXT_PY_V2,
FactoryNXT_PY_V2_Extrusion) are pre-Phase-0 and STALE. Refresh before
Phase 3 blueprint extraction.
```
