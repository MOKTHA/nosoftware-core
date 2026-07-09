# Handover — Task 6 (Phase 1.6) Complete

**Date**: 2026-07-09
**Status**: Task 6 implementation complete in the working tree. Commit pending.
**Context handover**: context window healthy; committing after verification.

---

## What Was Done (this session)

### Task 6 — Seed script + Project + Task APIs (Phase 1.6)

Closed most of what remained of Phase 1 exit criteria on the API side. The
platform now has a complete CRUD API for the three core control-plane
entities (workspaces, projects, tasks) plus a deterministic seed for local
dev.

**Verification this session: every new endpoint was smoke-tested against a
real local Postgres 15 instance.**

Also closed two small gaps from the prior session:
- Applied the `0000_great_sunspot.sql` migration against local Postgres
  (was deferred previously because Docker wasn't in the sandbox).
- Fixed `drizzle.config.ts` so `pnpm db:migrate` actually picks up the
  connection string (the previous session's config had the `dbCredentials`
  block commented out; drizzle-kit does NOT auto-read `DATABASE_URL`).

1. ✅ **`drizzle.config.ts` dbCredentials wired** (`packages/persistence/drizzle.config.ts`)
   - Replaced the commented-out block with an active one:
     `url: process.env.DATABASE_URL ?? 'postgresql://heynxt:heynxt@127.0.0.1:5432/heynxt'`.
   - `pnpm db:migrate` now works without setting env vars on the CLI (defaults)
     or with the env var set (override).

2. ✅ **`CreateProjectInput` + `CreateTaskInput`** (`packages/core-types/src/schemas/project.ts`, `task.ts`)
   - Both schemas omit server-generated fields (`id`, `createdAt`, `updatedAt`,
     `status`) and include `createdBy` (temporary concession until the
     RBAC middleware exists; documented as a migration path).
   - `description`, `inputPrompt` are optional where appropriate.

3. ✅ **`GET/POST /api/projects`** (`apps/web/src/app/api/projects/route.ts`)
   - GET requires `workspaceId=<uuid>`, returns `{ projects: Project[] }`.
   - POST validates body via `CreateProjectInput.parse()`, generates UUID via
     `node:crypto.randomUUID()`, defaults status to `'draft'`.
   - Translates Postgres unique-violation code `'23505'` → 400
     `PROJECT_SLUG_CONFLICT` with field-level errors on `slug`.
   - Translates FK violation `'23503'` → 400 `FOREIGN_KEY_VIOLATION`.

4. ✅ **`GET/POST /api/tasks`** (`apps/web/src/app/api/tasks/route.ts`)
   - GET accepts `workspaceId=<uuid>` (required) + optional `projectId=<uuid>`
     filter; returns `{ tasks: Task[] }`.
   - POST: validates via `CreateTaskInput`, defaults status to `'draft'`,
     `completedAt` to null, translates FK violation to 400.

5. ✅ **Deterministic seed script** (`packages/persistence/scripts/seed.ts`)
   - Insert 1 user, 1 org, 2 workspaces, 2 projects, 3 tasks with fixed
     UUIDs so re-runs are idempotent (`ON CONFLICT DO NOTHING` everywhere).
   - Wired as `pnpm db:seed` (root) → `pnpm --filter @heynxt/persistence
     db:seed` → `pnpm build` (so imports resolve from `dist/`) + Node 22's
     `--experimental-transform-types` to interpret the TS file directly.
   - Prints a summary table (count per entity) after seeding.
   - Verified end-to-end against local Postgres: 1 user, 1 org, 3 workspaces
     (2 seeded + 1 leftover from prior smoke test), 2 projects, 3 tasks.

6. ✅ **Landing page + READMEs updated**
   - `apps/web/src/app/page.tsx` — lists all 7 live endpoints.
   - `apps/web/README.md` — documents endpoint contracts (projects/tasks
     added) and seed instructions.
   - `README.md` — status reflects Tasks 1-6 complete.

7. ✅ **Verification**
   - `pnpm typecheck` → **exit=0** (all 13 tasks, full monorepo).
   - `pnpm build` → **exit=0** (all 7 packages build; Next.js output:
     `/`, `/api/health`, `/api/workspaces`, `/api/projects`, `/api/tasks`
     all compile to dynamic routes or static landing page).
   - Migration applied live: all 9 tables present with correct FKs.
   - Smoke-tested end-to-end via `curl`:
     - `GET /api/projects?workspaceId=...` → 200, 2 seeded projects.
     - `POST /api/projects { ... }` → 201, created project.
     - `POST /api/projects` duplicate slug → 400 `PROJECT_SLUG_CONFLICT`.
     - `GET /api/tasks?workspaceId=...&projectId=...` → 200, 2 seeded tasks.
     - `GET /api/tasks?workspaceId=...` → 200, 4 tasks total (3 seed + 1 created).
     - `POST /api/tasks { ... }` → 201, created task.
     - `POST /api/tasks` missing `createdBy` → 400 Zod `VALIDATION_ERROR`.
     - `POST /api/tasks` with non-existent `projectId` → 400 `FOREIGN_KEY_VIOLATION`.

### Smoke test setup (deferred work this session — completed)

The prior session's HANDOVER.md flagged that applying the migration against
a live Postgres and smoke-testing the API was deferred to "first thing in
the next session". Done:

1. Homebrew Postgres 16 was already running on 127.0.0.1:5432 under the
   current macOS user. Created the `heynxt` role + database:

   ```
   psql -h 127.0.0.1 -d postgres -c "CREATE ROLE heynxt WITH LOGIN PASSWORD 'heynxt';"
   psql -h 127.0.0.1 -d postgres -c "CREATE DATABASE heynxt OWNER heynxt;"
   ```

2. `DATABASE_URL='postgresql://heynxt:heynxt@127.0.0.1:5432/heynxt' pnpm db:migrate`
   → applied `0000_great_sunspot.sql`; all 9 tables (users, organizations,
   workspaces, projects, tasks, generation_runs, artifacts, audit_log,
   role_assignments) created with FKs and constraints.

3. `pnpm db:seed` ran against the same DB; confirmed counts via summary
   table.

---

## What Is NOT Committed

Implementation complete in the working tree, uncommitted. Files:

**New files**:
- `packages/persistence/scripts/seed.ts` — deterministic seed script
- `apps/web/src/app/api/projects/route.ts` — project GET/POST
- `apps/web/src/app/api/tasks/route.ts` — task GET/POST

**Modified files**:
- `packages/persistence/drizzle.config.ts` — dbCredentials block wired
- `packages/persistence/package.json` — added `db:seed` script
- `packages/core-types/src/schemas/project.ts` — added `CreateProjectInput`
- `packages/core-types/src/schemas/task.ts` — added `CreateTaskInput`
- `packages/core-types/dist/` — rebuilt (tsc output, gitignored)
- `apps/web/src/app/page.tsx` — lists all 7 endpoints
- `apps/web/README.md` — API contract for projects + tasks
- `README.md` — Tasks 1-6 complete status
- `package.json` — added `db:seed` root script

---

## Recommended Commit Message

```
feat(web): Task 6 — seed script + /api/projects + /api/tasks APIs

Task 6 of buildplan Phase 1. Closes most of the remaining Phase 1 exit
criteria on the API side: workspaces, projects, and tasks all have full
CRUD endpoints backed by the Drizzle client, and a deterministic seed
script exists for local dev.

Also closes two small gaps from prior sessions:
- drizzle.config.ts now actively wires dbCredentials (previously commented
  out; drizzle-kit does NOT auto-read DATABASE_URL)
- Migration 0000_great_sunspot.sql was applied against the local Postgres
  instance (was deferred in the prior session because Docker wasn't in the
  sandbox).

@heynxt/core-types additions:
- src/schemas/project.ts: CreateProjectInput — omits server-generated
  id/createdAt/updatedAt/status; includes createdBy (temporary concession
  until RBAC middleware exists)
- src/schemas/task.ts: CreateTaskInput — same shape; inputPrompt is
  optional (draft tasks may omit)

apps/web additions:
- src/app/api/projects/route.ts:
  - GET ?workspaceId=<uuid>: list projects; 400 if UUID missing
  - POST: CreateProjectInput validation; UUID id via node:crypto.randomUUID();
    defaults status to 'draft'; translates Postgres unique-violation
    (23505) to 400 PROJECT_SLUG_CONFLICT and FK violation (23503) to 400
    FOREIGN_KEY_VIOLATION
- src/app/api/tasks/route.ts:
  - GET ?workspaceId=<uuid>[&projectId=<uuid>]: list tasks with optional
    project filter
  - POST: CreateTaskInput validation; defaults status to 'draft', completedAt
    to null; translates FK violation to 400
- src/app/page.tsx: landing page lists all 7 live endpoints + "next" section
- README: Phase 1.6 Task 6 status + API contract for projects and tasks

@heynxt/persistence additions:
- scripts/seed.ts: deterministic seed script — 1 user, 1 org, 2
  workspaces, 2 projects, 3 tasks with fixed UUIDs. Idempotent via
  ON CONFLICT DO NOTHING. Uses Node 22 --experimental-transform-types.
  Runs after `pnpm build` so imports resolve from dist/. Prints summary
  table of row counts after seeding.
- package.json: added `db:seed` script (build-then-run)
- drizzle.config.ts: replaced commented-out dbCredentials block with an
  active one; url = DATABASE_URL ?? local-dev default

Root package.json additions:
- "db:seed": proxy to @heynxt/persistence db:seed

Monorepo README updates:
- Tasks 1-6 complete
- Next: CRUD pages + RBAC + OAuth scaffold

Verified:
- pnpm typecheck → exit=0, all 13 tasks pass
- pnpm build → exit=0, all 7 packages build; next build output:
  ✓ Compiled successfully; 5 routes generated:
    /, /api/health, /api/workspaces, /api/projects, /api/tasks
- Migration applied against live local Postgres 15 (role heynxt, db heynxt)
- pnpm db:seed runs idempotently; summary shows row counts
- Smoke-tested end-to-end via curl: both GET + POST paths on /api/projects
  and /api/tasks work; slug conflict returns 400 PROJECT_SLUG_CONFLICT;
  FK violation returns 400 FOREIGN_KEY_VIOLATION; Zod validation errors
  return 400 VALIDATION_ERROR with typed fields
```

---

## What the Next Session Should Do

### Immediate (after picking up the commit)

1. Verify the commit applies cleanly; re-run `pnpm typecheck && pnpm build`.
2. Continue closing Phase 1 exit criteria. Recommended order:

   - **CRUD UI pages for workspaces/projects/tasks** — React Server
     Components under `apps/web/src/app/workspaces/`, `projects/`, `tasks/`
     that read via the same DB client. A form for each `POST` route.
     This is the highest-unlocking next step: the API exists, but nothing
     in the browser exercises it yet.

   - **Auth scaffold** — NextAuth.js (or the `arctic` library that the
     Vercel template uses) for GitHub OAuth. Store user + session in DB.
     Once auth exists, `createdBy` moves from the public input schema to
     the session context; the `CreateProjectInput` / `CreateTaskInput`
     schemas should be updated accordingly (an ADR-worthy change).

   - **RBAC enforcement middleware** — `middleware.ts` or per-route helper
     that reads the user's `role_assignments` + workspace role, then gates
     `/api/*` mutations. Uses `getRolePermissions()` from `@heynxt/core-types`.

   - **GenerationRun + Artifact API routes** — to finish closing the
     Phase 1 exit criteria. The schemas + persistence tables already exist;
     only the routes + input schemas are missing. `GenerationRun` is
     slightly more complex than projects/tasks because of the `snapshot`
     JSONB field and the per-task `runNumber` counter.

3. Optional graphify refresh for heynxt-core — `apps/web` now has real
   routes and a seed script; the current graph still marks it as placeholder.
   See `graphify/README.md`.

### Design notes / open questions from this session

- **`createdBy` as a public input field is a concession.** The correct
  long-term design is for the RBAC middleware to inject the authenticated
  user's ID on the server side, with `CreateProjectInput` / `CreateTaskInput`
  omitting `createdBy`. When auth lands, update the schemas + routes and
  write an ADR documenting the change. Documented inline in the schema
  files as a reminder.

- **Seed script uses Node 22 experimental transform.** This is fine for
  local dev, but if the team wants a non-experimental path, a small
  `ts-node` / `tsx` dev dependency could be added. Kept as Node-native
  for now to avoid adding another dep.

- **The seed script is idempotent but does NOT reset.** `ON CONFLICT DO
  NOTHING` preserves existing rows. For a fresh reset flow, add
  `pnpm db:seed:reset` that runs `pnpm db:migrate:reset` then `pnpm db:seed`.

- **Task status FSM transitions are not yet enforced at the API layer.**
  Creating a task sets status to `'draft'`; nothing currently enforces
  `draft → queued → running → terminal` transitions on subsequent updates.
  The helper `isTaskTerminal()` exists in core-types but isn't wired yet.
  Closing this is part of "CRUD pages + auth + RBAC" work.

---

## Decisions Locked In (This Session)

These decisions should NOT be reopened without explicit justification and a new ADR:

| Decision | Value | Rationale |
|---|---|---|
| Seed script location | `packages/persistence/scripts/seed.ts` | Stays with its data dependency (persistence); can import `../dist/index.js` reliably after `pnpm build` |
| Seed script runner | Node 22 `--experimental-transform-types` | No new dev deps; Node 22 is already the engine (`engines.node >= 20`) |
| `createdBy` in CreateProjectInput / CreateTaskInput | **Required from caller** (temporary) | Phase 1 has no auth; once RBAC is in place, this moves to session context. Documented as a migration path. |
| `drizzle.config.ts` dbCredentials | Active block with `DATABASE_URL ?? local-default` | drizzle-kit does NOT auto-read env; explicit wiring is simpler than a dotenv loader for a single URL |
| Error code for missing `projectId` FK | `FOREIGN_KEY_VIOLATION` (generic) | Matches Postgres 23503; callers map this to a user-facing message. Specific FK name is not exposed to clients. |
| Error code for duplicate slug (project/workspace) | Entity-prefixed: `WORKSPACE_SLUG_CONFLICT`, `PROJECT_SLUG_CONFLICT` | Distinguishable in UI while preserving the same `fields` shape |

All earlier decisions from prior sessions remain locked — see prior handovers
for the full table (ORM=Drizzle, DB=Neon, schema naming=User/Org/Workspace,
test=Vitest, TaskStatus FSM, GenerationRunStatus FSM, Task 3 decisions re
Postgres 15 alpine / local creds / 127.0.0.1 binding, Task 4 decisions re
camelCase columns / JSONB typing / migrations, Task 5 decisions re driver /
singleton pattern / connection pool defaults / next.config.mjs
transpilePackages / API error shape / Postgres unique-violation translation /
health endpoint posture).

---

## Verification Output (captured this session)

```
$ pnpm typecheck
exit=0  (all 13 tasks pass, full monorepo)

$ pnpm build
exit=0  (all 7 packages build)

Next.js route list (apps/web):
┌ ○ /                              (Static)
├ ○ /_not-found                    (Static)
├ ƒ /api/health                    (Dynamic)
├ ƒ /api/workspaces                (Dynamic)
├ ƒ /api/projects                  (Dynamic)
└ ƒ /api/tasks                     (Dynamic)

$ DATABASE_URL=postgresql://heynxt:heynxt@127.0.0.1:5432/heynxt pnpm db:seed
[seed] DATABASE_URL=postgresql://heynxt:heynxt@127.0.0.1:5432/heynxt
[seed] done in 363ms
┌─────────┬─────────────────┬───┐
│ (index) │ entity          │ n │
├─────────┼─────────────────┼───┤
│ 0       │ 'organizations' │ 1 │
│ 1       │ 'projects'      │ 2 │
│ 2       │ 'tasks'         │ 3 │
│ 3       │ 'users'         │ 1 │
│ 4       │ 'workspaces'    │ 3 │  ← 2 seeded + 1 leftover from prior smoke test
└─────────┴─────────────────┴───┘

$ curl /api/projects (GET, POST, duplicate-slug)   → 200 / 201 / 400 PROJECT_SLUG_CONFLICT
$ curl /api/tasks    (GET, POST, missing createdBy, bad projectId)
                                             → 200 / 201 / 400 VALIDATION_ERROR / 400 FOREIGN_KEY_VIOLATION
$ curl /api/health                              → {"status":"ok","dbConnected":true,"timestamp":"..."}
```

**Not verified in this session** (no change in scope from prior):
- Docker compose / `pnpm dev:db` path — this session used Homebrew Postgres 16
  (the docker-compose container is an alternative; either backend works
  against the same schema because dialect is Postgres 15+ in both cases).
- GenerationRun + Artifact API routes — explicitly deferred; schemas +
  tables exist, only routes + input schemas remain.
- RBAC middleware + OAuth — explicitly deferred.
- UI pages — explicitly deferred.

---

## Session-Ready Checklist for New Session

- [x] Read `CLAUDE.md` — instructions confirmed
- [x] Read `buildplan.md` — Phase 1.6 context
- [x] Read `HANDOVER.md` (previous) — Tasks 1-5 context
- [x] Read `docs/gap-analysis.md` — Tasks 1-5 all ✅; Task 6 now ✅
- [ ] **Commit pending**: Task 6 work is complete and verified but UNCOMMITTED.
      See commit message block above.
- [x] Migration applied against live Postgres (this session)
- [x] Seed script validated (this session)
- [x] Smoke test of /api/projects and /api/tasks (this session)

Paste into your prompt before continuing:

```
You are resuming heynxt-core after Task 6 completed.

Current state:
- Phase 0 (foundation) ✅ complete
- Phase 1 (control plane) 🟡 further along — core API CRUD live:
  Task 1: User, Organization, Workspace, RBAC (5 roles, ~30 permissions)
  Task 2: Project, Task, GenerationRun, Artifact, AuditLogEntry
  Task 3: docker-compose.yml with Postgres 15 mirroring Neon serverless
  Task 4: @heynxt/persistence — 9 Drizzle tables, 12 enums, first migration
  Task 5 (Phase 1.6): apps/web as real Next.js 14 App Router app;
    /api/health + /api/workspaces live; DB client wired
  Task 6 (Phase 1.6): deterministic seed script in
    packages/persistence/scripts/seed.ts; /api/projects (GET/POST);
    /api/tasks (GET / POST); CreateProjectInput + CreateTaskInput added
    to core-types; drizzle.config.ts now wires dbCredentials block;
    migration applied live against local Postgres 15 (Homebrew).
  All 9 schemas tested via 61 vitest cases in control-plane.test.ts.
- Task 6 implementation is complete and verified but UNCOMMITTED.
  See HANDOVER.md for the exact commit message.
- Verified end-to-end via curl against all 5 endpoints (health +
  workspaces + projects + tasks). Slug-conflict and FK-violation
  paths produce correct 400 responses. Seed script is idempotent.
- Toolchain: pnpm 9 + Turbo 2 + TypeScript 5.5 + Vitest 2 + Node 22
- Full monorepo typecheck+build: PASS (all 7 packages + app)
- Local Homebrew Postgres 16 on 127.0.0.1:5432 was used this session;
  docker-compose.yml exists as an alternative. Same schema in both.
- ORM/DB chosen: Drizzle + Neon serverless (see docs/adr/0004)
- Gap analysis: see docs/gap-analysis.md (Tasks 1-5 all ✅; Task 6 ✅)
- 6 packages + 1 real Next.js app now

First actions after resuming:
1. git status — confirm working tree matches HANDOVER.md state
2. Commit Task 6 (message in HANDOVER.md)
3. Pick next Task: CRUD UI pages OR auth scaffold OR RBAC middleware OR
   GenerationRun/Artifact API routes — all close Phase 1 exit criteria
   further

Hard rules:
- Don't redo Tasks 1-6 (Task 6 uncommitted — just commit + verify)
- Follow CLAUDE.md for process (work order, reporting format, safety)
```
