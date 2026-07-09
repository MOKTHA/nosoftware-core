# Handover — Task 20 complete; audit log now writes on every entity creation

**Date**: 2026-07-09
**Status**: Task 20 code-complete and ready to commit on `main`.
Build + typecheck + core-types tests pass.

---

## What Was Done (this session)

### Task 20 — Activity log writes on entity creation (lifted from schema-only)

The `audit_log` table and its Zod schema (`AuditLogEntry`, `AuditEntityType`,
`AuditAction`, `createStatusChangeEntry`) existed from the foundation but
nothing ever wrote to it (confirmed: grep showed zero write sites).

This slice introduces a single `insertAuditEntry()` helper in
`apps/web/src/lib/audit.ts` and wires it into **all five** POST routes —
`/api/workspaces`, `/api/projects`, `/api/tasks`,
`/api/generation-runs`, `/api/artifacts` — so every entity
creation now produces one append-only row in the `audit_log` table, scoped
to the correct organization.

**New helper (1 file):**

- `apps/web/src/lib/audit.ts` — exports:
  - `insertAuditEntry(params)` — the single writer for the `audit_log` table.
    Resolves the organization from `organizationId` or by workspace lookup,
    validates the entry via `AuditLogEntry.parse`, then inserts.
  - `resolveOrganizationId(params)` — internal/exported for tests.
  - `insertStatusChangeEntry(params)` — convenience wrapper around the
    core-types `createStatusChangeEntry` factory (ready for the first
    PATCH/PUT route; not yet wired to any).
  - `OrgScope` — shared type for org-scope resolution.

**Design decisions:**

- **Best-effort audit**: if the audit insert fails, the failure is
  `console.error`-logged but the caller still returns its 201. Audit is a
  governance concern, not a correctness concern for the user's request.
- **Zod validation before insert**: the entry is round-tripped through
  `AuditLogEntry.parse` so enum/drift bugs surface at write time rather
  than as a silent Postgres error.
- **Workspace → org lookup**: POST `/api/projects`, `/api/tasks`,
  `/api/generation-runs`, `/api/artifacts` only know a `workspaceId`. The
  helper resolves the owning organization via a primary-key query on
  `workspaces`. If the workspace doesn't exist, the audit insert logs an
  error and skips (the primary INSERT still succeeded).
- **No circular imports**: the helper lives in the web app (`apps/web/src/lib/`),
  not in `@heynxt/persistence`, deliberately — if a worker or another
  service later needs it, we'll promote it into the package at that time.

**Routes updated (5):**

| Route | entityType | actorId |
|---|---|---|
| `POST /api/workspaces`       | `workspace`        | session user, or `'system'` if unauthenticated |
| `POST /api/projects`         | `project`          | session user (`requireAuth`) |
| `POST /api/tasks`            | `task`             | session user (`requireAuth`) |
| `POST /api/generation-runs`  | `generation-run`   | session user (`requireAuth`) |
| `POST /api/artifacts`        | `artifact`         | session user (`requireAuth`) |

Workspaces POST is the only one without `requireAuth` (see ADR note in its
header docblock) so it falls back to `actorId: 'system'` for the session-less case.

**Snapshot discipline (per core-types JSDoc):**
Each entry stores only the fields relevant to the `created` action — `id`,
`name`/`title`, `slug`/`type`/`kind`, and `status` — not a full entity dump.
This keeps the audit log lean per the snapshot discipline documented in
`packages/core-types/src/schemas/audit-log.ts`.

**Verification:**
- `pnpm typecheck` → 13/13 ✅
- `pnpm build` → 7/7 ✅
- `pnpm --filter @heynxt/core-types test` → 68/68 ✅

**Pre-existing failure (not a regression):** `@heynxt/persistence`'s
`test` script still fails with "No test files found" — the package has
no tests yet.

---

## What's Left in Phase 1 (remaining exit criteria)

| Exit criterion | Status |
|---|---|
| Activity log records state transitions | ✅ Create events are now recorded. Status-transition recording awaits a PATCH/PUT route that actually changes status (none exist yet — this slice was the enabler). |
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

