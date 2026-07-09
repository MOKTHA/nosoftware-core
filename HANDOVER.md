# Handover — Tasks 16 + 17 complete; Phase 1 RBAC foundations landed

**Date**: 2026-07-09
**Status**: Tasks 16 + 17 code-complete and committed on `main`.
Build + typecheck + core-types tests pass.

---

## What Was Done (this session)

### Task 16 — Session-aware header (UserMenu + sign-in/out)

**Files created (1):**
- `apps/web/src/components/UserMenu.tsx` — client component that
  renders either a signed-out "Sign in" link or a signed-in
  avatar (GitHub image + initials fallback) + name + "Sign out"
  button (via `next-auth/react`'s `signOut`).

**Files modified (1):**
- `apps/web/src/app/layout.tsx` — root layout is now `async`,
  calls `getSession()` server-side, extracts a slim user slice
  (`id`/`name`/`email`/`image`) and passes it into `<UserMenu>`.
  Nav and UserMenu now live side-by-side inside a flex wrapper in
  the header.

**Server/client boundary:**
- `getSession()` is server-only (RSC) — no leakage into the
  client bundle.
- The user slice crossing the boundary contains only display
  fields, no internal Auth.js state.
- Only the sign-out action runs client-side (via a real
  `<button onClick>` that calls `signOut`), which keeps the
  client component minimal.

**Verification:**
- `pnpm typecheck` → 13/13 ✅ (one TS false-positive on
  `user.email[0]` caught and handled with `?? '?'`).
- `pnpm build` → 7/7 ✅.

**Commit:** `d65cff6`.

---

### Task 17 — ADR-0006 `createdBy` session sweep

Coordinated breaking change: `createdBy` is no longer a
caller-supplied field on any `Create*Input` schema. The server
now derives it from the authenticated session, closing the
audit-trail weakness tracked since Task 5.

**Scope correction (vs. ADR-0006 text):**
- The ADR originally referenced "five schemas". `CreateWorkspaceInput`
  never had a `createdBy` field (workspaces track membership via
  org, not an audit user). The actual affected count is **four**, not
  five. The ADR has been updated with this clarification.

**Schemas updated (4):**
- `packages/core-types/src/schemas/project.ts` —
  `CreateProjectInput` now omits `createdBy`.
- `packages/core-types/src/schemas/task.ts` —
  `CreateTaskInput` now omits `createdBy`.
- `packages/core-types/src/schemas/artifact.ts` —
  `CreateArtifactInput` now omits `createdBy`.
- `packages/core-types/src/schemas/generation-run.ts` —
  `CreateGenerationRunInput` now omits `createdBy`.

Each schema's JSDoc was updated to document that `createdBy`
is server-derived.

**API helper changes (2 files):**
- `apps/web/src/lib/session.ts`:
  - New `AuthenticatedSession` type narrows `session.user` and
    `session.user.id` to non-null so route handlers can read
    `session.user.id` without extra guards.
  - `requireAuth()` now returns `Promise<AuthenticatedSession>`,
    asserting the narrow type after the guard.
- `apps/web/src/lib/api.ts`:
  - `errorResponse()` now maps `NotAuthenticatedError` →
    `401 UNAUTHENTICATED`. This is the shared error boundary
    that turns `requireAuth()` failures into clean HTTP
    responses for every POST route.

**API routes updated (4):**
- `apps/web/src/app/api/projects/route.ts` — POST calls
  `requireAuth()` first, reads `session.user.id` as `createdBy`.
  FK-violation error message simplified (no longer mentions
  "user" since user is now session-derived).
- `apps/web/src/app/api/tasks/route.ts` — same pattern.
- `apps/web/src/app/api/artifacts/route.ts` — same pattern.
- `apps/web/src/app/api/generation-runs/route.ts` — same pattern.

**UI forms updated (2):**
- `apps/web/src/app/components/CreateProjectForm.tsx` — removed
  `SEED_USER_ID` constant, `createdBy` state, the "Created By
  (User ID)" `<input>`, and the field from the safeParse payload.
- `apps/web/src/app/components/CreateTaskForm.tsx` — same.

**Tests:**
- `packages/core-types/src/schemas/control-plane.test.ts` — added
  8 new assertions (one per input shape: accepts payload without
  `createdBy`, rejects when a required field is missing; existing
  `Project`/`Task`/`GenerationRun`/`Artifact` canonical row
  tests untouched, since the canonical rows still carry `createdBy`).
- `pnpm --filter @heynxt/core-types test` → 68/68 passed ✅.

**Docs:**
- `docs/adr/0006-createdby-session-sweep.md` — status bumped to
  "Accepted · Implemented", added the scope correction (four
  schemas, not five), and marked every exit criterion as `[x]`.

**Verification:**
- `pnpm typecheck` → 13/13 ✅
- `pnpm build` → 7/7 ✅
- `pnpm test` (core-types only — that's the only package with
  tests) → 68/68 ✅

**Pre-existing failure (not a regression):** `@heynxt/persistence`'s
`test` script fails with "No test files found" because the package
has no tests yet. This existed before the sweep; not touched.

---

## Files Changed (this session, total)

**Task 16 — Session banner:**
- New: `apps/web/src/components/UserMenu.tsx`
- Modified: `apps/web/src/app/layout.tsx`

**Task 17 — ADR-0006 sweep:**
- Modified (schemas):
  - `packages/core-types/src/schemas/project.ts`
  - `packages/core-types/src/schemas/task.ts`
  - `packages/core-types/src/schemas/artifact.ts`
  - `packages/core-types/src/schemas/generation-run.ts`
- Modified (tests):
  - `packages/core-types/src/schemas/control-plane.test.ts`
- Modified (helpers):
  - `apps/web/src/lib/session.ts` (new `AuthenticatedSession`
    type, narrowed `requireAuth()` return)
  - `apps/web/src/lib/api.ts` (401 mapping)
- Modified (routes):
  - `apps/web/src/app/api/projects/route.ts`
  - `apps/web/src/app/api/tasks/route.ts`
  - `apps/web/src/app/api/artifacts/route.ts`
  - `apps/web/src/app/api/generation-runs/route.ts`
- Modified (forms):
  - `apps/web/src/app/components/CreateProjectForm.tsx`
  - `apps/web/src/app/components/CreateTaskForm.tsx`
- Modified (docs):
  - `docs/adr/0006-createdby-session-sweep.md`

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

2. **(Task 19-ish) Session context for UI forms.** The Create*
   forms now don't send `createdBy` (Task 17). When a signed-in
   user submits, the server populates `createdBy` from the session
   — **but the form currently shows stale hardcoded seed workspace/
   project IDs**. Lift those hardcodeds out so the form reads
   real values from the signed-in user's context (e.g. list the
   user's workspaces/projects, populate the dropdown).

3. **(Task 20-ish) Per-route permission checks on POST.** The
   middleware blocks unauthenticated requests globally, but
   authenticated users can still hit any route without RBAC
   gating. Next step: read the user's `RoleName` from
   `role_assignments` and enforce per-route permissions before
   the INSERT (e.g. `project:create` for `/api/projects` POST).
   Phase 1 exit criterion: "Basic RBAC gates access".

4. **(Task 21-ish) Workspace-scoped listing.** All GET
   list-endpoints currently require the client to pass
   `workspaceId` (or `organizationId`, `projectId`) as a query
   param. Once per-row workspace ownership is settled via RBAC,
   the server could derive the scope from the session to prevent
   a signed-in user from listing other users' data.

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
- [x] Task 16 — session banner wired
- [x] Task 17 — ADR-0006 sweep complete (4 schemas, 4 routes, 2 forms, 8 new tests)
- [x] `pnpm typecheck` → 13/13 ✅
- [x] `pnpm build` → 7/7 ✅
- [x] `pnpm --filter @heynxt/core-types test` → 68/68 ✅
- [x] HANDOVER.md updated
- [x] Both commits on `main`

Paste into your prompt before continuing:

```
You are resuming heynxt-core after Tasks 16 + 17 code-complete.

Commits on main (most recent first):
  <new sha> feat: Task 17 — ADR-0006 createdBy session sweep
  d65cff6   feat(web): Task 16 — session-aware header (UserMenu + sign-in/out)
  dc09eb2   feat(web): Task 15 — middleware scaffold (auth gate)
  208c870   feat(web): Task 14 — auth scaffold (NextAuth v5 + Drizzle)

Current state:
  - createdBy no longer accepted on any Create*Input (4 schemas; see ADR-
    0006 scope correction — workspaces never had the field).
  - All 4 POST routes call requireAuth() and derive createdBy from
    session.user.id; 401 UNAUTHENTICATED on auth failure.
  - CreateProjectForm + CreateTaskForm no longer collect createdBy.
  - UserMenu component renders sign-in / sign-out state in the header.
  - core-types tests: 68 passed (8 new ADR-0006 assertions).
  - pnpm typecheck 13/13 ✅ ; pnpm build 7/7 ✅.

Next recommended task:
  Task 18-ish — real GitHub OAuth round-trip (create OAuth App,
    set AUTH_GITHUB_ID/AUTH_GITHUB_SECRET, verify full cycle).
  Task 19-ish — lift hardcoded seed workspace/project IDs from forms.
  Task 20-ish — per-route RBAC permission gates on POST routes.

Hard rules (from CLAUDE.md):
  - Don't redo Tasks 1-17.
  - Follow small-slice principle.
  - Verify after each step.
  - Read ADR-0006 before touching the createdBy area again.
```
