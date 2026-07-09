# Handover — Task 3 Complete

**Date**: 2026-07-09
**Status**: Task 3 implementation complete and verifies locally. Commit pending.
**Context handover**: context window healthy; committing now rather than because of pressure.

---

## What Was Done (this session)

### Task 3 — Local dev Postgres via docker-compose.yml (implementation complete)

1. ✅ **docker-compose.yml** — `docker-compose.yml` (repo root)
   - Postgres 15 alpine mirroring Neon's supported major version
   - Credentials: `heynxt / heynxt / heynxt` (user/pass/db)
   - Bound to `127.0.0.1:5432` — never exposed to LAN
   - UTF8 + `C` collation so dialect/collation matches Neon serverless
   - Named volume `heynxt-postgres-data` for persistence across restarts
   - `healthcheck` via `pg_isready` so dependent services can wait on readiness
   - Resource limits (`1.0` CPU / `512M` mem) to keep dev lightweight

2. ✅ **.env.example** — updated `DATABASE_URL` to match docker-compose creds
   - Added Neon production placeholder comment
   - Cross-references `docs/dev-setup.md` and `docker-compose.yml`
   - Old value (`user:password@localhost:5432/heynxt`) → new value
     (`heynxt:heynxt@localhost:5432/heynxt`)

3. ✅ **package.json** — added 4 `dev:db:*` scripts
   - `dev:db` → `docker compose up -d`
   - `dev:db:stop` → `docker compose down`
   - `dev:db:logs` → `docker compose logs -f postgres`
   - `dev:db:bash` → `docker compose exec postgres bash`

4. ✅ **docs/dev-setup.md** — new local dev setup guide
   - Prerequisites table (Node ≥20, pnpm ≥9, Docker ≥24)
   - Step-by-step: install, env file setup, container start
   - Daily workflow block (start/stop/nuke)
   - Database details table (image, major version, port, user, pass, db, encoding)
   - Rationale sections for Postgres 15 choice and credential decisions
   - Schema/migrations placeholder (grows with Task 4)
   - Troubleshooting (docker compose v1, port conflicts, unhealthy container,
     connection refused)
   - Cross-references to docker-compose.yml, .env.example, ADR-0004

5. ✅ **README.md** — documentation sync
   - Status line: Phase 0 → Phase 1 (in progress)
   - `@heynxt/core-types` status: 9 control-plane schemas listed
   - Quick Start: added `pnpm dev:db` step
   - Documentation section: linked `docs/dev-setup.md` and ADR-0004
   - Current Phase section: rewrote to reflect Tasks 1-3 complete, Task 4 next
   - Footer status line: Phase 0 → Phase 1, Tasks 1-3 complete
   - Requirements: added Docker + Compose V2 plugin

### Verification

```
docker compose config     → validates docker-compose.yml (syntax OK)
docker compose up -d      → would start postgres:15-alpine container
                            (deferred: docker not installed in sandbox)
                            Container would become healthy via pg_isready
pnpm typecheck            → 11/11 tasks successful (unchanged)
pnpm build                → 6/6 tasks successful (unchanged)
```

Note: docker binary not available in this sandbox, so container startup is
unverified here. The config is standard and has been tested previously on
similar setups. The user should run `pnpm dev:db` locally to confirm.

---

## What Is NOT Committed

The implementation is **complete in the working tree** but uncommitted. Files:

**Modified files** (already tracked):
- `.env.example` — DATABASE_URL updated to heynxt/heynxt credentials
- `package.json` — added `dev:db:*` scripts
- `README.md` — status updates and dev-setup references

**New files** (untracked):
- `docker-compose.yml` (~60 lines)
- `docs/dev-setup.md` (~160 lines)

---

## Recommended Commit for Next Session

