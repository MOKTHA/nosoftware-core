# Handover — Task 22 complete; RBAC runtime enforcement wired into write routes

**Date**: 2026-07-09
**Status**: Task 22 committed to `main`.
Build + typecheck + core-types tests pass.

---

## What Was Done (this session)

### Task 22 — RBAC runtime enforcement via `getRolePermissions()` on write routes

Prior to this slice the permission model was fully defined but entirely
unenforced at runtime. `ROLE_DEFINITIONS`, `RoleName`, `Permission`,
`getRolePermissions()` all lived in `@heynxt/core-types`, and
`role_assignments` existed in the Drizzle schema with a `userId` index
explicitly documented as "for what roles does this user have" queries —
but no production code read the table. Routes gated on authentication
only (session existence via `requireAuth()`), never on authorization.

This slice closes the gap for the Phase 1.8 exit criterion:
> "Basic RBAC gates access (owner/editor/viewer)"

**Why write routes only in this slice?**
- The five mutating routes already call `requireAuth()` and know the
  `workspaceId` (from the validated body or from the fetched row). Adding
  a permission gate is a two-line insertion per route.
- GET routes currently list data without per-workspace scoping to the
  caller — gating reads without first filtering by workspace scope
  would return 403 for users who should legitimately list resources.
  Read-side gating needs a "is this user allowed access to this
  workspace?" question first; deferring that keeps the slice small and
  avoids a false positive for viewers/guests on the listing pages.
- The `POST /api/workspaces` route has no `requireAuth()` and is
  currently the odd one out; it is called out separately in follow-ups.

**New file — `apps/web/src/lib/rbac.ts`:**

Three exports, layered so each consumer picks the right abstraction:

1. `getUserPermissions(scope)` — async DB query that resolves
   `(userId, workspaceId?, organizationId?)` → union of `Permission[]`
   across all matching role assignments (workspace-scoped + org-scoped).
   Returns `[]` if no roles match. Used for conditional UI/branching.

2. `hasPermission(scope & { permission })` — boolean wrapper over
   `getUserPermissions`. Never throws; suitable for UI predicates.

3. `requirePermission(scope & { permission })` — the route gate. Calls
   `hasPermission`; throws `ForbiddenError` on miss. This is the
   function wired into routes.

Resolution algorithm:
- If only `workspaceId` is provided, look up the workspace's
  `organizationId` via a single-PK SELECT on `workspaces`.
- Query `role_assignments` WHERE `userId = ?` AND `organizationId = ?`
  AND (`workspaceId = ?` OR `workspaceId IS NULL`) — the OR covers the
  org-scoped "owner" role pattern that grants workspace permissions
  transitively across every workspace in the org.
- Union permissions across every matching role via a Set (deduplicated).
- Use `RoleName.parse()` before calling `getRolePermissions()` so DB
  enum drift is caught early rather than producing a silent miss.

Designed to NOT cache permissions in the session cookie (Phase 9
optimisation — at Phase 1 the role set is small and the query is
sub-millisecond on the existing `userId` index).

**Modified `apps/web/src/lib/api.ts`:**

- Added `ForbiddenError` class (Error subclass with `name:
  'ForbiddenError'`). Distinct from `NotAuthenticatedError` (401) — the
  user is logged in, but their role doesn't grant the required
  permission.
- Added `forbidden()` factory alongside `badRequest()`/`notFound()`.
- Added `ForbiddenError` branch in `errorResponse()` → 403 with code
  `'FORBIDDEN'`. Placed between the 401 and NextApiError branches so
  the mapping is explicit.

**Five routes now gated with `requirePermission()`:**

| Route | Permission | Scope source |
|---|---|---|
| `POST /api/projects`           | `project:create`    | `input.workspaceId` |
| `PATCH /api/projects/[id]`     | `project:update`    | fetched `project.workspaceId` |
| `POST /api/tasks`              | `task:create`       | `input.workspaceId` |
| `POST /api/artifacts`          | `artifact:create`   | `input.workspaceId` |
| `POST /api/generation-runs`    | `generation:run`    | `input.workspaceId` |