- **Added**: `apps/web/src/lib/audit.ts` (single writer for audit_log table)
- **Modified**: `apps/web/src/app/api/workspaces/route.ts` (POST now calls `insertAuditEntry`)
- **Modified**: `apps/web/src/app/api/projects/route.ts` (POST now calls `insertAuditEntry`)
- **Modified**: `apps/web/src/app/api/tasks/route.ts` (POST now calls `insertAuditEntry`)
- **Modified**: `apps/web/src/app/api/generation-runs/route.ts` (POST now calls `insertAuditEntry`)
- **Modified**: `apps/web/src/app/api/artifacts/route.ts` (POST now calls `insertAuditEntry`)

---

## What the Next Session Should Do

Immediate next steps (ordered by Phase 1 exit-criterion impact):

1. **(Task 21 / Phase 1.7) First PATCH route — status transition with
   audit log.** Pick the simplest entity (`task.status: draft → queued →
   running → succeeded/failed`, or `project.status: draft → active`) and
   add a PATCH endpoint at the appropriate route. Use `insertStatusChangeEntry()`
   for the audit write. This is the minimal piece that turns "activity log
   records state transitions" from "create-only" into actually recording
   transitions, which is what the exit criterion literally says.

2. **(Task 22 / Phase 1.8) RBAC runtime enforcement.** Per the prior handover:
   read the user's `RoleName` from `role_assignments` and enforce
   per-route permissions before the INSERT (e.g. `project:create`
   for `/api/projects` POST). First step: wire `getRolePermissions()`
   into the existing POST routes as a gate, then extend it.

3. **(Task 23 / Phase 1.9) User invitation flow.** The exit criterion
   explicitly mentions inviting a user. The DB support exists
   (`verification_tokens`, `users.status = 'invited'`) but nothing
   in the app uses it. Small slice: add `POST /api/invitations` that
   creates a verification token and (later) emails it.

Out of scope reminders (recurring):
- **Do NOT** revise ADR-0005 (Server Actions) — revisit triggers not met.
- **Do NOT** extract shared `<DataTable>`/`<StatusBadge>` — revisit
  only when 4th CRUD page arrives per ADR-0007.
- **Do NOT** add workspace-level org gating — open sign-up is Phase 1's
  explicit decision; org-gating is Phase 9.
- **Do NOT** promote `audit.ts` into `@heynxt/persistence` yet — only one
  consumer, premature abstraction.

---

## Session-Ready Checklist

- [x] Read CLAUDE.md
- [x] Read buildplan.md
- [x] Read prior HANDOVER.md
- [x] Task 20 — activity log writes on entity creation
- [x] `pnpm typecheck` → 13/13 ✅
- [x] `pnpm build` → 7/7 ✅
- [x] `pnpm --filter @heynxt/core-types test` → 68/68 ✅
- [x] HANDOVER.md updated
- [ ] Commit on `main` (pending — commit before ending session)

Paste into your prompt before continuing:

```
You are resuming heynxt-core after Task 20 code-complete.

Commits on main (most recent first):
  <new sha> feat(web): Task 20 — activity log writes on entity creation
  4815845   feat(web): Task 19 — session context for UI forms (live dropdowns)
  ba7af8b   feat: Task 17 — ADR-0006 createdBy session sweep
  d65cff6   feat(web): Task 16 — session-aware header (UserMenu + sign-in/out)
  dc09eb2   feat(web): Task 15 — middleware scaffold (auth gate)
  208c870   feat(web): Task 14 — auth scaffold (NextAuth v5 + Drizzle)

Current state:
  - insertAuditEntry() helper lives at apps/web/src/lib/audit.ts.
  - All 5 POST routes (workspaces, projects, tasks, generation-runs, artifacts)
    now write an audit_log row on successful INSERT.
  - Snapshot discipline: only create-relevant fields stored (not full dumps).
  - Org scope resolved from organizationId when given, or via workspace lookup.
  - Best-effort: audit failures are logged but never undo the user's 201.
  - core-types tests: 68 passed; typecheck 13/13; build 7/7.

Next recommended task:
  Task 21 — first PATCH route (status-transition) using insertStatusChangeEntry().
  Task 22 — RBAC runtime enforcement via getRolePermissions().

Phase 1 exit criteria still open:
  - Activity log: records CREATED events ✅. Status-transition recording needs
    a PATCH route.
  - Invite flow: not implemented yet.
  - RBAC runtime gates: not implemented yet.
  - CI pipeline: does not exist.

Hard rules (from CLAUDE.md / prior handover):
  - Don't redo Tasks 1–20.
  - Follow small-slice principle.
  - Verify after each step.
```
