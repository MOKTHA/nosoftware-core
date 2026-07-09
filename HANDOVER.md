# Handover — Phase 1 UI Consolidation Complete (Tasks 9–13)

**Date**: 2026-07-09
**Status**: Tasks 9–13 complete. Commit pending.
**Context handover**: healthy. All 3 CRUD pages live + smoke tested; ADR-0007 documents pattern.

---

## What Was Done (this session)

User asked to "spawn agents for all subtasks" from the Phase 1 UI worklist.
Five tasks were executed in four phases, all with concrete evidence.

### Task 9 — `/projects` CRUD page

**COMPLETE.**

- Created `apps/web/src/app/projects/page.tsx` — RSC list page.
- Created `apps/web/src/app/components/CreateProjectForm.tsx` — client form.
- Pattern mirrors `/workspaces` page exactly: RSC reads from DB via drizzle,
  Zod-validates rows through `Project.parse()`, renders `<table>` with Name,
  Slug, Status (badge), Description, Created By, Updated columns. Form uses
  `fetch + router.refresh()` per ADR-0005.
- Soft-redirects missing `workspaceId` to seed workspace
  `00000000-0000-0000-0000-000000000100`. Invalid UUID shows inline error.
- Seed IDs used: `SEED_WS_DEFAULT_ID`, `SEED_USER_ID` from seed.ts.

### Task 10 — `/tasks` CRUD page

**COMPLETE.**

- Created `apps/web/src/app/tasks/page.tsx` — RSC list page.
- Created `apps/web/src/app/components/CreateTaskForm.tsx` — client form.
- Two-query approach for project names: fetch tasks, collect unique
  `projectId`s, fetch matching projects, build `Map<projectId, name>`.
- Status badges: draft/queued/running/succeeded/failed/cancelled with
  distinct colour mapping.
- Form has `type` dropdown (`<select>` from `TaskType.options`) and
  textarea fields (`description`, `inputPrompt`) spanning 2 grid columns.
- `projectId` is a free-text input (TODO noted in code — a future session
  could swap this for a dropdown keyed to real projects).
- Fixed a strict-null `Record<string, V>[string] → V | undefined` issue
  by extracting a typed `getStatusColor()` accessor.

### Task 11 — Navigation wiring + landing page

**COMPLETE.**

- `apps/web/src/app/layout.tsx`: added `Projects` and `Tasks` nav links
  alongside the existing `Workspaces` link.
- `apps/web/src/app/page.tsx`:
  - Top paragraph updated to reflect current state (CRUD pages now live).
  - "UI pages" section: added bullets for `/projects` and `/tasks`.
  - "Next" section: updated roadmap text.

### Task 12 — Smoke test suite (29 cases)

**COMPLETE — 29 of 29 PASS.**

Setup confirmed:
- Local Homebrew Postgres 16 on `127.0.0.1:5432` healthy.
- `apps/web/.env.local` exists with `DATABASE_URL`.
- Seed script re-applied (idempotent).
- Dev server `http://localhost:3000` live.

| Section | Cases | Result |
|---|---|---|
| WS (workspaces) | WS-1 … WS-11 | 11/11 PASS |
| PJ (projects) | PJ-1 … PJ-10 | 10/10 PASS |
| TK (tasks) | TK-1 … TK-8 | 8/8 PASS |
| **Total** | **29** | **29/29 PASS** |

Covered per section:
- `GET /api/*` happy path, missing parentId (400), invalid UUID (400).
- `POST /api/*` valid, missing required, duplicate slug.
- `GET /<page>` list render, missing parentId → 307 redirect, invalid UUID
  → inline error, form POST + follow-up GET (proves `router.refresh()`).
- Landing page `/` contains all 3 nav links.

Cleanup: 1 task row, 2 project rows, 1 workspace row deleted. DB returned
to seeded state. Transient WS-9 cold-start 500 → 307 on re-run noted;
Next.js dev cold start, no source change required.

### Task 13 — ADR-0007 Phase 1 UI consolidation

**COMPLETE.**

Created `docs/adr/0007-phase-1-ui-consolidation.md` (197 lines).

Documents the consolidated pattern across the 3 CRUD pages:
- 11 conventions locked down as rules (URL shape, redirect behaviour, form
  POST endpoint, error shape, `createdBy` concession, `force-dynamic`,
  `thStyle/tdStyle`, `inputStyle/errStyle`, Suspense scope, form reset
  behaviour).
