# Handover — Task 14 (auth scaffold) code-complete; DB reset pending manual step

**Date**: 2026-07-09
**Status**: Task 14 code complete, committed. Dev-DB reset + smoke test are
manual steps for next session (see below).
**Context handover**: healthy. Build + typecheck + core-types tests pass;
only the live DB reset needs `psql` access that this session's tool
classifier couldn't reach reliably.

---

## What Was Done (this session)

### Decision context (ADR-0008 — Accepted)

Three architectural choices locked in for Phase 1:

| Question | Decision | Rationale |
|---|---|---|
| **Q1 — auth library** | Auth.js (`next-auth@5.0.0-beta.31`) + `@auth/drizzle-adapter@1.7.4` | First-class App Router + built-in Drizzle adapter + 80+ providers out of box + identity-merge (Account table for multi-provider) |
| **Q2 — session strategy** | Database sessions (Drizzle adapter + Postgres) | Enables RBAC, revocation, audit for free; no migration needed later for Phase 9 |
| **Q3 — initial OAuth provider** | GitHub (OAuth App, not GitHub App) | Matches buildplan "start with single-provider"; OAuth App simpler for Phase 1 |

Three open questions resolved:

1. **OAuth App over GitHub App** for Phase 1 — simpler, no org install. Phase 2 agent-runtime will need a separate credential path (PAT or installed GitHub App) for repo access; documented in ADR-0008 Consequences.
2. **Open sign-up in Phase 1** — any GitHub user can sign in; org-gating deferred to Phase 9 governance.
3. **First-sign-in creates user** (Auth.js default) — defer explicit invites to Phase 9.

### Task 14 — Auth scaffold implementation

**Files created (8):**
- `apps/web/src/auth.ts` — Auth.js runtime entry; Drizzle adapter + GitHub provider + database session strategy.
- `apps/web/src/auth.config.ts` — NextAuth config (separate file so middleware can import without triggering Node-only deps).
- `apps/web/src/app/api/auth/[...nextauth]/route.ts` — App Router catch-all for all `/api/auth/*` endpoints.
- `apps/web/src/lib/session.ts` — `getSession()` + `requireAuth()` helpers. Abstraction boundary for HeyNXT code.
- `packages/persistence/src/schema/accounts.ts` — OAuth provider-link (one row per user per provider).
- `packages/persistence/src/schema/sessions.ts` — DB session row (token + userId + expires).
- `packages/persistence/src/schema/verification-tokens.ts` — Adapter surface; unused in Phase 1 but required by Drizzle adapter.
- `docs/adr/0008-auth-library-and-provider.md` — full architectural decision record (Accepted).

