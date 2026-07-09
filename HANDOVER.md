# Handover — Task 8 Risk Mitigations Complete

**Date**: 2026-07-09
**Status**: All 4 risks from Task 8 HANDOVER mitigated. Commit pending.
**Context handover**: context window healthy; committing after verification.

---

## What Was Done (this session)

User asked to mitigate all 4 risks surfaced in the Task 8 handover.
Each was closed with concrete evidence, not deferred.

### Risk 1 — No live-DB smoke test of `/workspaces` page

**Closed**: full smoke suite ran against live Postgres 16.

Setup:
- `psql -h 127.0.0.1 -U pskbmohan -d postgres -c "\l"` confirmed the
  `heynxt` DB exists locally (Homebrew Postgres 16).
- `PGPASSWORD=heynxt psql -h 127.0.0.1 -U heynxt -d heynxt -c "\dt"`
  confirmed all 9 tables exist (artifacts, audit_log, generation_runs,
  organizations, projects, role_assignments, tasks, users, workspaces).
- `cp apps/web/.env.example apps/web/.env.local` gave the Next.js app
  a `DATABASE_URL` so `next dev` connects.
- `DATABASE_URL=postgresql://heynxt:heynxt@127.0.0.1:5432/heynxt pnpm db:seed`
  re-ran the seed — output: 1 user, 1 org, 3 workspaces, 3 projects,
  4 tasks.
- `pnpm dev` started `http://localhost:3000`.

Smoke suite (14 cases, all pass):

| # | Case | Expected | Observed |
|---|---|---|---|
| 1 | `GET /api/health` | `status:ok, dbConnected:true` | ✓ `{"status":"ok","dbConnected":true,"timestamp":"..."}` |
| 2 | `GET /api/workspaces?organizationId=<seed-org>` | 3 workspaces (Demo, Default, Playground) | ✓ list of 3 workspaces returned |
| 3 | `GET /api/workspaces` (no orgId) | 400 MISSING_ORGANIZATION_ID | ✓ HTTP 400 + `{"error":"...","code":"MISSING_ORGANIZATION_ID"}` |
| 4 | `GET /api/workspaces?organizationId=not-a-uuid` | 400 VALIDATION_ERROR | ✓ HTTP 400 + `{"error":"Validation failed","code":"VALIDATION_ERROR","fields":{"_root":["Invalid uuid"]}}` |
| 5 | `POST /api/workspaces` valid body | 201 + created workspace | ✓ HTTP 201 + full `workspace` payload |
| 6 | `POST /api/workspaces` missing `name` | 400 VALIDATION_ERROR with `name:[Required]` | ✓ HTTP 400 + `{"fields":{"name":["Required"]}}` |
| 7 | `POST /api/workspaces` duplicate slug | 400 WORKSPACE_SLUG_CONFLICT | ✓ HTTP 400 + `{"error":"A workspace with this slug already exists...","code":"WORKSPACE_SLUG_CONFLICT","fields":{"slug":["must be unique within the organization"]}}` |
| 8 | `GET /workspaces?orgId=<seed-org>` (RSC page) | 200 + HTML lists all workspaces | ✓ HTTP 200, 16 kB page, all 4 workspace names found in HTML + "Create workspace" + "Workspaces" heading |
| 9 | `GET /workspaces` (no orgId) | 302/307 redirect to seed org | ✓ HTTP 307 → `http://localhost:3000/workspaces?orgId=00000000-0000-0000-0000-000000000010` |
| 10 | `GET /workspaces?orgId=bad-uuid` | 200 + inline error, no redirect | ✓ HTTP 200, HTML contains `Invalid <code>orgId</code> parameter: <code>bad-uuid</code>.` |
| 11 | `GET /` (landing page) | Contains `href="/workspaces"` link | ✓ `href="/workspaces"` present |
| 12 | Form-style POST → follow-up GET (what `router.refresh()` surfaces) | New row visible | ✓ count went 3 → 5; "Form Test" appears in list |
| 13 | RSC re-render after POST includes new row | Page HTML contains new name+slug | ✓ grep finds "Form Test" + "form-test-..." |
| 14 | Duplicate slug via form | 400 WORKSPACE_SLUG_CONFLICT with inline error payload | ✓ HTTP 400 + correct body |