- Costs: inline styles duplicated per page; no shared `<Table>` /
  `<CrudFormShell>` / `<StatusBadge>` components yet.
- Revisit triggers: 4th CRUD page arrives, theming/dark mode required,
  optimistic UI required, auth lands.
- Grounded in the actual files (all 11 conventions verified against the
  workspaces/projects/tasks page.tsx + form files).

---

## Verification

| Command | Result |
|---|---|
| `pnpm typecheck` | 13/13 PASS, cached, 1.059s |
| `pnpm --filter @heynxt/web build` | PASS — all 3 UI pages + 6 API routes wired |
| 29-case live smoke suite | 29/29 PASS |
| DB cleanup | 4 smoke rows deleted |

Build route inventory (`ƒ = dynamic`):
```
ƒ /api/artifacts          ƒ /api/generation-runs   ƒ /api/health
ƒ /api/projects           ƒ /api/tasks              ƒ /api/workspaces
ƒ /projects               ƒ /tasks                  ƒ /workspaces
```

---

## Files Changed (this session)

**New files (7):**
- `apps/web/src/app/projects/page.tsx`
- `apps/web/src/app/components/CreateProjectForm.tsx`
- `apps/web/src/app/tasks/page.tsx`
- `apps/web/src/app/components/CreateTaskForm.tsx`
- `docs/adr/0007-phase-1-ui-consolidation.md`

**Modified files (2):**
- `apps/web/src/app/layout.tsx` (+6 lines — nav links)
- `apps/web/src/app/page.tsx` (+17/-3 lines — landing page updates)

**Other (not committed):**
- `apps/web/.env.local` — copied from `.env.example` (gitignored)

---

## Recommended Commit Message

```
feat(web): Tasks 9-13 — /projects + /tasks CRUD pages, nav wiring, ADR-0007, smoke evidence

Task 9 (/projects CRUD page):
  Created apps/web/src/app/projects/page.tsx (RSC list + Suspense) and
  apps/web/src/app/components/CreateProjectForm.tsx (client form).
  Mirrors the /workspaces page pattern exactly: RSC reads from DB via
  drizzle, Zod-validates rows via Project.parse(), soft-redirects missing
  workspaceId to seed, shows inline error for invalid UUID, form uses
  fetch+router.refresh() per ADR-0005.

Task 10 (/tasks CRUD page):
  Created apps/web/src/app/tasks/page.tsx and
  apps/web/src/app/components/CreateTaskForm.tsx. Two-query approach for
  project names (task list → collect projectIds → fetch projects). Status
  badge colour mapping for 6 FSM states. TaskType enum drives the <select>
  dropdown. projectId is a free-text input with a TODO to replace with a
  project picker later. Fixed strict-null Record<string,V>[string] by
  extracting typed getStatusColor() accessor.

Task 11 (navigation + landing page):
  Added Projects and Tasks nav links to root layout. Updated landing page
  top paragraph, "UI pages" list (added /projects and /tasks bullets),
  and "Next" section roadmap.

Task 12 (live smoke suite):
  29 curl cases across /workspaces, /projects, /tasks (API + RSC pages +
  form flows + nav links). 29/29 PASS. Cleanup: 1 task, 2 projects,
  1 workspace deleted; DB returned to seeded state.

Task 13 (ADR-0007):
  docs/adr/0007-phase-1-ui-consolidation.md — documents the consolidated
  pattern across the 3 CRUD pages: 11 conventions locked down as rules,
  costs (inline style duplication, no shared Table/Form/Badge components
  yet), revisit triggers (4th page, theming, optimistic UI, auth sweep).
  Grounded in actual page files (all 11 conventions verified).

Verified:
  - pnpm typecheck → 13/13 PASS
  - pnpm --filter @heynxt/web build → PASS; routes wired:
      ƒ /api/{artifacts,generation-runs,health,projects,tasks,workspaces}
      ƒ /projects   ƒ /tasks   ƒ /workspaces
  - 29-case live smoke suite against Postgres 16 → 29/29 PASS
```

---

## What the Next Session Should Do

