# Handover — Task 21 complete; first PATCH route writes status-transition audits

**Date**: 2026-07-09
**Status**: Task 21 code-complete and ready to commit on `main`.
Build + typecheck + core-types tests pass.

---

## What Was Done (this session)

### Task 21 — First PATCH route: project status transition with audit log

The audit log was recording `created` events for all five entity types
(Task 20), but nothing had yet produced a status-transition entry —
there was no PATCH/PUT route anywhere in the codebase to drive one.

This slice is the smallest enabler for the Phase 1.7 exit criterion:
> "Activity log records state transitions per entity."

**Entity chosen**: `project`. Reasons (per exploration):
- Smallest FSM: `draft → active → archived` (3 states, linear).
- No `completedAt` (or `startedAt`) side-effect to manage on transition.
- `AuditAction` already has `archived`/`restored` verbs for its lifecycle.
- `archived` is the explicit soft-delete state (see project schema
  header), so a future restore is a Phase 9 governance concern.

By contrast, `task` has 6 states and a `completedAt` timestamp that
would need conditional handling, and `generation-run` has two
conditional timestamps on transition — more bookkeeping than the
smallest-first PATCH deserves.

**New schema additions in `packages/core-types/src/schemas/project.ts`:**

1. `ALLOWED_PROJECT_STATUS_TRANSITIONS` — the single source of truth
   for the project FSM as a `Record<ProjectStatus, ProjectStatus[]>`:
     - `draft  → ['draft', 'active']`
     - `active → ['active', 'archived']`
     - `archived → ['archived']` (terminal for v1)
2. `isProjectStatusTransitionAllowed(from, to)` — pure function used at
   the PATCH route boundary. Same-status returns `true` (no-op).
3. `UpdateProjectStatusInput` — body schema for the PATCH, shape
   `{ status: ProjectStatus; reason?: string | null }`. Deliberately
   status-only; mixing status with generic field updates would muddy
   both validation and audit semantics, and field updates belong in a
   separate `UpdateProjectInput` when the product calls for them.

**New route — `PATCH /api/projects/[id]`** at
`apps/web/src/app/api/projects/[id]/route.ts`:

- Auth via `requireAuth()` (status change is a write).
- Actor derived from session (ADR-0006 — `createdBy` session sweep).
- Body schema: `UpdateProjectStatusInput`.
- Flow:
  1. Validate `id` segment as UUID → 400 `INVALID_PATH_PARAM` on failure.
  2. Fetch project → 404 `PROJECT_NOT_FOUND` if missing.
  3. Parse stored row via `Project.parse` to trust `existing.status`
     as a `ProjectStatus`.
  4. Run `isProjectStatusTransitionAllowed` → 400
     `INVALID_STATUS_TRANSITION` on failure.
  5. Same-status no-op → 200 current project, no UPDATE, no audit row
     (keeps retries from spamming the audit log).
  6. Otherwise `UPDATE projects SET status, updatedAt` then
     `insertStatusChangeEntry(...)` best-effort (audit failures never
     roll back the UPDATE — matches Task 20 convention).
- Returns updated project via 200.

**Verification:**
- `pnpm typecheck` → 13/13 ✅
- `pnpm build` → 7/7 ✅ (and `/api/projects/[id]` appears in the
  Next.js build-route table)
- `pnpm --filter @heynxt/core-types test` → 83/83 ✅ (was 68; +15
  new tests covering transition graph, exhaustiveness, and input schema)

**Pre-existing failure (not a regression):** `@heynxt/persistence`'s
`test` script still fails with "No test files found" — the package has
no tests yet. Not introduced by this slice.

---

## What's Left in Phase 1 (remaining exit criteria)

| Exit criterion | Status |
|---|---|
| Activity log records state transitions | ✅ **Now fully covered.** `created` (Task 20) for all 5 entity types, plus `status-changed` (Task 21) for the project FSM. The helper is in place so subsequent PATCH routes (tasks, generation-runs) will follow the same pattern. |
| Workspace created + user invited | ⚠️ Create works; **invite flow does not** — no route, no UI, no email. |
| Project within workspace | ✅ complete |
| Task assigned to project | ✅ complete |
| Generation run tracked (status only) | ✅ schema + POST + audit; no UI page required |
| Artifact attached | ✅ schema + POST + audit; no UI page required |
| Basic RBAC gates access | ❌ definitions exist; no runtime enforcement yet |
| Migrations repeatable and reversible | ⚠️ repeatable (drizzle-kit forward); no down migrations |
| Lint/typecheck/build pass in CI | ❌ no CI workflow (`/.github`) exists yet |

---

## Files Changed (this session)