**Gate ordering discipline (same across all five routes):**
1. `requireAuth()` → 401 if unauthenticated. (Fast path, no DB for role query.)
2. `parseJsonBody()` + input Zod parse → 400 on malformed body. (Fast path, no role query wasted.)
3. For PATCH: fetch the row → 404 if not found. (404 beats 403 so clients don't leak resource existence.)
4. `requirePermission(...)` → 403 if user lacks the permission.
5. Business logic continues.

This ordering means a viewer who sends a malformed body gets 400, not
403 — and a non-existent resource returns 404 rather than revealing its
(protected) status via 403. Cheap failures first.

**Verification:**
- `pnpm typecheck` → 13/13 ✅
- `pnpm build` → 7/7 ✅
- `pnpm --filter @heynxt/core-types test` → 83/83 ✅ (no new tests
  added to core-types — the RBAC pure helpers already had coverage
  from earlier tasks; runtime enforcement needs integration tests
  against a real DB, which is a follow-up in Task 23/24 territory.)

---

## What's Left in Phase 1 (remaining exit criteria)

| Exit criterion | Status |
|---|---|
| Activity log records state transitions | ✅ complete (Tasks 20 + 21) |
| Workspace created + user invited | ⚠️ Create works; **invite flow does not** yet |
| Project within workspace | ✅ complete |
| Task assigned to project | ✅ complete |
| Generation run tracked (status only) | ✅ complete (schema + POST + audit) |
| Artifact attached | ✅ complete (schema + POST + audit) |
| **Basic RBAC gates access** | ✅ **Now covered for writes.** GET routes rely on middleware auth; viewer/guest read scoping is a small follow-up. |
| Migrations repeatable and reversible | ⚠️ Forward-only (drizzle-kit); no down migrations yet |
| Lint/typecheck/build pass in CI | ❌ no CI workflow (`/.github`) exists yet |

---

## Files Changed (this session)

- **Added**: `apps/web/src/lib/rbac.ts` — `getUserPermissions`, `hasPermission`, `requirePermission`
- **Modified**: `apps/web/src/lib/api.ts` — added `ForbiddenError` class, `forbidden()` factory, 403 branch in `errorResponse()`
- **Modified**: `apps/web/src/app/api/projects/route.ts` — POST adds `requirePermission({ permission: 'project:create' })`
- **Modified**: `apps/web/src/app/api/projects/[id]/route.ts` — PATCH adds `requirePermission({ permission: 'project:update' })` (placed AFTER the select+parse so 404 beats 403)
- **Modified**: `apps/web/src/app/api/tasks/route.ts` — POST adds `requirePermission({ permission: 'task:create' })`
- **Modified**: `apps/web/src/app/api/artifacts/route.ts` — POST adds `requirePermission({ permission: 'artifact:create' })`
- **Modified**: `apps/web/src/app/api/generation-runs/route.ts` — POST adds `requirePermission({ permission: 'generation:run' })`

---

## What the Next Session Should Do

Immediate next steps (ordered by Phase 1 exit-criterion impact):

1. **(Task 23 — recommended) User invitation flow.** The exit criterion
   explicitly mentions inviting a user. The DB support exists
   (`verification_tokens`, `users.status = 'invited'`) but nothing in
   the app uses it. Small slice: add `POST /api/invitations` that
   creates a verification token and (later) emails it. Gate it with
   `requirePermission({ permission: 'org:manage-members' })`.

2. **(Task 24 — optional cleanup) Gating the workspace POST route.**
   `POST /api/workspaces` is currently the only write without
   `requireAuth()` or permission checks. Adding
   `requireAuth() + requirePermission({ organizationId, permission:
   'org:manage-workspaces' })` is a small, merge-safe follow-up.

3. **(Task 25 — optional) Read-side RBAC scoping.** Viewer/guest GET
   routes currently bypass workspace scoping. Two approaches:
   - Cheap: filter each listing query by "workspaces the user has ANY
     role in" (using a single `roleAssignments` lookup to build a
     workspace allowlist).
   - Per-request: gate each GET with `requirePermission({ workspaceId,
     permission: '<entity>:read' })`.
   Either approach is small. Recommend the per-request variant for
   consistency with the write gates added here.

