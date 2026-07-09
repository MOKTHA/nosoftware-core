# Handover — Task 5 (Phase 1.6) Complete

**Date**: 2026-07-09
**Status**: Task 5 implementation complete in the working tree. Commit pending.
**Context handover**: context window healthy; committing after verification.

---

## What Was Done (this session)

### Task 5 — Wire `db` client into `apps/web` API routes (Phase 1.6)

Wired the Drizzle DB client (from `@heynxt/persistence`) into the Next.js control plane app, exposing the first working API endpoints. The app now runs as a real Next.js 14 App Router application, not a stub.

1. ✅ **Drizzle singleton client in `@heynxt/persistence`** (`packages/persistence/src/client.ts`)
   - `getDb()` eager accessor + `db` lazy Proxy for HMR-safe singleton behavior in dev/next
   - `HeyNxtDb` type alias exported for function signatures
   - Reads `DATABASE_URL` from environment; throws with guidance if missing
   - Uses `postgres` (postgres.js) driver with sensible defaults (`max: 10`, `idle_timeout: 20`)
   - Cached on `globalThis` to survive Next.js HMR and Vitest reloads
   - `packages/persistence/src/index.ts` updated to re-export `db`, `getDb`, `HeyNxtDb`

2. ✅ **`CreateWorkspaceInput` added to `@heynxt/core-types`** (`packages/core-types/src/schemas/workspace.ts`)
   - Omits server-generated fields (`id`, `createdAt`, `updatedAt`)
   - Makes `description` and `status` optional (server defaults `status` to `'active'`)
   - Re-exported via existing `export * from './schemas/workspace.js'`

3. ✅ **Next.js 14 App Router converted from echo stub** (`apps/web/`)
   - `package.json` — real `next dev`/`next build`/`next start` scripts; added `drizzle-orm` + workspace packages as deps
   - `next.config.mjs` — `transpilePackages` for `@heynxt/core-types` and `@heynxt/persistence` (ESM workspace packages)
   - `.env.example` — env template matching docker-compose Postgres credentials
   - `src/app/layout.tsx` — root layout with HeyNXT shell (metadata, body styles)
   - `src/app/page.tsx` — landing page documenting live endpoints
   - Deleted previous `src/index.ts` placeholder

4. ✅ **API error-handling helpers** (`apps/web/src/lib/api.ts`)
   - `NextApiError` base class + status-specific factories (`badRequest`, `notFound`, `internalError`)
   - `errorResponse()` converts `NextApiError`, `ZodError`, and unknown errors to canonical `{ error, code, fields? }` JSON bodies
   - `parseJsonBody()` validates Content-Type and parses request JSON
   - Routes use `try { ... } catch (err) { return errorResponse(err) }` pattern

5. ✅ **Three live API endpoints** (`apps/web/src/app/api/*/route.ts`)
   - `GET /api/health` — DB connectivity probe via `db.execute(sql`SELECT 1`)`, returns `{ status, dbConnected, timestamp }`; returns `status: 'ok'` with 200 when healthy, `status: 'degraded'` with 200 when DB unreachable (separate from readiness)
   - `GET /api/workspaces?organizationId=<uuid>` — list workspaces for an org; validates UUID via `WorkspaceId.parse()` before query; returns `{ workspaces: Workspace[] }`; 400 if query param missing
   - `POST /api/workspaces` — create workspace; validates body via `CreateWorkspaceInput.parse()`; generates UUID `id` via `node:crypto.randomUUID()`; returns 201 with `{ workspace: Workspace }`; translates Postgres unique-violation (code `'23505'`) to 400 `WORKSPACE_SLUG_CONFLICT` with field-level errors
   - All routes: `dynamic: 'force-dynamic'`, `revalidate: 0`

6. ✅ **Workspace README updated** (`apps/web/README.md`)
   - Status: "Phase 1.6 — API routes live, DB client wired"
   - Documents local setup flow (Postgres container → migrate → dev)
   - API contract for all three endpoints with example JSON