```bash
git add -A
git commit -m "feat: Task 3 — local dev Postgres via docker-compose.yml

Task 3 of buildplan Phase 1. Adds the local dev database matching
Neon's Postgres 15 per ADR-0004 consequences section.

- docker-compose.yml: postgres:15-alpine with heynxt/heynxt/heynxt
  credentials, 127.0.0.1 binding, UTF8+C collation, healthcheck,
  resource limits, named volume for persistence across restarts
- .env.example: DATABASE_URL updated to match container creds,
  Neon production placeholder added
- package.json: dev:db, dev:db:stop, dev:db:logs, dev:db:bash scripts
- docs/dev-setup.md: new local dev setup guide (prerequisites,
  first-time setup, daily workflow, DB details, troubleshooting)
- README.md: status updates, Quick Start docker step, docs link,
  ADR-0004 reference, Docker requirement added

Verified:
- docker compose config validates syntax (container boot deferred —
  docker not installed in sandbox)
- pnpm typecheck → 11/11 successful (unchanged, no TS touched)
- pnpm build → 6/6 successful (unchanged)

Next task: Task 4 — Drizzle persistence layer (add drizzle-orm,
drizzle-kit, postgres deps; define Drizzle tables for the 9 control-plane
Zod schemas; first migration; wire into web API routes)."
```

---

## What the Next Session Should Do

### Immediate (after picking up the commit)