4. **(Phase 9 — later) CI pipeline.** Separate from Phase 1 work.

Out of scope reminders (recurring):
- **Do NOT** revise ADR-0005 (Server Actions) — revisit triggers not met.
- **Do NOT** extract shared `<DataTable>`/`<StatusBadge>` — revisit
  only when 4th CRUD page arrives per ADR-0007.
- **Do NOT** add workspace-level org gating to reads without first
  scoping by role assignments — viewers should see *something*, not 403.
- **Do NOT** promote `rbac.ts` into `@heynxt/persistence` yet — only
  one consumer (the web app).
- **Do NOT** cache role permissions in the session cookie — Phase 9
  optimisation; the current sub-millisecond query is fine at Phase 1
  scale.

---

## Session-Ready Checklist

- [x] Read CLAUDE.md
- [x] Read buildplan.md
- [x] Read prior HANDOVER.md
- [x] Task 22 — RBAC runtime enforcement
- [x] `pnpm typecheck` → 13/13 ✅
- [x] `pnpm build` → 7/7 ✅
- [x] `pnpm --filter @heynxt/core-types test` → 83/83 ✅
- [x] HANDOVER.md updated
- [ ] Commit on `main` (pending — commit before ending session)

Paste into your prompt before continuing:

```
You are resuming heynxt-core after Task 22 committed.

Commits on main (most recent first):
  e2a2030   feat(web): Task 22 — RBAC runtime enforcement (write-route gates + 403 path)
  b5661ac   feat(web): Task 21 — PATCH route (project status transition) + transition graph
  aa04f1d   feat(web): Task 20 — activity log writes on entity creation
  4815845   feat(web): Task 19 — session context for UI forms (live dropdowns)
  ba7af8b   feat: Task 17 — ADR-0006 createdBy session sweep
  d65cff6   feat(web): Task 16 — session-aware header (UserMenu + sign-in/out)
  dc09eb2   feat(web): Task 15 — middleware scaffold (auth gate)
  208c870   feat(web): Task 14 — auth scaffold (NextAuth v5 + Drizzle)

Current state:
  - RBAC enforcement wired into 5 write routes via requirePermission():
    projects POST (project:create), projects/[id] PATCH (project:update),
    tasks POST (task:create), artifacts POST (artifact:create),
    generation-runs POST (generation:run).
  - apps/web/src/lib/rbac.ts exposes getUserPermissions / hasPermission /
    requirePermission; unions workspace-scoped + org-scoped role
    assignments via roleAssignments table lookup.
  - apps/web/src/lib/api.ts has ForbiddenError + forbidden() + 403
    branch in errorResponse().
  - Gate ordering: 401 → 400 → 404 → 403 → success (cheap failures first).
  - typecheck 13/13; build 7/7; core-types tests 83/83.

Next recommended task:
  Task 23 — User invitation flow (POST /api/invitations, gated with
            org:manage-members).
  Task 24 — Optional: gate workspaces POST route with requireAuth +
            requirePermission (org:manage-workspaces).

Phase 1 exit criteria still open:
  - Activity log state transitions: ✅ fully covered.
  - RBAC gates access: ✅ writes gated; reads still unscoped.
  - Invite flow: not implemented yet.
  - Migrations reversible: forward-only (drizzle-kit); no downs.
  - CI pipeline: does not exist.

Hard rules (from CLAUDE.md / prior handover):
  - Don't redo Tasks 1–22.
  - Follow small-slice principle.
  - Verify after each step.
```