7. ✅ **Monorepo README updated** (`README.md`)
   - Status line "Next: Workspace CRUD + RBAC enforcement"
   - Task 5 documented in Current Phase section
   - Repository Status line reflects Tasks 1-5 complete

8. ✅ **Verification**
   - `pnpm typecheck` → **exit=0, no errors** (all packages including `@heynxt/web`)
   - `pnpm build` → **exit=0, all packages build**
   - `next build` output shows routes compiled:
     ```
     ┌ ○ /                              (static landing page)
     ├ ○ /_not-found                    (static 404)
     ├ ƒ /api/health                    (dynamic)
     └ ƒ /api/workspaces                (dynamic)
     ```
   - TypeScript strict checks pass: `WorkspaceId`, `CreateWorkspaceInput`, `Workspace` types all wired through `@heynxt/core-types` and back
   - Drizzle `eq()`, `sql` operators typecheck in route handlers
   - Docker daemon not accessible in sandbox — live migration-apply verification deferred to user

---

## What Is NOT Committed

The implementation is **complete in the working tree** but uncommitted. Files:

**New files**:
- `packages/persistence/src/client.ts` — Drizzle singleton client
- `apps/web/src/app/layout.tsx` — root layout
- `apps/web/src/app/page.tsx` — landing page
- `apps/web/src/app/api/health/route.ts` — health endpoint
- `apps/web/src/app/api/workspaces/route.ts` — workspaces CRUD endpoints
- `apps/web/src/lib/api.ts` — API error/response helpers
- `apps/web/next.config.mjs` — Next.js config (transpilePackages)
- `apps/web/.env.example` — env template

**Modified files** (already tracked):
- `apps/web/package.json` — real Next.js scripts + deps (drizzle-orm added)
- `apps/web/README.md` — Phase 1.6 status + API contract docs
- `apps/web/src/index.ts` — **deleted** (was the echo placeholder)
- `packages/persistence/src/index.ts` — added `db`, `getDb`, `HeyNxtDb` exports
- `packages/core-types/src/schemas/workspace.ts` — added `CreateWorkspaceInput`
- `README.md` — Task 5 documented, status updated
- `pnpm-lock.yaml` — updated by `pnpm install` (added `drizzle-orm` to `@heynxt/web` deps)

---

## Recommended Commit for Next Session

```bash
git add -A
git commit -m "feat(web): Task 5 — wire DB client into Next.js API routes

Task 5 of buildplan Phase 1. Converts apps/web from echo stub to a real
Next.js 14 App Router app and wires the Drizzle client from
@heynxt/persistence into three live API endpoints.

@heynxt/persistence additions:
- src/client.ts: singleton Drizzle client factory using postgres.js
  driver; cached on globalThis to survive Next.js HMR + Vitest reloads
- getDb() / db (lazy Proxy) / HeyNxtDb type alias
- index.ts re-exports db, getDb, HeyNxtDb alongside existing schema
  exports

@heynxt/core-types additions:
- CreateWorkspaceInput: omits server-generated id/createdAt/updatedAt;
  makes description/status optional (server defaults status to 'active')

apps/web additions:
- package.json: real next dev/build/start scripts; drizzle-orm added;
  workspace packages as runtime deps
- next.config.mjs: transpilePackages for @heynxt/core-types and
  @heynxt/persistence (ESM workspace packages)
- .env.example: env template matching docker-compose Postgres creds
- layout.tsx: root layout (metadata, HeyNXT shell)
- page.tsx: landing page listing the live /api/* endpoints
- src/lib/api.ts: NextApiError base class; badRequest/notFound/
  internalError factories; errorResponse() for canonical JSON bodies;
  parseJsonBody() for Content-Type validation
- src/app/api/health/route.ts: DB probe via db.execute(sql\`SELECT 1\`);
  returns { status, dbConnected, timestamp }
- src/app/api/workspaces/route.ts:
  - GET ?organizationId=<uuid>: list workspaces; 400 if UUID missing/
    invalid
  - POST: CreateWorkspaceInput validation; server generates UUID via
    node:crypto.randomUUID(); returns 201; translates Postgres unique
    violation (code 23505) to 400 WORKSPACE_SLUG_CONFLICT with
    field-level errors
- All routes: dynamic: 'force-dynamic', revalidate: 0
- README: Phase 1.6 status + API contract docs

Monorepo README updates:
- Task 5 documented in Current Phase section
- Status line: 'Next: Workspace CRUD + RBAC enforcement'
- Repository Status reflects Tasks 1-5 complete

Deleted: apps/web/src/index.ts (echo placeholder)

Verified:
- pnpm typecheck → exit=0, no errors (all 7 packages including
  @heynxt/web)
- pnpm build → exit=0; next build output:
  ✓ Compiled successfully
  Route: / (static), /api/health (dynamic), /api/workspaces (dynamic)
- Full drizzle-orm added to @heynxt/web deps to resolve TS2307
  'Cannot find module drizzle-orm' in route handlers that use eq()
- Docker daemon not accessible in sandbox; live migration-apply
  verification deferred to user

Next task: CRUD pages for workspaces + auth (OAuth) + RBAC enforcement.
See buildplan.md Phase 1 exit criteria."
```

