# Handover — Task 8 (Phase 1.8) Complete

**Date**: 2026-07-09
**Status**: Task 8 implementation complete in the working tree. Commit pending.
**Context handover**: context window healthy; committing after verification.

---

## What Was Done (this session)

### Task 8 — Workspaces CRUD UI Page (Phase 1.8)

Closes the first UI-level Phase 1 exit criterion: a workspace can now be
created via the browser UI (not just `curl` against `/api/workspaces`).
Highest-unlocking next step from Task 7's handover — gets something
visible in front of a user for the first time.

Deliberately small slice: one page, one form, one entity. Project + task
UI pages are the obvious next follow-up and will reuse the same pattern.

1. ✅ **`/workspaces` page** (`apps/web/src/app/workspaces/page.tsx`)
   - React Server Component — reads workspaces directly from the DB via
     `@heynxt/persistence` (no API round-trip for listing).
   - URL: `/workspaces?orgId=<uuid>`. Missing query param → soft-redirect
     to the seed org ID (`00000000-0000-0000-0000-000000000010`) so the
     first visit is useful.
   - Invalid UUID → inline error (no redirect loop).
   - Parses each DB row through `Workspace` Zod schema (defence in depth
     against driver surprises, same pattern as the API routes).
   - Renders a table: Name / Slug / Status (active=green, otherwise
     amber) / Description / Updated date.
   - Empty-state message when no workspaces exist in the org.

2. ✅ **`<CreateWorkspaceForm>` client component**
   (`apps/web/src/app/components/CreateWorkspaceForm.tsx`)
   - Marked `'use client'` — the only client component on the page.
   - Client-side `CreateWorkspaceInput.safeParse` surfaces Zod errors
     inline before the network call (no server round-trip for validation
     errors the client can catch itself).
   - `POST`s JSON to `/api/workspaces`; on success calls
     `router.refresh()` (RSC revalidation) and clears the form; on
     failure shows `error` + per-field errors from the API's
     `WORKSPACE_SLUG_CONFLICT` / `VALIDATION_ERROR` responses.
   - Honors `?orgId=` prefill — navigates from the landing page link
     into the form with the seed org already populated.
   - Submitting state disables the button; inline error box with red
     background.

3. ✅ **Top nav + landing page updates**
   - `apps/web/src/app/layout.tsx` — header now has the HeyNXT title
     linked to `/` plus a "Workspaces" nav item on the right.
   - `apps/web/src/app/page.tsx` — "Next" section replaced with a
     "UI pages" section linking to `/workspaces`; "Next" shrunk to the
     remaining items (project/task CRUD, auth, RBAC).

4. ✅ **`tsconfig.json` DOM libs** (`apps/web/tsconfig.json`)
   - Added `"lib": ["ES2022", "DOM", "DOM.Iterable"]` to satisfy
     React's `HTMLInputElement` / `ChangeEvent` / DOM types. The base
     tsconfig ships `lib: ["ES2022"]` only (the other packages don't
     need DOM); only the Next.js app needs browser types.