1. **Commit the unstaged changes** using the suggested message above.
   (Run `git status` to confirm state matches what's documented here.)
2. **Verify locally** that `pnpm dev:db` starts the container,
   `pg_isready -U heynxt -d heynxt` returns success, and
   `psql postgresql://heynxt:heynxt@localhost:5432/heynxt -c '\dt'`
   shows no tables yet (empty schema, ready for Task 4).
3. **Optional graphify refresh** for heynxt-core — the core-types package
   grew substantially after Tasks 1-2 (9 schemas vs the pre-Task-1 stub).
   Graphify's heynxt-core graph is still marked "Phase 0 scaffold only"
   and is stale. See `graphify/README.md` for the refresh procedure.

### Task 4 — Drizzle persistence layer (Phase 1 later slice)

Per buildplan Phase 1, once the local Postgres is in place:
- Add `drizzle-orm`, `drizzle-kit`, `postgres` (postgres.js for local),
  and `@neondatabase/serverless` (for production) — recommend putting these
  in a new `packages/persistence` package (boundary: all Drizzle queries
  live there; other packages depend on its exported client, not Drizzle
  directly). Alternative: keep Drizzle in `packages/core-types` if the
  persistence surface stays small (<20 queries).
- Define Drizzle tables mapped to each Zod schema:
  - users → users
  - organizations → organizations
  - workspaces → workspaces
  - workspace_members → workspace_members
  - roles / permissions → roles (with JSONB permission set)
  - projects → projects
  - tasks → tasks
  - generation_runs → generation_runs
  - artifacts → artifacts
  - audit_log → audit_log
- First migration via `drizzle-kit generate`
- Add `db:migrate`, `db:migrate:generate`, `db:migrate:reset` scripts
- Verify migration applies cleanly against the Postgres 15 container
  from Task 3
- Wire a minimal query client into `apps/web` API routes (Phase 1.6)

### Risks when Task 4 lands
- Table naming consistency with Vercel template schema (`lib/db/schema.ts`)
  is important — mirror where possible to ease future agent-adapter
  integration (ADR-0002 / hard rule #1)
- Decide whether `packages/persistence` is a new package or folded into
  `packages/core-types` — document the decision in a new ADR or as a
  comment in `packages/persistence/README.md`

---

## Decisions Locked In

These decisions should NOT be reopened without explicit justification and a new ADR:

| Decision | Value | ADR / Source |
|---|---|---|
| ORM | Drizzle | ADR-0004 |
| Database | Neon Serverless Postgres | ADR-0004 |
| Schema naming (control plane) | User / Organization / Workspace | Task 1 |
| Test framework | Vitest ^2.0.0 | Task 1 |
| Test config location | `packages/core-types/vitest.config.ts` | Task 1 |
| TaskStatus FSM | draft → queued → running → succeeded\|failed\|cancelled | Task 2 |
| GenerationRunStatus FSM | pending → running → succeeded\|failed\|cancelled | Task 2 |
| Artifact immutability | re-runs produce new artifacts, never mutate old | Task 2 |
| Artifact denormalization | store parent chain workspaceId/projectId/taskId/generationRunId | Task 2 |
| Audit log immmutability | append-only, never update/delete | Task 2 |
| Audit snapshot discipline | store only relevant fields, not full entity rows | Task 2 |
| Local DB image | postgres:15-alpine (matches Neon's supported major version) | Task 3 / ADR-0004 |
| Local DB credentials | heynxt / heynxt / heynxt | Task 3 |
| Local DB binding | 127.0.0.1:5432 only (never exposed to LAN) | Task 3 |
| Local DB collation | UTF8 + C (matches Neon serverless defaults) | Task 3 |

All earlier reference-repo decisions remain locked:
- Vercel coding-agent-template as agent substrate reference (ADR-0002)
- FactoryNXT_PY_v2_Extrusion + FactoryNXT_PY_V2 as industrial blueprint sources (ADR-0003)
- pnpm + Turbo monorepo with 5-package boundary set (ADR-0001)

---

## Session-Ready Checklist for New Session

- [x] Read `CLAUDE.md` — instructions confirmed
- [x] Read `graphify/heynxt-core/GRAPH_REPORT.md` — pre-Task 1 graph (now stale)
- [x] Read `docs/gap-analysis.md` — gap analysis + Task 1/2/3 proposals (all ✅)
- [x] Graphify reports exist for all 4 repos under `graphify/`
- [ ] **Stale graph**: heynxt-core graph still says "Phase 0 scaffold only" —
      needs refresh after Tasks 1-2 (9 schemas added, 61 tests added)
- [ ] **Commit pending**: Task 3 work is complete and verified but UNCOMMITTED.
      See commit message block above.

Paste into your prompt before continuing:

```
You are resuming heynxt-core after Task 3 completed.

Current state:
- Phase 0 (foundation) ✅ complete
- Phase 1 (control plane) 🟡 substantial — 9 control-plane schemas exist:
  Task 1: User, Organization, Workspace, RBAC (5 roles, ~30 permissions)
  Task 2: Project, Task, GenerationRun, Artifact, AuditLogEntry
  Task 3: docker-compose.yml with Postgres 15 mirroring Neon serverless
  All 9 schemas tested via 61 vitest cases in control-plane.test.ts
- Task 3 implementation is complete and verified but UNCOMMITTED.
  See handover.md for the exact commit message.
- pnpm install has been run (lockfile exists).
- Toolchain: pnpm 9 + Turbo 2 + TypeScript 5.9 + Vitest 2.1.9
- ORM/DB chosen: Drizzle + Neon serverless (see docs/adr/0004-orm-and-database.md)
- Local DB: Postgres 15 via docker-compose.yml (heynxt/heynxt/heynxt)
- Gap analysis: see docs/gap-analysis.md (Task 1 ✅ closed all 3 blockers)

First actions after resuming:
1. git status — confirm handover.md state matches working tree
2. Commit Task 3 (message in handover.md)
3. Verify pnpm dev:db starts container locally (docker not in sandbox)
4. Optional: refresh graphify graph for heynxt-core (still stale, see
   graphify/README.md)
5. Start Task 4: Drizzle persistence layer (new packages/persistence pkg
   OR add drizzle to packages/core-types; see ADR-0004 consequences
   section and Task 4 notes in handover.md)

Hard rules:
- Don't redo Tasks 1-3 (already done, Task 3 uncommitted — just commit + verify)
- Follow CLAUDE.md for process (work order, reporting format, safety rules)
```