---

## What the Next Session Should Do

### Immediate (after picking up the commit)

1. **Verify migration applies locally** (deferred to this session):
   - Ensure Docker is running: `pnpm dev:db`
   - Wait for container health: `pnpm dev:db:logs` → should show `database system is ready to accept connections`
   - Apply migration: `pnpm db:migrate`
   - Verify tables: `pnpm dev:db:bash -c 'psql -U heynxt -d heynxt -c "\dt"'` (should show all 9 tables)

2. **Smoke-test the API end-to-end**:
   - Start dev server: `cd apps/web && pnpm dev`
   - In another terminal, hit the endpoints:
     ```bash
     curl -s http://localhost:3000/api/health | jq
     # Expected: {"status":"ok","dbConnected":true,"timestamp":"..."}

     # Need an organizationId — either seed one manually or
     # INSERT INTO organizations directly via psql.
     curl -s -X POST http://localhost:3000/api/workspaces \
       -H "Content-Type: application/json" \
       -d '{"organizationId":"<uuid>","name":"Demo","slug":"demo"}' | jq
     # Expected: 201, { workspace: { ... } }

     curl -s "http://localhost:3000/api/workspaces?organizationId=<uuid>" | jq
     # Expected: 200, { workspaces: [...] }
     ```

3. **Optional graphify refresh** for heynxt-core — `apps/web` is now a real app,
   not just a stub; the current graph still marks it as placeholder. See
   `graphify/README.md` for refresh procedure.

### Next task: build outward on the control plane

Pick one of (in order of unlocking value):

- **Seed script for test data** — add a tiny script (e.g. `scripts/seed.ts` at repo root, or `apps/web/scripts/seed.ts`) that inserts one `organization`, one `user`, and a couple of `workspaces` via the Drizzle client. This unblocks manual API testing without needing to hand-INSERT via `psql`.

- **CRUD pages for workspaces** — Server Components under `apps/web/src/app/workspaces/` that read from the DB via the persistence client, plus a form to create new ones (using Server Actions or a form that POSTs to `/api/workspaces`).

- **Auth scaffold** — NextAuth.js (or the `arctic` library used by the Vercel template) for GitHub OAuth. Store user + session in DB. This unlocks RBAC enforcement on subsequent routes.

- **RBAC enforcement middleware** — once auth exists, add a `middleware.ts` (or per-route helper) that reads the user's `role_assignments` + workspace role, then gates `/api/workspaces/*` mutations on `owner`/`editor` roles. Uses `getRolePermissions()` from `@heynxt/core-types`.

- **Task 6 candidates in buildplan Phase 1 exit criteria** — any of the above directly serve unblocking more exit checkboxes.

### Risks / Open Questions

- **Migration not yet applied against DB** — the `0000_great_sunspot.sql` migration is generated but hasn't been validated end-to-end against a running Postgres in this session. First thing for next session: apply it and verify tables appear.

