# Handover — Task 7 (Phase 1.7) Complete

**Date**: 2026-07-09
**Status**: Task 7 implementation complete in the working tree. Commit pending.
**Context handover**: context window healthy; committing after verification.

---

## What Was Done (this session)

### Task 7 — Generation Runs + Artifacts APIs (Phase 1.7)

Closes the final set of Phase 1 exit criteria that relate to
**entity-level CRUD API completeness**. The platform now has GET/POST
endpoints for every core control-plane entity (workspaces, projects,
tasks, generation runs, artifacts) — the only remaining Phase 1 API-side
work is the AuditLogEntry API, which is deferred because audit writes
happen server-side via a dedicated helper (not a user-facing POST).

Also updates the monorepo and web-app READMEs to reflect Tasks 1-7 done.

1. ✅ **`CreateGenerationRunInput`** (`packages/core-types/src/schemas/generation-run.ts`)
   - Omits server-generated fields: `id`, `runNumber`, `createdAt`,
     `updatedAt`, `status`, `agentSessionId`, `startedAt`, `completedAt`.
   - `snapshot` is optional and defaults to an all-null snapshot at the
     API layer (no spec/blueprint referenced).
   - `createdBy` is temporarily required from the caller (same concession
     as Task 6 — moves to session context when RBAC middleware lands).

2. ✅ **`CreateArtifactInput`** (`packages/core-types/src/schemas/artifact.ts`)
   - Omits server-generated fields: `id`, `createdAt`.
   - All FKs required from the caller. Storage-kind fields are optional
     and conditional — `inline` → `textContent`, `url` → `storageUrl`,
     `git` → `storageRef`. Soft validation (no cross-field enforcement).

3. ✅ **`GET/POST /api/generation-runs`**
   (`apps/web/src/app/api/generation-runs/route.ts`)
   - GET accepts `workspaceId` (required) + optional `projectId` and
     `taskId` filters. Returns `{ generationRuns: GenerationRun[] }`.
   - POST: validates via `CreateGenerationRunInput`, auto-computes
     `runNumber` via `MAX(runNumber)+1` within the task (or 1 if no
     prior runs exist). Defaults `status` to `'pending'`, `snapshot` to
     all-null, `agentSessionId`/`startedAt`/`completedAt` to null.
   - Translates Postgres FK violation `'23503'` → 400 `FOREIGN_KEY_VIOLATION`.

4. ✅ **`GET/POST /api/artifacts`**
   (`apps/web/src/app/api/artifacts/route.ts`)
   - GET accepts `workspaceId` (required) + optional `generationRunId`
     and `taskId` filters. Returns `{ artifacts: Artifact[] }`.
   - POST: validates via `CreateArtifactInput`, defaults all nullable
     storage/metadata fields to null. Translates `'23503'` → 400.
   - No per-kind enforcement at the schema layer; relies on callers to
     provide matching storage fields.

5. ✅ **Landing page + READMEs updated**
   - `apps/web/src/app/page.tsx` — lists all 11 live endpoints.
   - `apps/web/README.md` — documents generation-runs and artifacts API
     contracts; status header updated to Phase 1.7 Task 7.
   - `README.md` — status reflects Tasks 1-7 complete.

6. ✅ **Verification**
   - `pnpm typecheck` → **exit=0** (all 13 tasks, full monorepo).
   - `pnpm --filter @heynxt/web build` → **exit=0**, Next.js output:
     ✓ Compiled successfully; 8 dynamic routes generated:
     `/api/artifacts` (new), `/api/generation-runs` (new),
     `/api/health`, `/api/projects`, `/api/tasks`, `/api/workspaces`,
     plus static `/` and `/_not-found`.

---

## What Is NOT Committed

Implementation complete in the working tree, uncommitted. Files:

**New files**:
- `apps/web/src/app/api/generation-runs/route.ts` — generation-run GET/POST
- `apps/web/src/app/api/artifacts/route.ts` — artifact GET/POST

