# ADR-0006 — `createdBy` Session Sweep Plan

- **Status**: Accepted
- **Date**: 2026-07-09
- **Deciders**: @pskbmohan (session decision, pending team review)
- **Supersedes**: N/A
- **See also**: ADR-0004 (ORM + database), Task 5 / Task 6 / Task 7 /
  Task 8 handovers (`createdBy concession` entries in their decision
  tables)

---

## Context

Five of the control-plane "create" schemas accept `createdBy` as a
caller-supplied field:

| Schema | File |
|---|---|
| `CreateWorkspaceInput` | `packages/core-types/src/schemas/workspace.ts` |
| `CreateProjectInput` | `packages/core-types/src/schemas/project.ts` |
| `CreateTaskInput` | `packages/core-types/src/schemas/task.ts` |
| `CreateGenerationRunInput` | `packages/core-types/src/schemas/generation-run.ts` |
| `CreateArtifactInput` | `packages/core-types/src/schemas/artifact.ts` |

This is explicitly a **concession** — `createdBy` is an audit field and
logically should come from the authenticated session, not from the
request body. The concession was adopted in Task 5 so that Phase 1
could ship CRUD endpoints without first shipping auth, and it has been
consistently extended to every new `Create*Input` schema for symmetry.

The concession is tracked in every handover since Task 5, with the
same note: "When auth lands, sweep all [N] to pull `createdBy` from
session context."

---

## Decision

**Keep `createdBy` as a required caller-supplied field until auth
lands.** When auth lands, remove `createdBy` from all five input
schemas in a single breaking change and migrate existing callers to
derive it from the session instead.

The sweep is scoped as a single coordinated change, not five
independent ones, because the contract change affects all callers of
all five `Create*Input` schemas at once.

---

## Rationale

1. **Consistency.** Five schemas, same field, same concession.
   Changing them one at a time produces an asymmetric API where some
   routes derive `createdBy` from session and others still accept it
   from the body — a worse state than "all body" or "all session."
2. **Auth is the enabling prerequisite.** Without a session layer,
   there is no safe source of `createdBy`. Removing it from the input
   now means either (a) the API refuses the request, or (b) the API
   fabricates the user (defeating the point of the audit field).
   Neither is better than deferring.
3. **Breaking change needs coordination.** Input schemas are imported
   by every API route and by the UI form. Changing five schemas at
   once requires all five routes + the UI form to update in the same
   commit; otherwise the build breaks.
4. **Audit-trail correctness.** Until auth lands, the caller controls
   `createdBy`. That's a known audit weakness for dev mode but
   acceptable because (a) there is no auth yet, (b) Phase 1 is local
   dev only (Neon target is Phase 9+), and (c) the moment auth
   exists, we fix all five rows — no window where some are correct
   and some aren't.

---

## Sweep Plan

When `apps/web` gains an auth layer (NextAuth.js or `arctic` for
GitHub OAuth — see `buildplan.md` Phase 1 "UI scaffolding"), the
sweep is a single coordinated commit:

1. **Add session middleware** — `apps/web/src/middleware.ts` reads
   the session cookie, resolves `userId`, attaches to request context
   (e.g., via `headers().set('x-user-id', userId)` at the edge, or
   via a shared `getSession()` helper the routes call).

2. **Update `Create*Input` schemas** — remove `createdBy` from all
   five schemas:
   - `CreateWorkspaceInput`
   - `CreateProjectInput`
   - `CreateTaskInput`
   - `CreateGenerationRunInput`
   - `CreateArtifactInput`

3. **Update API routes** — all five `/api/*` POST handlers
   (`/api/workspaces`, `/api/projects`, `/api/tasks`,
   `/api/generation-runs`, `/api/artifacts`) read `createdBy` from
   the session instead of the body. If no session is present,
   return 401 `UNAUTHENTICATED`.

4. **Update UI forms** — `CreateWorkspaceForm` (Task 8) and the
   upcoming `CreateProjectForm` / `CreateTaskForm` stop sending
   `createdBy`. Auth context is implicit via cookies.

5. **Update seed script** — the seed script in
   `packages/persistence/scripts/seed.ts` uses `SEED_USER_ID` as
   `createdBy`. It bypasses the API routes (inserts directly via
   Drizzle), so no schema change needed — but document that seed
   data uses a synthetic seed user, not a real session.

6. **Update seed + unit tests** —
   `packages/core-types/src/schemas/control-plane.test.ts` likely
   has tests that pass `createdBy` when constructing valid inputs;
   those must be updated. Tests that assert rejection of requests
   without `createdBy` must be inverted.

7. **Update handover + README** — note the breaking change, the
   commit sha, and the new contract.

---

## Costs / Tradeoffs

- **Audit weakness during Phase 1.** Caller-controlled `createdBy`
  means anyone can set any user. Documented risk; mitigated by
  Phase 1 being local-dev only.
- **Breaking change.** When the sweep happens, all five input schemas
  change at once — any external callers (if any exist by then) need
  a migration. Contained to the current monorepo in Phase 1.
- **Migration work.** Six files in the schema directory + five API
  routes + the UI forms + the test file. Not huge, but coordinated.

---

## Consequences

- **Phase 1 continues to accept `createdBy` in the body.** Callers
  (UI forms, curl commands, seed-equivalent scripts) supply it
  explicitly. The concession is documented and tracked.
- **Phase 1 exit criterion "Basic RBAC gates access"** depends on
  the auth scaffold actually landing — once it does, this ADR's
  sweep becomes the first task of the RBAC work, not a follow-up.
- **Single-commit sweep** preserves API consistency at all times. No
  intermediate state where some routes use session `createdBy` and
  others use body `createdBy`.

---

## Exit Criteria for the Sweep

The sweep is complete when:

- [ ] `createdBy` is no longer a field in any `Create*Input` schema
      (5 schemas updated).
- [ ] All five API routes derive `createdBy` from the session.
- [ ] Unauthenticated requests to any of the five routes get
      401 `UNAUTHENTICATED`.
- [ ] UI forms have stopped sending `createdBy`.
- [ ] Seed script still works (it bypasses the API; no change needed).
- [ ] `pnpm test` passes with the updated input shapes.
- [ ] A brief changelog entry or handover note records the breaking
      change + commit sha.