- **Workspace creation has no auth context** — any caller can POST. Adding auth is the obvious next gap (see seed/Auth bullets above). Until then, `workspace.createdBy` audit field (if added) is not populated.

- **`next.config.mjs` transpilePackages** — this is the right call for consuming in-repo ESM packages, but it adds cold-start cost to `next dev`. If startup time becomes noticeable, consider bundling `@heynxt/*` packages to `dist/` in a `predev` script (already happens for packages via `tsc`).

- **API error code list is undocumented** — right now, error codes (`MISSING_ORGANIZATION_ID`, `WORKSPACE_SLUG_CONFLICT`, etc.) are ad-hoc per route. Consider a registry in `apps/web/src/lib/api-errors.ts` as the API surface grows, or generate the list into a doc.

- **Neon serverless driver parity** — the current client uses `postgres` (postgres.js), which works for local dev. For production Neon serverless, the `@neondatabase/serverless` driver (which uses HTTP) is preferred. The singleton factory is in a good position to branch on `process.env.NODE_ENV` or a `DB_DRIVER` env var when needed.

---

## Decisions Locked In (This Session)

These decisions should NOT be reopened without explicit justification and a new ADR:

| Decision | Value | Rationale |
|---|---|---|
| DB client location | `packages/persistence/src/client.ts` | Keeps DB coupling at the package boundary (per ADR-0001 principles); `@heynxt/web` imports `db` from `@heynxt/persistence`, not a bespoke client file |
| Singleton pattern | `globalThis` cache + `postgres()` driver | Survives Next.js HMR (dev) and Vitest reloads; avoids connection exhaustion |
| Driver choice for Phase 1.6 | `postgres` (postgres.js) | Matches docker-compose Postgres 15 locally; Neon serverless is future work (Phase 9 production) |
| Connection pool defaults | `max: 10`, `idle_timeout: 20`, `connect_timeout: 10` | Conservative dev defaults; tune in prod once load profile is known |
| Next.js config | `transpilePackages: ['@heynxt/core-types', '@heynxt/persistence']` | ESM workspace packages need to be bundled; this is the standard Next.js way |
| API error shape | `{ error, code, fields? }` JSON | Uniform error contract across API routes; field-level errors renderable in forms |
| Workspace creation flow | Server generates `id`, `createdAt`, `updatedAt`; `status` defaults to `'active'` | Mirrors the Zod `.default('active')` contract; client doesn't set server-controlled fields |
| Postgres unique-violation translation | Translate `code === '23505'` to `WORKSPACE_SLUG_CONFLICT` with field errors | Gives UI a typed error to render; avoids exposing raw DB codes to clients |
| Health endpoint posture | 200 + `status: 'degraded'` rather than 503 | Health *reports* status; readiness (future endpoint) should use 503. Separation of concerns |

All earlier decisions from prior sessions remain locked — see prior handovers
for the full table (ORM=Drizzle, DB=Neon, schema naming=User/Org/Workspace,
test=Vitest, TaskStatus FSM, GenerationRunStatus FSM, Task 3 decisions re
Postgres 15 alpine / local creds / 127.0.0.1 binding, Task 4 decisions re
camelCase columns / JSONB typing / migrations).

---

## Verification Output (captured this session)

```
$ pnpm typecheck
exit=0  (no errors in any package, all 7 build cleanly)

$ pnpm build
exit=0  (Next.js build: ✓ Compiled successfully; 4 routes generated)

Route (app)                              Size     First Load JS
┌ ○ /                                    142 B          87.3 kB
├ ○ /_not-found                          872 B          88.1 kB
├ ƒ /api/health                          0 B                0 B
└ ƒ /api/workspaces                      0 B                0 B
+ First Load JS shared by all            87.2 kB

$ pnpm --filter @heynxt/persistence typecheck → PASS
$ pnpm --filter @heynxt/persistence build → PASS (client.ts → dist/client.js/.d.ts)
$ pnpm --filter @heynxt/web typecheck → PASS
$ pnpm --filter @heynxt/web build → PASS (next build exit=0)
```