Phase 1 control-plane API CRUD surface is now fully UI'd:
- `/workspaces` + API — live, smoke tested, ADR-0005 + ADR-0006 documented
- `/projects` + API — live, smoke tested
- `/tasks` + API — live, smoke tested
- Pattern consolidated in ADR-0007
- 6 ADRs in docs/adr/ capture all key decisions (0001-0007)

Remaining Phase 1 items (per buildplan.md exit criteria):

1. **Auth scaffold** — NextAuth.js or `arctic` for GitHub OAuth. This is the
   biggest remaining gap; unlocks ADR-0006 (`createdBy` sweep plan).
2. **RBAC middleware** — `getRolePermissions()` from `@heynxt/core-types`.
   Gates API routes behind session-derived roles.
3. **`createdBy` sweep** — ADR-0006's 7-step plan; requires auth first. Do
   NOT start this until auth actually exists — it's one coordinated commit.
4. **Workspace switcher in layout** — currently users navigate by URL query.
   A dropdown reading session user's workspaces would be a quality-of-life.
5. **Project picker in CreateTaskForm** — free-text now; swap for a
   `<select>` keyed to workspace's projects.

Out of Phase 1 but noted for later:
- Server Actions migration (ADR-0005 revisit triggers not yet met)
- Shared `<DataTable>` / `<StatusBadge>` extraction (ADR-0007 revisit —
  only when 4th CRUD page arrives)
- Pagination on list pages (current seed data doesn't need it; real
  workloads will)
- Workspace-level breadcrumb nav (once project/task detail pages exist)

Order recommendation: **auth scaffold → RBAC middleware → createdBy sweep**
(sequential — each enables the next).

---

## Session-Ready Checklist

- [x] Read `CLAUDE.md` — Phase 0 audit context
- [x] Read `buildplan.md` — Phase 1 scope
- [x] Read `HANDOVER.md` (prior state — Task 8 + risk mitigations)
- [x] Read `docs/gap-analysis.md` — Tasks 1-8 all ✅
- [x] Tasks 9-13 COMPLETE — 3 CRUD pages + nav + ADR-0007
- [x] Smoke suite 29/29 PASS against live Postgres 16
- [x] Full typecheck + build: PASS
- [x] Dev server (`localhost:3000`) left RUNNING for next session's verification
- [x] Commit pending (recommended message above)
- [ ] `apps/web/.env.local` exists (gitignored) — do NOT commit
- [x] Toolchain: pnpm 9 + Turbo 2 + TypeScript 5.5 + Next.js 14 + Node 22
- [x] ORM/DB: Drizzle + local Postgres 16 (docs/adr/0004)
- [x] 6 ADRs: 0001-0007 (0004 ORM/DB, 0005 client form pattern, 0006 createdBy sweep, 0007 UI consolidation)

Paste into your prompt before continuing:

```
You are resuming heynxt-core after Phase 1 UI consolidation complete.

Current state:
- Phase 0 (foundation) ✅
- Phase 1 (control plane) 🟡 API + UI for 3 entities; auth + RBAC pending
  - Tasks 1-8: prior sessions (foundation → API CRUD → /workspaces page)
  - Tasks 9-13: this session (/projects + /tasks pages, nav wiring,
    ADR-0007 UI consolidation, 29-case live smoke suite — all PASS)
- Tasks 9-13 UNCOMMITTED (see commit message in HANDOVER.md).
- Toolchain: pnpm 9 + Turbo 2 + TS 5.5 + Next.js 14 + Node 22
- Full typecheck + build: PASS
- Local Postgres 16 on 127.0.0.1:5432 healthy; apps/web/.env.local in place.
- Dev server left RUNNING on localhost:3000.
- 7 ADRs (0001-0007) lock down all key decisions.

First actions next session:
1. Verify commit landed (this session's recommended message).
2. Pick next task:
   - Auth scaffold (biggest gap): NextAuth.js or arctic for GitHub OAuth
   - RBAC middleware after auth
   - createdBy sweep (ADR-0006) — single coordinated commit after auth
3. DO NOT start ADR-0006 sweep until auth actually exists.
4. DO NOT revisit ADR-0005 (Server Actions) until triggers are met.
5. DO NOT extract shared <DataTable>/<StatusBadge> until 4th CRUD page.

Hard rules (from CLAUDE.md):
- Follow CLAUDE.md work order + reporting format.
- Don't redo Tasks 1-13.
- Follow small-slice principle — auth scaffold is the next big slice.
```