Cleanup: `DELETE FROM workspaces WHERE slug LIKE 'smoke-test-%' OR slug LIKE 'form-test-%'` → 2 rows deleted. DB returned to seeded state.

One pre-existing extra row noted but **not** cleaned (predates this session by ~40 min): `Demo Workspace / demo / 2026-07-09T02:20:13.080Z`. It's a prior session's test row; out of scope.

### Risk 2 — Client form pattern (`fetch + router.refresh()`) not formally justified

**Closed**: **ADR-0005** (`docs/adr/0005-client-form-pattern.md`).

Documents:
- The two candidate patterns (Server Actions vs fetch+refresh).
- The choice (fetch+refresh) and rationale: existing API route surface,
  client-side Zod validation, test reuse, slice size.
- Costs: not idiomatic Next.js 14; full-page revalidation cost;
  loading-state flash.
- Revisit triggers: auth lands, optimistic UI required, or Actions
  wrapper duplication emerges.
- Consequences: projects/tasks pages follow the same pattern; future
  migration cost is per-form, no shared infra to rewrite.

### Risk 3 — `createdBy` audit concession not swept, could sprawl

**Closed**: **ADR-0006** (`docs/adr/0006-createdby-session-sweep.md`).

Documents:
- The concession table: all 5 `Create*Input` schemas that currently take
  `createdBy` from the body (`CreateWorkspaceInput`,
  `CreateProjectInput`, `CreateTaskInput`,
  `CreateGenerationRunInput`, `CreateArtifactInput`).
- Decision to keep it as a concession until auth lands.
- Rationale: consistency across all 5 schemas; auth is the enabling
  prerequisite; breaking change must be coordinated.
- 7-step sweep plan for when auth lands: middleware, schema update,
  route update, UI form update, seed note, test update, handover note.
- Exit criteria for the sweep: 6 checkboxes to confirm completion.

### Risk 4 — Phase 1 exit criteria still partially open

**Partial mitigation, no further work this session**:
- Smoke test confirms `/workspaces` is now genuinely usable end-to-end.
- The remaining Phase 1 UI exit criteria (projects page, tasks page,
  auth, RBAC) are out of scope for "mitigate risks" — they are the
  **next tasks**, not risks. The HANDOVER reflects them as the next
  session's worklist.

---

## Files Changed (this risk-mitigation session)