**Not verified in this session**:
- Docker compose / live Postgres — sandbox doesn't have Docker daemon access
- `pnpm db:migrate` apply against a real DB — deferred
- Live `curl` against `/api/workspaces` POST → 201 — deferred
- Translation of Postgres unique-violation to 400 at runtime — deferred

---

## Session-Ready Checklist for New Session

- [x] Read `CLAUDE.md` — instructions confirmed
- [x] Read `buildplan.md` — Phase 1.6 context
- [x] Read `HANDOVER.md` (previous) — Tasks 1-4 context
- [x] Read `docs/gap-analysis.md` — Tasks 1-4 all ✅; Task 5 now ✅
- [ ] **Commit pending**: Task 5 work is complete and verified but UNCOMMITTED.
      See commit message block above.
- [ ] **DB verify pending**: Apply `0000_great_sunspot.sql` migration, then
      smoke-test `/api/workspaces` POST → 201 against live Postgres.

Paste into your prompt before continuing:

```
You are resuming heynxt-core after Task 5 completed.

Current state:
- Phase 0 (foundation) ✅ complete
- Phase 1 (control plane) 🟡 substantial — near complete:
  Task 1: User, Organization, Workspace, RBAC (5 roles, ~30 permissions)
  Task 2: Project, Task, GenerationRun, Artifact, AuditLogEntry
  Task 3: docker-compose.yml with Postgres 15 mirroring Neon serverless
  Task 4: @heynxt/persistence — 9 Drizzle tables, 12 enums, first migration
    - 9 pgTable definitions 1:1 with Zod schemas
    - 19 indexes, composite uniques, FK constraints
    - First migration: drizzle/0000_great_sunspot.sql
  Task 5 (Phase 1.6): apps/web as real Next.js 14 App Router app
    - packages/persistence/src/client.ts: singleton Drizzle client
      (postgres.js driver, globalThis-cache, getDb() + db Proxy + HeyNxtDb)
    - apps/web wired with 3 API routes:
      GET /api/health (DB probe)
      GET /api/workspaces?organizationId=<uuid> (list)
      POST /api/workspaces (create; validates CreateWorkspaceInput;
        handles workspace_slug_conflict)
    - CreateWorkspaceInput added to @heynxt/core-types
    - apps/web/src/lib/api.ts: error handling helpers (NextApiError,
      errorResponse(), parseJsonBody())
    - apps/web/next.config.mjs: transpilePackages for @heynxt/* packages
    - apps/web/.env.example: env template
  All 9 schemas tested via 61 vitest cases in control-plane.test.ts
- Task 5 implementation is complete and verified but UNCOMMITTED.
  See HANDOVER.md for the exact commit message.
- pnpm install has been run (lockfile updated)
- Toolchain: pnpm 9 + Turbo 2 + TypeScript 5.5 + Vitest 2
- Full monorepo typecheck+build: PASS (all 7 packages + app)
- Postgres migration generated but NOT applied (Docker not in sandbox);
  apply + smoke test deferred
- Local Homebrew Postgres on 5432 uses different credentials; user must
  start docker-compose container for Task 3 creds
- ORM/DB chosen: Drizzle + Neon serverless (see docs/adr/0004)
- Gap analysis: see docs/gap-analysis.md (Tasks 1-5 all ✅)
- 6 packages + 1 real Next.js app now

First actions after resuming:
1. git status — confirm working tree matches HANDOVER.md state
2. Commit Task 5 (message in HANDOVER.md)
3. docker compose up -d, then pnpm db:migrate applies 0000_great_sunspot.sql
4. Smoke-test the API end-to-end via curl against /api/health and
   /api/workspaces POST/GET (see HANDOVER.md for the smoke-test script)
5. Optional: refresh graphify graph for heynxt-core
6. Pick next task: seed script OR CRUD pages OR auth scaffold OR RBAC

Hard rules:
- Don't redo Tasks 1-5 (Task 5 uncommitted — just commit + verify)
- Follow CLAUDE.md for process (work order, reporting format, safety)
```