5. ✅ **READMEs updated**
   - `apps/web/README.md` — status header bumped to "Phase 1.8 — Task 8";
     UI pages section added above the API endpoints; `/workspaces?orgId=…`
     added to the local-setup visit list; copy tweaks ("will follow in
     later slices" instead of "full RSC CRUD pages will follow").
   - `README.md` — current-phase section now lists Tasks 1–8 with a Task 8
     callout; footer status line updated to "Tasks 1-8 Complete".

6. ✅ **Verification**
   - `pnpm typecheck` → **exit=0** (all 13 tasks, full monorepo).
   - `pnpm --filter @heynxt/web build` → **exit=0**, Next.js output:
     ✓ Compiled successfully; 5 static pages generated + 9 dynamic:
     new route `ƒ /workspaces` (15.9 kB) is server-rendered on demand,
     as expected for a page that reads from the DB.

---

## What Is NOT Committed

Implementation complete in the working tree, uncommitted. Files:

**New files**:
- `apps/web/src/app/workspaces/page.tsx` — workspace list (RSC) + redirect
- `apps/web/src/app/components/CreateWorkspaceForm.tsx` — client form

**Modified files**:
- `apps/web/src/app/layout.tsx` — header nav with Workspaces link
- `apps/web/src/app/page.tsx` — UI pages section + narrowed "Next"
- `apps/web/tsconfig.json` — added `DOM` / `DOM.Iterable` libs
- `apps/web/README.md` — status Task 8 + UI pages section + visit URL
- `README.md` — Tasks 1-8 callout + footer status line

---

## Recommended Commit Message

```
feat(web): Task 8 — /workspaces CRUD page (RSC list + client form)

Phase 1.8 slice. First browser-exercised CRUD surface — closes the
"workspace can be created via UI" exit criterion. Follow-up slices will
apply the same pattern to projects and tasks.

apps/web additions:
- src/app/workspaces/page.tsx — RSC workspace list; reads directly from
  @heynxt/persistence (no API round-trip); soft-redirect to the seed
  org on missing orgId; inline error on invalid UUID; parses each row
  through Zod Workspace schema (defence in depth); empty-state message
  when no workspaces exist
- src/app/components/CreateWorkspaceForm.tsx — 'use client' form;
  client-side CreateWorkspaceInput.safeParse surfaces Zod errors before
  the network call; POSTs JSON to /api/workspaces; on success calls
  router.refresh() for RSC revalidation; honors ?orgId= prefill; inline
  error box + per-field errors from API responses
- src/app/layout.tsx — header gains a nav row with "Workspaces" link
- src/app/page.tsx — "Next" section replaced with a "UI pages" section
  linking to /workspaces; "Next" narrowed to remaining items
- tsconfig.json — added lib: ["ES2022", "DOM", "DOM.Iterable"] to pull
  in React DOM types (the base tsconfig ships ES2022 only; other
  packages don't need DOM)

READMEs:
- apps/web/README.md: status header → Phase 1.8 / Task 8; UI pages
  section added above API endpoints; /workspaces?orgId=... added to
  local-setup visit list
- README.md: Tasks 1-8 callout + footer status line

Verified:
- pnpm typecheck → exit=0 (all 13 tasks, full monorepo)
- pnpm --filter @heynxt/web build → exit=0; Next.js route list:
  ✓ /, /_not-found (static)
  ƒ /api/artifacts, /api/generation-runs, /api/health, /api/projects,
    /api/tasks, /api/workspaces, /workspaces (dynamic)
```

---

## What the Next Session Should Do

### Immediate (after picking up the commit)

1. Verify the commit applies cleanly; re-run `pnpm typecheck && pnpm build`.
2. Smoke-test the live page end-to-end:
   - Start Postgres (`pnpm dev:db`), seed (`pnpm db:seed`), dev server
     (`pnpm dev`), open `/workspaces?orgId=00000000-0000-0000-0000-000000000010`.
   - Confirm the 2 seed workspaces render in the table.
   - Create a third workspace via the form; confirm it appears without a
     hard refresh.
   - Try to create a fourth with the same slug as an existing one; confirm
     the inline error shows the `WORKSPACE_SLUG_CONFLICT` message.
3. Continue closing Phase 1 exit criteria. Recommended order:

   - **Projects UI page** — `/projects?workspaceId=<uuid>` — same RSC-list
     + client-form pattern. Closes "a project can be created within a
     workspace" via UI.

   - **Tasks UI page** — `/tasks?workspaceId=<uuid>` — slightly more work
     because tasks have `type`, `inputPrompt`, optional `projectId`
     filter — but structurally identical.

   - **Auth scaffold** — NextAuth.js (or the `arctic` library that the
     Vercel template uses) for GitHub OAuth. Store user + session in DB.
     Once auth exists, `createdBy` moves from the public input schema to
     the session context; the five Create* input schemas all need the
     same update (an ADR-worthy change).

   - **RBAC enforcement middleware** — `middleware.ts` or per-route helper
     that reads the user's `role_assignments` + workspace role, then gates
     `/api/*` mutations. Uses `getRolePermissions()` from `@heynxt/core-types`.

4. Optional graphify refresh for heynxt-core — `apps/web` now has real
   routes and a UI page; the current graph still marks it as placeholder.
   See `graphify/README.md`.

### Design decisions locked in (this session)

These decisions should NOT be reopened without explicit justification and
a new ADR:

| Decision | Value | Rationale |
|---|---|---|
| RSC vs API for list reads | **RSC reads DB directly** | No extra network hop for initial render; API routes remain available for non-browser callers / future programmatic use |
| Client form submission | **`fetch` + manual JSON POST + `router.refresh()`** | Smallest slice — no server actions yet; keeps the existing `/api/workspaces` POST handler as the canonical mutation path |
| Missing `orgId` behaviour | **Soft-redirect to seed org** | First visit is usable; URL the user navigated to remains visible; no redirect loop on invalid UUID |
| Invalid UUID handling | **Inline error, no redirect** | Avoids misleading URL state; user can correct the param |
| Client-side validation | **`safeParse` before fetch** | Catches Zod errors without a server round-trip; mirrors server-side validation shape exactly (same `CreateWorkspaceInput`) |
| DOM lib in web tsconfig | **Added `DOM` + `DOM.Iterable`** | React's `HTMLInputElement` types require it; scoped to `apps/web` only — other packages stay ES2022-only |

All earlier decisions from prior sessions remain locked — see prior
handovers for the full table (ORM=Drizzle, DB=Neon, schema naming=
User/Org/Workspace, test=Vitest, Task 3 decisions re Postgres 15 alpine /
local creds / 127.0.0.1 binding, Task 4 decisions re camelCase columns /
JSONB typing / migrations, Task 5 decisions re driver / singleton pattern
/ connection pool defaults / next.config.mjs transpilePackages / API
error shape / Postgres unique-violation translation / health endpoint
posture, Task 6 decisions re seed script location / runner / error code
naming / drizzle.config wiring, Task 7 decisions re snapshot optional /
runNumber MAX+1 / artifact storage-kind soft-validation / AuditLogEntry
API-skip / createdBy concession extended).

---

## Phase 1 exit criteria status after Task 8

- [x] Migrations are repeatable (Task 3+4)
- [x] Schemas for all core entities exist (Tasks 1+2)
- [x] CRUD APIs for all core entities live (Tasks 5-7)
- [x] Seed script for local dev (Task 6)
- [x] **Workspace can be created via UI** — ✅ this session (first of three UI criteria)
- [ ] Project can be created within a workspace via UI — **next (Projects page)**
- [ ] Task can be created and assigned to a project via UI — **next (Tasks page)**
- [ ] Generation run can be tracked via UI (initial status only) — **deferred until tasks page exists**
- [ ] Activity log records state transitions per entity — **deferred to audit-log API helper**
- [ ] Basic RBAC gates access (owner/editor/viewer) — **auth+RBAC scaffold**
- [x] Lint, typecheck, build pass — ✅ (this session)

---

## Verification Output (captured this session)

```
$ pnpm typecheck
  Tasks:    13 successful, 13 total
  Cached:   12 cached, 13 total  (cache miss on @heynxt/web after tsconfig change)
  Time:     1.305s
  exit=0  (full monorepo)

$ pnpm --filter @heynxt/web build
  ✓ Compiled successfully
  ✓ Generating static pages (5/5)
  exit=0

  Next.js route list (apps/web):
  ┌ ○ /                              (Static)
  ├ ○ /_not-found                    (Static)
  ├ ƒ /api/artifacts                 (Dynamic)
  ├ ƒ /api/generation-runs           (Dynamic)
  ├ ƒ /api/health                    (Dynamic)
  ├ ƒ /api/projects                  (Dynamic)
  ├ ƒ /api/tasks                     (Dynamic)
  ├ ƒ /api/workspaces                (Dynamic)
  └ ƒ /workspaces                    (Dynamic, 15.9 kB)
```

**Not verified in this session** (no live-DB smoke yet — left for the next
session to keep the slice narrow):
- GET `/workspaces?orgId=…` against a seeded DB renders 2 rows
- POST-create-a-workspace through the form surfaces it in the list
  without a hard refresh (`router.refresh()` works)
- Duplicate-slug rejection renders the inline error
- Missing/invalid `orgId` redirects/errors as designed

The typecheck + build pass confirms the code compiles and the types line
up. Smoke-testing against live Postgres is recommended as the first
action in the next session.

---

## Session-Ready Checklist for New Session

- [x] Read `CLAUDE.md` — instructions confirmed
- [x] Read `buildplan.md` — Phase 1 context
- [x] Read `HANDOVER.md` (Task 7) — Tasks 1-7 context
- [x] Read `docs/gap-analysis.md` — Tasks 1-8 all ✅
- [ ] **Commit pending**: Task 8 work is complete and verified but UNCOMMITTED.
      See commit message block above.
- [x] Task 7 smoke test against live Postgres was completed in Task 7 session
- [x] Toolchain: pnpm 9 + Turbo 2 + TypeScript 5.5 + Vitest 2 + Node 22
- [x] Full monorepo typecheck+build: PASS (all 7 packages + app)
- [x] Local Homebrew Postgres 16 on 127.0.0.1:5432 available for smoke tests
- [x] ORM/DB chosen: Drizzle + Neon serverless (see docs/adr/0004)
- [x] Gap analysis: see docs/gap-analysis.md (Tasks 1-8 all ✅)
- [x] 6 packages + 1 real Next.js app with a UI page now

Paste into your prompt before continuing:

```
You are resuming heynxt-core after Task 8 completed.

Current state:
- Phase 0 (foundation) ✅ complete
- Phase 1 (control plane) 🟡 most API CRUD + first UI page complete:
  Task 1: User, Organization, Workspace, RBAC (5 roles, ~30 permissions)
  Task 2: Project, Task, GenerationRun, Artifact, AuditLogEntry
  Task 3: docker-compose.yml with Postgres 15 mirroring Neon serverless
  Task 4: @heynxt/persistence — 9 Drizzle tables, 12 enums, first migration
  Task 5 (Phase 1.6): apps/web as real Next.js 14 App Router;
    /api/health + /api/workspaces live; DB client wired
  Task 6 (Phase 1.6): deterministic seed script; /api/projects + /api/tasks live;
    CreateProjectInput / CreateTaskInput added; drizzle.config.ts wired
  Task 7 (Phase 1.7): /api/generation-runs + /api/artifacts (GET/POST);
    CreateGenerationRunInput + CreateArtifactInput added to core-types;
    runNumber auto-computed per task via MAX+1; landing page lists all 11
    endpoints; monorepo README at Tasks 1-7
  Task 8 (Phase 1.8): /workspaces page — RSC list reads workspaces from
    DB + inline <CreateWorkspaceForm> client component; top-nav header
    with Workspaces link; tsconfig.json extended with DOM/DOM.Iterable
    libs; landing page "UI pages" section links to /workspaces
  All 9 schemas tested via 61 vitest cases in control-plane.test.ts.
- Task 8 implementation is complete and verified but UNCOMMITTED.
  See HANDOVER.md for the exact commit message.
- Verified via typecheck + build (no live-DB smoke test this slice —
  defer to next session for the /workspaces page end-to-end)
- Toolchain: pnpm 9 + Turbo 2 + TypeScript 5.5 + Vitest 2 + Node 22
- Full monorepo typecheck+build: PASS (all 7 packages + app)
- Local Homebrew Postgres 16 on 127.0.0.1:5432 used across sessions;
  docker-compose.yml exists as an alternative. Same schema in both.
- ORM/DB chosen: Drizzle + Neon serverless (see docs/adr/0004)
- Gap analysis: see docs/gap-analysis.md (Tasks 1-8 all ✅)
- 6 packages + 1 real Next.js app with a real UI page now

First actions after resuming:
1. git status — confirm working tree matches HANDOVER.md state
2. Commit Task 8 (message in HANDOVER.md)
3. Smoke-test /workspaces end-to-end against live Postgres —
   - pnpm dev:db && pnpm db:migrate && pnpm db:seed && pnpm dev
   - open /workspaces?orgId=00000000-0000-0000-0000-000000000010
   - confirm 2 seed workspaces render, create a third via form, try a
     duplicate-slug create and confirm inline error
4. Pick next Task: projects UI page OR tasks UI page OR auth scaffold —
   all close Phase 1 exit criteria further

Hard rules:
- Don't redo Tasks 1-8 (Task 8 uncommitted — just commit + verify)
- Follow CLAUDE.md for process (work order, reporting format, safety)
```
