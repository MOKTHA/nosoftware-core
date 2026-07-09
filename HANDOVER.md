# Handover — Task 19 complete; forms now use live data dropdowns

**Date**: 2026-07-09
**Status**: Task 19 code-complete and ready to commit on `main`.
Build + typecheck + core-types tests pass.

---

## What Was Done (this session)

### Task 19 — Session context for UI forms (lift hardcoded seed IDs)

Replaced the hardcoded `SEED_WORKSPACE_ID` / `SEED_WS_ID` /
`SEED_PROJECT_ID` constants embedded in `CreateProjectForm` and
`CreateTaskForm` with live dropdowns populated from the DB via
`/api/workspaces` and `/api/projects`.

**API routes updated (2):**

- `apps/web/src/app/api/workspaces/route.ts` — `GET /api/workspaces`
  no longer requires an `organizationId` query param. When omitted,
  it returns **all** workspaces; when provided, it returns the org
  scope (same as before). 400 behavior preserved for invalid UUIDs.
- `apps/web/src/app/api/projects/route.ts` — `GET /api/projects`
  now behaves the same way: optional `workspaceId` filter returns
  all projects when omitted (400 on invalid UUID still works).

**Forms updated (2):**

- `apps/web/src/app/components/CreateProjectForm.tsx` — removed
  `SEED_WORKSPACE_ID`. On mount, fetches `/api/workspaces` and
  populates a `<select>`. Honors `?workspaceId=` URL param for
  preselection; otherwise defaults to the first workspace.
- `apps/web/src/app/components/CreateTaskForm.tsx` — removed
  `SEED_WS_ID` and `SEED_PROJECT_ID`. On mount, fetches both
  `/api/workspaces` and `/api/projects` in parallel. Workspace
  dropdown defaults to `?workspaceId=` from URL or first available.
  Project dropdown is filtered to the currently selected workspace;
  switches retarget `projectId` to the first project in the new
  workspace (clears when none exist).

**Loading / empty states:**
- Loading placeholder shown while the dropdown data is being fetched.
- Empty-state message shown when no options exist in the selected
  scope (e.g., "No projects in this workspace").

**Pre-existing behavior preserved:**
- `?workspaceId=` query param on `/projects` still preselects the
  workspace (e.g., for deep links from workspace listings).
- Inline Zod validation via `fieldErrors` still renders correctly
  for `workspaceId` and `projectId`.
- `createdBy` is still not accepted by any Create*Input schema
  (ADR-0006 invariant intact).

**Verification:**
- `pnpm typecheck` → 13/13 ✅
- `pnpm build` → 7/7 ✅
- `pnpm --filter @heynxt/core-types test` → 68/68 ✅

**Pre-existing failure (not a regression):** `@heynxt/persistence`'s
`test` script still fails with "No test files found" — the package
has no tests yet. Existed before this slice; left alone.

---

## Files Changed (this session)

- Modified: `apps/web/src/app/api/workspaces/route.ts` (GET no
  longer requires `organizationId`; optional filter)
- Modified: `apps/web/src/app/api/projects/route.ts` (GET no longer
  requires `workspaceId`; optional filter)
- Modified: `apps/web/src/app/components/CreateProjectForm.tsx`
  (workspace dropdown instead of hardcoded ID)
- Modified: `apps/web/src/app/components/CreateTaskForm.tsx`
  (workspace + project dropdowns instead of hardcoded IDs)

---

## What the Next Session Should Do

Immediate next steps (ordered):

1. **(Task 18-ish) Real GitHub OAuth sign-in round-trip.** Create
   a GitHub OAuth App at
   https://github.com/settings/developers with callback URL
   `http://localhost:3000/api/auth/callback/github`. Set
   `AUTH_GITHUB_ID` + `AUTH_GITHUB_SECRET` in
   `apps/web/.env.local`. Restart dev server. Complete a real
   sign-in flow to verify:
   - Auth.js `createUser` fires via the Drizzle adapter on first
     sign-in.
   - Session cookie is set.
   - `/api/auth/session` returns the user.
   - `<UserMenu>` avatar renders on subsequent page loads.
   - Sign-out clears the cookie.
   Document the result under ADR-0008 Consequences. This is the
   final piece that makes Task 14 100% verified end-to-end.

2. **(Task 20-ish) Per-route permission checks on POST.** The
   middleware blocks unauthenticated requests globally, but
   authenticated users can still hit any route without RBAC
   gating. Next step: read the user's `RoleName` from
   `role_assignments` and enforce per-route permissions before
   the INSERT (e.g. `project:create` for `/api/projects` POST).
   Phase 1 exit criterion: "Basic RBAC gates access".

3. **(Task 21-ish) Workspace-scoped listing.** The GET endpoints
   now support listing without a scope filter (to populate
   dropdowns). For listing pages, the server should derive the
   scope from the session/RBAC to prevent a signed-in user from
   seeing data they shouldn't. Currently, listing is intentionally
   wide-open within a scope (anyone who passes a workspace ID).

Out of scope reminders (recurring):
- **Do NOT** revise ADR-0005 (Server Actions) — revisit triggers
  not met.
- **Do NOT** extract shared `<DataTable>`/`<StatusBadge>` — revisit
  only when a 4th CRUD page arrives per ADR-0007.
- **Do NOT** add workspace-level org gating — open sign-up is
  Phase 1's explicit decision; org-gating is Phase 9.

---

## Session-Ready Checklist

- [x] Read `CLAUDE.md`
- [x] Read `buildplan.md`
- [x] Read prior `HANDOVER.md`
- [x] Task 19 — forms use live DB-backed dropdowns
- [x] `pnpm typecheck` → 13/13 ✅
- [x] `pnpm build` → 7/7 ✅
- [x] `pnpm --filter @heynxt/core-types test` → 68/68 ✅
- [x] HANDOVER.md updated
- [ ] Commit on `main` (pending — commit before ending session)

Paste into your prompt before continuing:

```
You are resuming heynxt-core after Task 19 code-complete.

Commits on main (most recent first):
  <new sha> feat(web): Task 19 — session context for UI forms (live dropdowns)
  ba7af8b   feat: Task 17 — ADR-0006 createdBy session sweep
  d65cff6   feat(web): Task 16 — session-aware header (UserMenu + sign-in/out)
  dc09eb2   feat(web): Task 15 — middleware scaffold (auth gate)
  208c870   feat(web): Task 14 — auth scaffold (NextAuth v5 + Drizzle)

Current state:
  - CreateProjectForm and CreateTaskForm no longer have hardcoded seed IDs.
  - Workspaces and projects are fetched from /api/workspaces and
    /api/projects on form mount; dropdown defaults honor URL params.
  - /api/workspaces GET no longer requires organizationId filter.
  - /api/projects GET no longer requires workspaceId filter.
  - createdBy still server-derived from session (ADR-0006 intact).
  - core-types tests: 68 passed; typecheck 13/13; build 7/7.

Next recommended task:
  Task 18 — real GitHub OAuth round-trip (create OAuth App, verify
    full sign-in/out cycle).
  Task 20 — per-route RBAC permission gates on POST routes.

Hard rules (from CLAUDE.md):
  - Don't redo Tasks 1-19.
  - Follow small-slice principle.
  - Verify after each step.
```