- **Added**: `apps/web/src/app/api/projects/[id]/route.ts` — PATCH handler
- **Modified**: `packages/core-types/src/schemas/project.ts` — added
  `ALLOWED_PROJECT_STATUS_TRANSITIONS`, `isProjectStatusTransitionAllowed`,
  `UpdateProjectStatusInput`
- **Modified**: `packages/core-types/src/schemas/control-plane.test.ts`
  — added 15 tests across three new `describe` blocks

---

## What the Next Session Should Do

Immediate next steps (ordered by Phase 1 exit-criterion impact):

1. **(Task 22 / Phase 1.8) RBAC runtime enforcement.** Per the prior
   handover: read the user's `RoleName` from `role_assignments` and
   enforce per-route permissions before the INSERT/UPDATE. For the new
   PATCH route, the relevant permission is `project:status:change`
   (or similar — verify against `packages/core-types/src/schemas/rbac.ts`).
   First step: wire `getRolePermissions()` into the existing POST +
   PATCH routes as a gate, then extend it.

2. **(Task 23 / Phase 1.9) User invitation flow.** The exit criterion
   explicitly mentions inviting a user. The DB support exists
   (`verification_tokens`, `users.status = 'invited'`) but nothing
   in the app uses it. Small slice: add `POST /api/invitations` that
   creates a verification token and (later) emails it.

3. **(Task 24 — optional) Extend PATCH pattern to tasks and
   generation-runs.** The `insertStatusChangeEntry()` helper already
   handles their FSMs; only the route + transition graph need to be
   added. Task's `completedAt` bookkeeping makes this a natural next
   step once tasks can be queued/executed (Phase 2 territory).

Out of scope reminders (recurring):
- **Do NOT** revise ADR-0005 (Server Actions) — revisit triggers not met.
- **Do NOT** extract shared `<DataTable>`/`<StatusBadge>` — revisit
  only when 4th CRUD page arrives per ADR-0007.
- **Do NOT** add workspace-level org gating — open sign-up is Phase 1's
  explicit decision; org-gating is Phase 9.
- **Do NOT** promote `audit.ts` into `@heynxt/persistence` yet — only
  one consumer.
- **Do NOT** support `archived → active` restoration yet — that's a
  Phase 9 governance concern; v1 treats `archived` as terminal
  (see project schema header comment).

---

## Session-Ready Checklist

- [x] Read CLAUDE.md
- [x] Read buildplan.md
- [x] Read prior HANDOVER.md
- [x] Task 21 — first PATCH route (project status transition)
- [x] `pnpm typecheck` → 13/13 ✅
- [x] `pnpm build` → 7/7 ✅ (new `/api/projects/[id]` route visible in output)
- [x] `pnpm --filter @heynxt/core-types test` → 83/83 ✅
- [x] HANDOVER.md updated
- [ ] Commit on `main` (pending — commit before ending session)

Paste into your prompt before continuing:

```
You are resuming heynxt-core after Task 21 code-complete.

Commits on main (most recent first):
  <new sha> feat(web): Task 21 — PATCH route (project status transition) + transition graph
  aa04f1d   feat(web): Task 20 — activity log writes on entity creation
  4815845   feat(web): Task 19 — session context for UI forms (live dropdowns)
  ba7af8b   feat: Task 17 — ADR-0006 createdBy session sweep
  d65cff6   feat(web): Task 16 — session-aware header (UserMenu + sign-in/out)
  dc09eb2   feat(web): Task 15 — middleware scaffold (auth gate)
  208c870   feat(web): Task 14 — auth scaffold (NextAuth v5 + Drizzle)

Current state:
  - Project FSM defined in core-types project.ts:
    ALLOWED_PROJECT_STATUS_TRANSITIONS + isProjectStatusTransitionAllowed()
    + UpdateProjectStatusInput schema.
  - PATCH /api/projects/[id] at apps/web/src/app/api/projects/[id]/route.ts:
    auth-gated, validates UUID id, fetches project, validates transition,
    same-status no-op, UPDATE status+updatedAt, audit via
    insertStatusChangeEntry() (best-effort). Returns 200 project.
  - audit.ts `insertStatusChangeEntry()` is now wired to exactly one
    route — the enabler for "activity log records state transitions".
  - core-types tests: 83 passed (+15 new for project transitions);
    typecheck 13/13; build 7/7.

Next recommended task:
  Task 22 — RBAC runtime enforcement via getRolePermissions() on POST + PATCH.
  Task 23 — User invitation flow (POST /api/invitations).

Phase 1 exit criteria still open:
  - Activity log state transitions ✅ (now fully covered).
  - Invite flow: not implemented yet.
  - RBAC runtime gates: not implemented yet.
  - CI pipeline: does not exist.

Hard rules (from CLAUDE.md / prior handover):
  - Don't redo Tasks 1–21.
  - Follow small-slice principle.
  - Verify after each step.
```