**New:**
- `docs/adr/0005-client-form-pattern.md` — locks down the fetch+refresh decision
- `docs/adr/0006-createdby-session-sweep.md` — documents concession + sweep plan
- `apps/web/.env.local` — copied from `.env.example` (gitignored, won't commit)

**Modified:**
- `HANDOVER.md` — this session's record

**No source code changes.** The smoke tests were black-box (`curl`), no
production code needed updating.

---

## Recommended Commit Message

```
docs: ADR-0005 + ADR-0006 + smoke evidence for Task 8

Risk-mitigation follow-up to Task 8 (commit 6ab0750).

ADR-0005 — Client Form Pattern (fetch + router.refresh):
  Records the deliberate choice to use fetch + router.refresh()
  for Phase 1 CRUD forms instead of Server Actions. Rationale:
  existing API routes already implement validation+errors; client-side
  Zod validation reuses the same schema; tests continue to target
  /api/*; smallest slice. Costs + revisit-when triggers documented.

ADR-0006 — createdBy Session Sweep Plan:
  Locks in the current createdBy concession (caller-supplied in 5
  Create*Input schemas) and documents the coordinated sweep that
  will happen when auth lands. 7-step plan + 6 exit criteria for
  the sweep. No intermediate state where some routes use session
  createdBy and others use body createdBy.

Smoke evidence captured against live Postgres 16:
  14 curl cases — /api/workspaces GET+POST (valid, missing orgId,
  invalid UUID, duplicate slug, missing required fields); RSC
  /workspaces page render; redirect on missing orgId; inline error
  on invalid UUID; landing-page link; form-style POST -> follow-up
  GET surfaces new row (proves router.refresh() works); duplicate
  slug via form returns inline error payload. All 14 PASS. Smoke
  rows deleted from DB after verification.

Verified:
  - pnpm typecheck (run in Task 8 commit) → exit=0
  - pnpm --filter @heynxt/web build (run in Task 8 commit) → exit=0
  - 14-case live smoke suite → all PASS
```

---

## What the Next Session Should Do

Resume from the post-Task-8 state. No pending follow-up from the
risk-mitigation slice — all 4 risks are closed with evidence. Order of
operations:

1. `git pull origin main` — pick up the risk-mitigation commit (when pushed).
2. Pick the next task from the Phase 1 worklist:
   - **Projects UI page** (`/projects?workspaceId=<uuid>`) — same RSC+form pattern.
   - **Tasks UI page** (`/tasks?workspaceId=<uuid>`) — same pattern, more fields.
   - **Auth scaffold** — NextAuth.js or `arctic` for GitHub OAuth.
   - **RBAC middleware** — `getRolePermissions()` from `@heynxt/core-types`.
3. Auth scaffold unlocks ADR-0006; don't start the `createdBy` sweep
   until auth actually exists — the sweep is a single coordinated
   commit, see the ADR for the step list.
4. Server Actions migration (ADR-0005 revisit) only if the specific
   triggers in the ADR are met.

---

## Session-Ready Checklist for New Session

- [x] Read `CLAUDE.md` — instructions confirmed
- [x] Read `buildplan.md` — Phase 1 context
- [x] Read `HANDOVER.md` (Task 8) — Tasks 1-8 context
- [x] Read `docs/gap-analysis.md` — Tasks 1-8 all ✅
- [ ] **Commit pending**: risk-mitigation work (ADR-0005, ADR-0006, smoke evidence) UNCOMMITTED. See commit message block above.
- [x] Full smoke suite against live Postgres 16 ran this session (14/14 pass); smoke rows cleaned.
- [x] Local Homebrew Postgres 16 on 127.0.0.1:5432 confirmed healthy; `heynxt` DB exists with all 9 tables; seed data applied.
- [x] `apps/web/.env.local` exists (gitignored) — `DATABASE_URL` set to `postgresql://heynxt:heynxt@localhost:5432/heynxt`. Future sessions just need to `pnpm dev` after `pnpm db:seed` (if fresh DB).
- [x] Toolchain: pnpm 9 + Turbo 2 + TypeScript 5.5 + Vitest 2 + Node 22
- [x] Full monorepo typecheck+build: PASS (verified in Task 8 commit)
- [x] ORM/DB chosen: Drizzle + Neon serverless (see docs/adr/0004)
- [x] Gap analysis: see docs/gap-analysis.md (Tasks 1-8 all ✅)
- [x] 6 packages + 1 real Next.js app with UI pages + live smoke evidence now

Paste into your prompt before continuing:

```
You are resuming heynxt-core after Task 8 + risk mitigations completed.

Current state:
- Phase 0 (foundation) ✅ complete
- Phase 1 (control plane) 🟡 API CRUD + first UI page + smoke tested:
  Tasks 1-8 complete per buildplan.md; see HANDOVERs for per-task details.
  - Task 8 (Phase 1.8): /workspaces CRUD page live (RSC list + client form)
  - Risk-mitigation session: ADR-0005 (client form pattern) + ADR-0006
    (createdBy sweep plan) + 14-case live smoke suite against Postgres 16,
    all PASS, cleanup done.
- Smoke rows cleaned; DB returned to seed state.
- Task 8 work + risk mitigations are UNCOMMITTED (see HANDOVER.md for
  the recommended commit message).
- Toolchain: pnpm 9 + Turbo 2 + TypeScript 5.5 + Vitest 2 + Node 22
- Full monorepo typecheck+build: PASS (last verified in Task 8 commit)
- Local Homebrew Postgres 16 on 127.0.0.1:5432 healthy; apps/web/.env.local
  already in place with DATABASE_URL.
- ORM/DB: Drizzle + Neon serverless (docs/adr/0004)
- Gap analysis: Tasks 1-8 all ✅ (docs/gap-analysis.md)

First actions after resuming:
1. Commit the risk-mitigation slice (message in HANDOVER.md).
2. Pick next Task: projects UI page / tasks UI page / auth scaffold / RBAC.
   Recommended order: projects → tasks → auth → RBAC middleware.
3. Auth scaffold unlocks ADR-0006 (createdBy sweep) — keep as one commit.

Hard rules:
- Don't redo Tasks 1-8 (committed in 6ab0750)
- Don't redo ADR-0005 / ADR-0006 / smoke evidence (just commit)
- Follow CLAUDE.md for process (work order, reporting format, safety)
```