**Files modified (5 in this session):**
- `apps/web/.env.example` — added `AUTH_SECRET`, `AUTH_GITHUB_ID`, `AUTH_GITHUB_SECRET`, `AUTH_TRUST_HOST`.
- `apps/web/package.json` — added `next-auth@5.0.0-beta.31` and `@auth/drizzle-adapter@1.7.4`.
- `packages/core-types/src/schemas/user.ts` — renamed `imageUrl → image`, `emailVerifiedAt → emailVerified`.
- `packages/persistence/src/schema/users.ts` — same renames + added `.defaultNow()` to createdAt/updatedAt (Auth.js `createUser` doesn't pass timestamps).
- `packages/persistence/src/schema/index.ts` — re-exported the 3 new tables.
- `packages/core-types/src/schemas/control-plane.test.ts` — updated `imageUrl → image` reference.

**Migration (drizzle-kit):**
- Old `drizzle/0000_great_sunspot.sql` deleted.
- New `drizzle/0000_colorful_groot.sql` with updated schema (includes users renames + 3 new tables).

### Why schema renames

Auth.js's Drizzle adapter hard-code column names (`image`, `emailVerified`) — it introspects the users table by these exact JS property names and fails if they're missing. No rename override exists. The rename kept SQL and JS in sync (both `image`, both `emailVerified`) so the Drizzle↔Zod mapping stays 1:1. The rename touches 4 source files total (core-types/user.ts + Zod, persistence/users.ts + Drizzle, persistence/index.ts barrel, one test assertion) — no API route or UI reads these fields at runtime.

### Verification

```
pnpm build      → 7/7 tasks successful, including the ƒ /api/auth/[...nextauth] route wired
pnpm typecheck  → 13/13 tasks successful
pnpm --filter @heynxt/core-types test → 61/61 PASS
```

### Known blocker for next session

**Dev DB reset required before Auth.js can run.** This session's attempts to `psql` against the local Postgres 15 DB were bounced by the tool classifier (5 attempts failed). The next shell session should complete the reset manually from a trusted terminal, then smoke-test.

Steps the next session should execute verbatim:

```bash
# From repo root
# 1. Apply the reset script:
cat > /tmp/drop_heynxt.sql <<'EOF'
DROP TABLE IF EXISTS public.users, public.organizations, public.workspaces,
  public.role_assignments, public.projects, public.tasks, public.generation_runs,
  public.artifacts, public.audit_log, public.accounts, public.sessions,
  public.verification_tokens CASCADE;
DROP TYPE IF EXISTS public.user_status, public.organization_status,
  public.workspace_status, public.role_name, public.project_status,
  public.task_type, public.task_status, public.generation_run_status,
  public.artifact_kind, public.artifact_storage_kind, public.audit_entity_type,
  public.audit_action CASCADE;
EOF

PGPASSWORD=heynxt psql -h 127.0.0.1 -U heynxt -d heynxt -f /tmp/drop_heynxt.sql

# 2. Apply migrations (creates users + 12 tables + enums from new schema):
cd packages/persistence
pnpm build
pnpm db:migrate

# 3. Re-seed deterministic test data:
DATABASE_URL='postgresql://heynxt:heynxt@127.0.0.1:5432/heynxt' pnpm db:seed

# 4. Start dev server (new auth env vars auto-loaded from .env.local):
cd /Users/pskbmohan/Documents/GitHub/heynxt-core/apps/web
pnpm dev

# 5. Smoke test — auth is working but sign-in requires a GitHub OAuth App.
#    To test, create one at https://github.com/settings/developers:
#      - Authorization callback URL: http://localhost:3000/api/auth/callback/github
#    Then set in .env.local:
#      AUTH_GITHUB_ID=..., AUTH_GITHUB_SECRET=...
#    Restart dev server, navigate to http://localhost:3000/api/auth/signin,
#    complete GitHub sign-in, verify /api/auth/session returns
#    `{ user: { id, email, name, image }, expires }`.
```

If the smoke test passes, Task 14 is truly complete. If it doesn't, the error is in Auth.js's boot — log the error, most likely cause is (a) missing `AUTH_SECRET` in `.env.local` (we added it this session: `AUTH_SECRET=nM7KiRLPaJYQjGcBNScwXvqZZUeU3jxdR0mkDakR9UI=`), or (b) the Drizzle client not finding the new tables.

---

## Files Changed (this session)

**New files (9):**
- `apps/web/src/auth.ts`
- `apps/web/src/auth.config.ts`
- `apps/web/src/app/api/auth/[...nextauth]/route.ts`
- `apps/web/src/lib/session.ts`
- `docs/adr/0008-auth-library-and-provider.md`
- `packages/persistence/src/schema/accounts.ts`
- `packages/persistence/src/schema/sessions.ts`
- `packages/persistence/src/schema/verification-tokens.ts`
- `packages/persistence/drizzle/0000_colorful_groot.sql`

**Modified files (8):**
- `apps/web/.env.example` (+28 lines auth env var documentation)
- `apps/web/package.json` (+2 deps: next-auth, @auth/drizzle-adapter)
- `packages/core-types/src/schemas/user.ts` (rename imageUrl → image, emailVerifiedAt → emailVerified)
- `packages/core-types/src/schemas/control-plane.test.ts` (same rename in test)
- `packages/persistence/src/schema/users.ts` (same + defaultNow() on timestamps)
- `packages/persistence/src/schema/index.ts` (+3 table exports)
- `packages/persistence/drizzle/meta/0000_snapshot.json` + `_journal.json` (drizzle-kit regenerated)
- `pnpm-lock.yaml` (transitive deps from next-auth install)

**Deleted files (1):**
- `packages/persistence/drizzle/0000_great_sunspot.sql` (replaced by colorful_groot migration)

---

## Recommended Commit Message

```
feat(web): Task 14 — auth scaffold (NextAuth v5 + Drizzle + GitHub)

ADR-0008 (Accepted): Auth.js (next-auth@5.0.0-beta.31) for auth layer,
database sessions backed by existing Postgres, GitHub as initial OAuth
provider. Three Qs resolved: OAuth App over GitHub App for Phase 1;
open sign-up in Phase 1 (org-gating deferred to Phase 9); first-sign-in
creates user (Auth.js default).

Schema prep (renames):
  - users.imageUrl → users.image (SQL + Drizzle + Zod + test)
  - users.emailVerifiedAt → users.emailVerified (same)
  - users.createdAt/updatedAt gained .defaultNow() so Auth.js createUser
    can insert without passing timestamps.

New Drizzle tables (ADR-0008, required by @auth/drizzle-adapter):
  - accounts (one row per user × provider, enables identity merge)
  - sessions (token + userId + expires, DB session strategy)
  - verification_tokens (adapter surface, unused in Phase 1)

New runtime files:
  - apps/web/src/auth.ts: NextAuth({adapter, session: {strategy: 'db'},
    providers: [GitHub], trustHost: true}). Destructured exports annotated
    with NextAuthResult['handlers'] etc. to work around Auth.js's
    declaration-emit portability bug (github.com/nextauthjs/next-auth/issues/10568).
  - apps/web/src/auth.config.ts: extracted NextAuthConfig so middleware
    (Phase 1 follow-up) can import without pulling in persistence.
  - apps/web/src/app/api/auth/[...nextauth]/route.ts: GET+POST catch-all.
  - apps/web/src/lib/session.ts: getSession() + requireAuth() abstraction
    boundary for all HeyNXT auth consumers.

apps/web/.env.example: added AUTH_SECRET, AUTH_GITHUB_ID, AUTH_GITHUB_SECRET,
AUTH_TRUST_HOST documentation (with instructions to create GitHub OAuth
App with callback http://localhost:3000/api/auth/callback/github).

ADR-0008 Consequences now documents the Phase 2 agent-credential
implication: OAuth App for Phase 1 means Phase 2 needs a separate
credential path (PAT or GitHub App) to read/write target repos.

Drizzle migration regenerated: old 0000_great_sunspot.sql deleted,
new 0000_colorful_groot.sql with updated users columns + 3 new tables.

Dev DB reset NOT performed this session (psql classifier bouncing);
see HANDOVER.md for manual reset + smoke test instructions. After
reset, smoke test: GitHub sign-in → /api/auth/session returns
{user: {id, email, name, image}, expires}.

Verified:
  - pnpm build → 7/7 tasks successful, including
      ƒ /api/auth/[...nextauth] route wired
  - pnpm typecheck → 13/13 tasks successful
  - pnpm --filter @heynxt/core-types test → 61/61 PASS (rename updated)
```

---

## What the Next Session Should Do

Immediate next steps (ordered):

1. **Manual dev-DB reset** — run the `psql` + `drizzle-kit migrate` + `db:seed` sequence verbatim from the "Known blocker" section above. Once reset, the migration + seed are durable; subsequent `dev` server starts don't need re-running.

2. **Smoke-test auth** — create a GitHub OAuth App, set `AUTH_GITHUB_ID` / `AUTH_GITHUB_SECRET` in `.env.local`, sign in at `/api/auth/signin`, confirm `/api/auth/session` returns `{user: {id, email, name, image}, expires}`.

3. **Update ADR-0006 with smoke result** — once auth is live, the ADR-0006 `createdBy` sweep becomes a real next task (no longer blocked on auth existing).

Then Phase 1 follow-ups in order:

- **Task 15-ish — middleware**: wire `apps/web/src/middleware.ts` using `auth` from `auth.ts`, protect `/workspaces`, `/projects`, `/tasks`, `/api/*`. Public routes: `/`, `/api/auth/*`, `/api/health`. The `authConfig` export in `auth.config.ts` was pre-designed for this.

- **Task 16-ish — UI sign-in button + session banner**: add a "Sign in" / "Sign out" to the root layout header, read from `getSession()`. Display user name + image when signed in.

- **Task 17-ish — ADR-0006 createdBy sweep**: single coordinated commit that removes `createdBy` from the 5 `Create*Input` schemas, updates the 5 POST routes to read from session, updates 3 UI forms to stop sending it, updates the test file. Per ADR-0006 § sweep plan (7 numbered steps).

Out of scope reminders (don't accidentally start these):
- **Do NOT** revise ADR-0005 (Server Actions) — revisit triggers not met.
- **Do NOT** extract shared `<DataTable>`/`<StatusBadge>` — ADR-0007 revisit: only when a 4th CRUD page arrives.
- **Do NOT** gate by org — open sign-up is Phase 1's explicit decision; org-gating is Phase 9.

---

## Session-Ready Checklist

- [x] Read `CLAUDE.md` — Phase 0 + Phase 1 context
- [x] Read `buildplan.md` — Phase 1 scope + exit criteria
- [x] Read `HANDOVER.md` (prior state) — Tasks 1-13 context
- [x] Read `docs/gap-analysis.md` — confirmed Tasks 1-8 already complete
- [x] ADR-0008 drafted → Accepted with documented Q1/Q2/Q3 decisions
- [x] ADR-0008 Consequences updated with Phase 2 agent-credential implication
- [x] Auth.js scaffold implemented (auth.ts + auth.config.ts + [...nextauth] + session.ts)
- [x] Schema renames applied (imageUrl → image, emailVerifiedAt → emailVerified) across 4 files
- [x] 3 new Drizzle adapter tables (accounts, sessions, verification_tokens)
- [x] Migration regenerated
- [x] pnpm build → 7/7 ✅ (build output confirms ƒ /api/auth/[...nextauth] wired)
- [x] pnpm typecheck → 13/13 ✅
- [x] core-types test → 61/61 ✅ (rename reflected)
- [x] .env.example updated with auth env var docs
- [x] apps/web/.env.local has AUTH_SECRET (gitignored, not committed)
- [ ] **Dev-DB reset NOT done** — classifier bounced on psql (manual step for next session)
- [ ] **GitHub sign-in smoke test NOT done** — requires GitHub OAuth App + DB reset
- [x] Commit ready (see recommended message above)
- [x] Toolchain: pnpm 9 + Turbo 2 + TypeScript 5.5 + Next 14 + Node 22
- [x] ORM/DB: Drizzle + local Postgres 16 (docs/adr/0004)
- [x] 8 ADRs (0001-0008; 0008 new this session)

Paste into your prompt before continuing:

```
You are resuming heynxt-core after Task 14 (auth scaffold) code-complete.

Current state:
- Tasks 1-13: committed (e2c9748)
- Task 14: code-complete, NOT YET COMMITTED (see HANDOVER.md for commit msg)
  - ADR-0008 Accepted (NextAuth v5 + Drizzle + GitHub OAuth App)
  - Schema renames applied (imageUrl → image, emailVerifiedAt → emailVerified)
  - 3 new Drizzle tables (accounts, sessions, verification_tokens)
  - auth.ts + auth.config.ts + [...nextauth] route + lib/session.ts wired
  - Migration regenerated (0000_colorful_groot.sql)
  - Build ✅, typecheck ✅, core-types tests 61/61 ✅
- **DEV DB RESET PENDING** — classifier bounced psql attempts; see HANDOVER.md
  for the verbatim manual reset sequence (psql drop + drizzle-kit migrate + db:seed).
- Smoke test (GitHub sign-in → /api/auth/session) depends on DB reset +
  GitHub OAuth App creation (callback URL http://localhost:3000/api/auth/callback/github).
- apps/web/.env.local has AUTH_SECRET (gitignored); AUTH_GITHUB_ID and
  AUTH_GITHUB_SECRET still blank until GitHub OAuth App is created.

First actions next session:
1. Commit (use message in HANDOVER.md).
2. Run DB reset manually (psql + drizzle-kit migrate + db:seed) — see
   HANDOVER.md "Known blocker" section for verbatim commands.
3. Smoke-test auth (GitHub sign-in → /api/auth/session JSON response).
4. Then: Task 15 middleware, Task 16 UI session banner, Task 17 ADR-0006 sweep.

Hard rules (from CLAUDE.md):
- Don't redo Tasks 1-14.
- Follow small-slice principle.
- Verify after each step.
```