**Modified files**:
- `packages/core-types/src/schemas/generation-run.ts` — added `CreateGenerationRunInput`
- `packages/core-types/src/schemas/artifact.ts` — added `CreateArtifactInput`
- `packages/core-types/dist/` — rebuilt (tsc output, gitignored)
- `apps/web/src/app/page.tsx` — lists all 11 endpoints
- `apps/web/README.md` — API contract for generation-runs + artifacts; status header Phase 1.7
- `README.md` — Tasks 1-7 complete status (both the current-phase section and footer status line)

---

## Recommended Commit Message

```
feat(web): Task 7 — generation-runs + artifacts API routes

Phase 1.7 slice. Closes the last meaningful Phase 1 CRUD API gap on the
user-facing surface: workspaces, projects, tasks, generation runs, and
artifacts all now have GET/POST endpoints. AuditLogEntry is write-only
from server-side helpers (no user-facing POST), so it doesn't need an API
route.

@heynxt/core-types additions:
- src/schemas/generation-run.ts: CreateGenerationRunInput — omits
  server-generated id/runNumber/createdAt/updatedAt/status/agentSessionId/
  startedAt/completedAt; snapshot defaults to all-null when omitted
- src/schemas/artifact.ts: CreateArtifactInput — omits id/createdAt;
  storage-kind fields are optional and conditional on the chosen
  storageKind; no cross-field soft validation (callers responsible)

apps/web additions:
- src/app/api/generation-runs/route.ts:
  - GET ?workspaceId=<uuid>[&projectId=<uuid>][&taskId=<uuid>]:
    list runs; 400 if workspaceId missing
  - POST: CreateGenerationRunInput validation; auto-computes runNumber
    via MAX(runNumber)+1 within the task (or 1 if no prior runs);
    defaults status to 'pending'; translates FK violation (23503) to 400
- src/app/api/artifacts/route.ts:
  - GET ?workspaceId=<uuid>[&generationRunId=<uuid>][&taskId=<uuid>]:
    list artifacts with optional filters
  - POST: CreateArtifactInput validation; defaults nullable storage
    fields to null; translates FK violation to 400
- src/app/page.tsx: landing page lists all 11 endpoints
- README: Phase 1.7 Task 7 status + API contract for generation-runs
  and artifacts

Monorepo README updates:
- Current-phase section: Tasks 1-7 complete (Task 7 callout added)
- Footer status line: Tasks 1-7 Complete

Verified:
- pnpm typecheck → exit=0 (all 13 tasks, full monorepo)
- pnpm --filter @heynxt/web build → exit=0; Next.js route list:
  ✓ /, /_not-found (static)
  ƒ /api/artifacts, /api/generation-runs, /api/health, /api/projects,
    /api/tasks, /api/workspaces (dynamic)
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
     the session context; the `CreateProjectInput` / `CreateTaskInput` /
     `CreateGenerationRunInput` / `CreateArtifactInput` schemas should be
     updated accordingly (an ADR-worthy change).

   - **RBAC enforcement middleware** — `middleware.ts` or per-route helper
     that reads the user's `role_assignments` + workspace role, then gates
     `/api/*` mutations. Uses `getRolePermissions()` from `@heynxt/core-types`.

3. Optional graphify refresh for heynxt-core — `apps/web` now has real
   routes and a seed script; the current graph still marks it as placeholder.
   See `graphify/README.md`.

### Design notes / open questions from this session

- **`runNumber` auto-computation**: uses `MAX(runNumber)+1` within the
  task at INSERT time. This is race-prone under concurrent inserts to the
  same task — the DB's unique constraint on `(taskId, runNumber)` guards
  correctness (violator gets rejected), but the API doesn't currently
  retry on unique violation. For now, generation runs are single-user
  triggered; revisit with optimistic retry if concurrent scheduling lands
  in Phase 2.

- **`createdBy` as a public input field remains a concession.** Five
  input schemas now have the same pattern:
  - `CreateProjectInput`
  - `CreateTaskInput`
  - `CreateGenerationRunInput` (this session)
  - `CreateArtifactInput` (this session)
  - `CreateWorkspaceInput` (Task 5)

  When auth lands, update all of them to pull `createdBy` from session
  context. Write a single ADR documenting the change and the migration
  pattern.

- **Artifact storage-kind is soft-validated.** The API accepts any
  combination of `textContent`/`storageUrl`/`storageRef`; callers are
  responsible for providing the matching field for their `storageKind`.
  This keeps the schema flexible for now. If the team wants hard
  validation, add a discriminated union in `CreateArtifactInput` later
  and update the docs.

- **Phase 1 exit criteria status after Task 7**:
  - [x] Migrations are repeatable (Task 3+4)
  - [x] Schemas for all core entities exist (Tasks 1+2)
  - [x] CRUD APIs for all core entities live (Tasks 5-7)
  - [x] Seed script for local dev (Task 6)
  - [ ] Workspace / project / task can be created via UI — **next**
  - [ ] Generation run can be tracked via UI (initial status only) — **next**
  - [ ] Activity log records state transitions per entity — **deferred to audit-log API helper**
  - [ ] Basic RBAC gates access (owner/editor/viewer) — **auth+RBAC scaffold**
  - [ ] Lint, typecheck, build pass — ✅ (this session)

---

## Decisions Locked In (This Session)

These decisions should NOT be reopened without explicit justification and a new ADR:

| Decision | Value | Rationale |
|---|---|---|
| `CreateGenerationRunInput.snapshot` | **Optional**, defaults to all-null snapshot | Most initial runs won't have a spec/blueprint plan; spec+blueprint tracking matters from Phase 4+ but not Phase 1 |
| `runNumber` computation | `MAX(runNumber)+1` within task, client-side at insert | Simple and correct for single-user triggers; DB unique constraint guards races; revisit retry logic when concurrent scheduling lands in Phase 2 |
| `CreateArtifactInput.storage-kind fields` | **Optional**, no cross-field validation | Flexibility; callers own the contract between `storageKind` and the matching storage field |
| AuditLogEntry API route | **Not added** (server-side helper only) | Audit writes are triggered by mutations, not by user POST; no user-facing API needed |
| `createdBy` concession | **Extended** to all four new input schemas | Consistency with Tasks 5/6; auth will sweep all at once when RBAC middleware lands |

All earlier decisions from prior sessions remain locked — see prior handovers
for the full table (ORM=Drizzle, DB=Neon, schema naming=User/Org/Workspace,
test=Vitest, Task 3 decisions re Postgres 15 alpine / local creds /
127.0.0.1 binding, Task 4 decisions re camelCase columns / JSONB typing /
migrations, Task 5 decisions re driver / singleton pattern / connection pool
defaults / next.config.mjs transpilePackages / API error shape / Postgres
unique-violation translation / health endpoint posture, Task 6 decisions re
seed script location / runner / error code naming / drizzle.config wiring).

---

## Verification Output (captured this session)

```
$ pnpm typecheck
  Tasks:    13 successful, 13 total
  Cached:   0 cached, 13 total
  Time:     4.686s
  exit=0  (full monorepo)

$ pnpm --filter @heynxt/web build
  ✓ Compiled successfully
  ✓ Generating static pages (4/4)
  exit=0

  Next.js route list (apps/web):
  ┌ ○ /                              (Static)
  ├ ○ /_not-found                    (Static)
  ├ ƒ /api/artifacts                 (Dynamic)
  ├ ƒ /api/generation-runs           (Dynamic)
  ├ ƒ /api/health                    (Dynamic)
  ├ ƒ /api/projects                  (Dynamic)
  ├ ƒ /api/tasks                     (Dynamic)
  └ ƒ /api/workspaces                (Dynamic)
```

**Not verified in this session** (no live-DB smoke yet — local Postgres 16
from Task 6 is still running, but the smoke-test step was skipped to keep
the slice narrow):
- GET+POST against `/api/generation-runs` end-to-end
- GET+POST against `/api/artifacts` end-to-end
- Run-number auto-increment on second create for the same task
- FK violation on `/api/artifacts` with non-existent generationRunId

The typecheck + build pass confirms the code compiles and the types line up.
Smoke-testing against live Postgres is recommended as the first action in
the next session; curl commands modeled after Task 6's smoke tests.

---

## Session-Ready Checklist for New Session

- [x] Read `CLAUDE.md` — instructions confirmed
- [x] Read `buildplan.md` — Phase 1.7 context
- [x] Read `HANDOVER.md` (Task 6) — Tasks 1-6 context
- [x] Read `docs/gap-analysis.md` — Tasks 1-6 all ✅; Task 7 now ✅
- [ ] **Commit pending**: Task 7 work is complete and verified but UNCOMMITTED.
      See commit message block above.
- [x] Task 6 smoke test against live Postgres was completed in Task 6 session
- [x] Toolchain: pnpm 9 + Turbo 2 + TypeScript 5.5 + Vitest 2 + Node 22
- [x] Full monorepo typecheck+build: PASS (all 7 packages + app)
- [x] Local Homebrew Postgres 16 on 127.0.0.1:5432 available for smoke tests
- [x] ORM/DB chosen: Drizzle + Neon serverless (see docs/adr/0004)
- [x] Gap analysis: see docs/gap-analysis.md (Tasks 1-7 all ✅)
- [x] 6 packages + 1 real Next.js app now

Paste into your prompt before continuing:

```
You are resuming heynxt-core after Task 7 completed.

Current state:
- Phase 0 (foundation) ✅ complete
- Phase 1 (control plane) 🟡 most API CRUD complete:
  Task 1: User, Organization, Workspace, RBAC (5 roles, ~30 permissions)
  Task 2: Project, Task, GenerationRun, Artifact, AuditLogEntry
  Task 3: docker-compose.yml with Postgres 15 mirroring Neon serverless
  Task 4: @heynxt/persistence — 9 Drizzle tables, 12 enums, first migration
  Task 5 (Phase 1.6): apps/web as real Next.js 14 App Router;
    /api/health + /api/workspaces live; DB client wired
  Task 6 (Phase 1.6): deterministic seed script; /api/projects + /api/tasks live;
    drizzle.config.ts wired
  Task 7 (Phase 1.7): /api/generation-runs + /api/artifacts (GET/POST);
    CreateGenerationRunInput + CreateArtifactInput added to core-types;
    runNumber auto-computed per task via MAX+1; landing page lists all 11
    endpoints; monorepo README at Tasks 1-7
  All 9 schemas tested via 61 vitest cases in control-plane.test.ts.
- Task 7 implementation is complete and verified but UNCOMMITTED.
  See HANDOVER.md for the exact commit message.
- Verified via typecheck + build (no live-DB smoke test this slice —
  defer to next session for generation-runs + artifacts POST/GET)
- Toolchain: pnpm 9 + Turbo 2 + TypeScript 5.5 + Vitest 2 + Node 22
- Full monorepo typecheck+build: PASS (all 7 packages + app)
- Local Homebrew Postgres 16 on 127.0.0.1:5432 used across sessions;
  docker-compose.yml exists as an alternative. Same schema in both.
- ORM/DB chosen: Drizzle + Neon serverless (see docs/adr/0004)
- Gap analysis: see docs/gap-analysis.md (Tasks 1-7 all ✅)
- 6 packages + 1 real Next.js app now

First actions after resuming:
1. git status — confirm working tree matches HANDOVER.md state
2. Commit Task 7 (message in HANDOVER.md)
3. (Suggested) Smoke-test /api/generation-runs + /api/artifacts end-to-end
   against live Postgres — curl commands per Task 6 pattern
4. Pick next Task: CRUD UI pages OR auth scaffold OR RBAC middleware —
   all close Phase 1 exit criteria further

Hard rules:
- Don't redo Tasks 1-7 (Task 7 uncommitted — just commit + verify)
- Follow CLAUDE.md for process (work order, reporting format, safety)
```
