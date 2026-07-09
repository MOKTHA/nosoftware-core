# ADR-0008 — Auth Library and OAuth Provider

- **Status**: Accepted
- **Date**: 2026-07-09
- **Deciders**: @pskbmohan
- **Supersedes**: N/A
- **See also**: ADR-0004 (ORM + database), ADR-0006 (`createdBy` sweep),
  `buildplan.md` Phase 1 ("UI scaffolding"),
  `packages/core-types/src/schemas/user.ts` (identity-merge note)

---

## Context

Phase 1 currently has 3 CRUD pages (workspaces, projects, tasks) plus
their backing API routes. Every `Create*Input` schema accepts
`createdBy` as a caller-supplied field (the Phase 1 concession tracked
in ADR-0006). The next Phase 1 exit criteria remaining unmet are:

- "A user can be invited to a workspace" (requires knowing who is
  authenticating).
- "Basic RBAC gates access (owner/editor/viewer)" (requires a session
  to read the role from).

The `User` schema already documents its identity-merge pattern:

> "users authenticate via one or more OAuth providers (GitHub, Vercel).
> Multiple accounts may link to the same user. The connection list lives
> in a separate schema (user-provider link) — see schemas/account.ts
> (deferred to Phase 1 follow-up)."

Three decisions are needed before writing any auth code:

1. **Library**: what auth abstraction to sit on top of.
2. **Session strategy**: stateless JWT or stateful database sessions.
3. **Initial provider(s)**: which OAuth identities to accept first.

---

## Decision

1. **Library**: **Auth.js (`next-auth@5`, a.k.a. NextAuth v5)** — the
   de-facto auth library for Next.js with native App Router support.
2. **Session strategy**: **Database sessions** backed by the existing
   Drizzle + Postgres stack (ADR-0004), using Auth.js's Drizzle
   adapter.
3. **Initial provider**: **GitHub** only. Vercel and/or other providers
   deferred to Phase 9 (governance / scaling).

---

## Rationale

### Why Auth.js (next-auth@5) over arctic

The `buildplan.md` listed both NextAuth.js and `arctic` as candidates.
After evaluation:

| Concern | Auth.js (`next-auth@5`) | `arctic` |
|---|---|---|
| Next.js App Router support | Native (`auth()` works in RSCs, Route Handlers, Server Actions) | Manual — session helpers must be written per framework |
| Drizzle adapter | Built-in (`@auth/drizzle-adapter`) | None — must hand-roll accounts/sessions tables and CRUD |
| Provider ecosystem | 80+ providers (GitHub, Vercel, Google, SAML, …) out of the box | ~25 providers, each with per-provider boilerplate |
| Identity merge (multiple providers → same user) | First-class — `Account` + `User` + `linkAccount()` handle this | Manual linking logic, schema design left to caller |
| Middleware pattern | First-class — `auth()` wraps middleware, attaches session | Must hand-roll edge-compatible session reader |
| Session strategy switch (JWT ↔ DB) | One-line config change | Full rebuild |
| Community / maintenance | ~24k stars, backed by Sidecar, actively maintained | ~4k stars, single maintainer |
| Learning curve for this team | Lower — matches Vercel template patterns | Higher — lower-level |

`arctic` is a fine, lightweight choice. But it trades ~3–5× more
hand-rolled plumbing for reduced abstraction. In Phase 1, where auth
is the **largest remaining gap** and the dependency surface is already
large (Drizzle + Postgres + pnpm workspaces + Turbo + Next 14), the
higher-level abstraction is the smaller slice. Auth.js also aligns
with the Vercel coding-agent-template reference (ADR-0002), which
ships OAuth via `arctic` — using the same shape of auth layer keeps
the mental cost of integrating `@heynxt/agent-adapter` in Phase 2
lower.

Note: the Vercel template uses `arctic` for its OAuth layer. Auth.js
is a *structural* match (session + account tables, provider pattern)
even if the library differs. The adapter contract in
`@heynxt/agent-adapter` does not depend on which OAuth library the
control plane uses.

### Why database sessions over JWT

| Concern | Database sessions | JWT |
|---|---|---|
| RBAC reads (role lookups, permission checks) | Read from session row; revocable per-request | Must embed in token or fetch on every request anyway |
| Account revocation ("kick a user") | Delete session row — takes effect on next request | Impossible until token expires (unless allowlist is maintained, which recreates DB lookup) |
| Workspace-scoped access | `workspace_id` on session row or derived on each check | Same — but token can't be invalidated per-tenant |
| Audit trail (who was on which machine) | Session row has last IP / user agent for free | Token only carries what was encoded at issue time |
| Phase 9 hardening | Easier path — sessions already auditable, already DB-backed | Must migrate to DB sessions anyway; JWT becomes dead code |
| Operational cost | One round-trip per request for session read; mitigated by cookie-based session ID | Stateless reads; no DB hit |

The extra DB round-trip is a non-issue at Phase 1 scale (single
tenant, local dev). Phase 9 (governance) will need audit-able
sessions, and the migration cost of JWT → DB sessions after RBAC and
`createdBy`-sweep are built on JWT is higher than starting with DB
sessions now.

### Why GitHub only as the initial provider

- GitHub is the identity provider already in use for this project
  (the user's repos, the commit chain).
- One provider is explicitly the buildplan's Phase 1 scope
  ("start with single-provider, single-tenant; expand in Phase 9").
- Adding a second provider later is a configuration addition under
  Auth.js; it does not require reworking the session layer because
  Auth.js's identity merge (`Account` table) handles multiple
  providers → same user from day one.
- Vercel is the likely second provider (matches the reference repo)
  but is not required until Phase 2 (agent runtime) or Phase 9
  (governance), depending on deployment choices.

---

## Affected Schema Surface

Auth.js's Drizzle adapter expects three tables that do not yet exist
in `packages/persistence`:

- `accounts` — OAuth provider link (one row per provider per user).
  This is the "user-provider link" the `User` schema's comment refers
  to as `schemas/account.ts`, deferred.
- `sessions` — DB session row (token + userId + expires).
- `verification_tokens` — email verification, password reset, etc.
  Not used in the OAuth-only Phase 1 flow but required by the
  Drizzle adapter's schema surface.

`users` table already exists in `packages/persistence/src/schema/`.
Auth.js expects `email`, `emailVerified`, `name`, `image` on the
users table — all four are already present in
`packages/core-types/src/schemas/user.ts`. The `userStatus` enum is
an extension on top of Auth.js's shape; we'll keep it but ensure the
users table has the four Auth.js-required columns (it does).

The `verification_tokens` table is a required adapter surface, but in
Phase 1 no code path writes to it. This is accepted: the table exists
as part of the adapter contract but remains unused until a future
phase adds email verification or password reset.

---

## Affected Code Surface (preview for next task)

When this ADR is accepted, implementation will touch:

- `apps/web/package.json` — add `next-auth@5`, `@auth/drizzle-adapter`.
- `apps/web/.env.example` — add `AUTH_SECRET`, `AUTH_GITHUB_ID`,
  `AUTH_GITHUB_SECRET`.
- `apps/web/src/auth.ts` (new) — Auth.js configuration (providers,
  adapter, session strategy, callbacks).
- `apps/web/src/app/api/auth/[...nextauth]/route.ts` (new) — single
  App Router route to handle all `/api/auth/*` endpoints.
- `apps/web/src/middleware.ts` (new) — protect `/workspaces`,
  `/projects`, `/tasks`, `/api/*` behind the session. Public routes:
  `/`, `/api/auth/*`, `/api/health`.
- `apps/web/src/app/providers.tsx` (new) — `SessionProvider` wrapper
  for client-side `useSession()` consumers.
- `apps/web/src/app/layout.tsx` — mount `SessionProvider`.
- `apps/web/src/lib/session.ts` (new) — `getSession()` helper +
  `requireAuth()` for route handlers.
- `packages/persistence/src/schema/accounts.ts` (new).
- `packages/persistence/src/schema/sessions.ts` (new).
- `packages/persistence/src/schema/verification-tokens.ts` (new).
- `packages/persistence/src/schema/index.ts` — re-export new tables.
- Seed script (optional) — ensure it doesn't conflict with Auth.js's
  users table shape.

The **smallest enabling first slice** (Task 14) will:

1. Add the ADR (this document) and flip status to Accepted.
2. Install `next-auth@5` + `@auth/drizzle-adapter`.
3. Add the 3 adapter-required tables (accounts, sessions,
   verification_tokens) to `packages/persistence/src/schema/`.
4. Wire up `apps/web/src/auth.ts` with GitHub provider + Drizzle
   adapter + database session strategy.
5. Mount the App Router route at `/api/auth/[...nextauth]`.
6. Verify `/api/auth/session` returns a session object after GitHub
   sign-in (manual smoke test, documented in task report).

Subsequent slices:

- Middleware protection (Task 15-ish).
- `getSession()` / `requireAuth()` helpers for route handlers.
- UI: sign-in button + session banner in the header.
- ADR-0006 sweep (single committed break of `createdBy` from the 5
  `Create*Input` schemas + the 5 API routes + 3 UI forms).

Tasks 14-onwards are NOT in scope for this ADR. This ADR approves the
**decision and the first slice**; subsequent slices proceed under the
usual small-task-per-session rule.

---

## Costs / Tradeoffs

- **Dependency surface added**: `next-auth@5` + its transitive deps
  (jose, oauth4webapi, etc.). Mitigated by Auth.js being the
  de-facto standard; these are already in every Next.js auth-using
  app.
- **Library lock-in**: switching away from Auth.js after RBAC is
  built on it would cost a week. Mitigated by keeping all
  HeyNXT-specific code behind `apps/web/src/lib/session.ts` so the
  abstraction boundary is one file deep.
- **Database session overhead**: one extra query per request.
  Acceptable at Phase 1 scale; revisit in Phase 9 if metrics demand.
- **GitHub-only limitation**: contributors without a GitHub account
  cannot sign up until another provider is added. Acceptable: no
  contributor has sign-up access at all until this ADR lands.
- **`verification_tokens` table is unused in Phase 1**. Acceptable as
  adapter-contract cost; not user-visible.

---

## Consequences

- Phase 1's remaining exit criteria (user invite, RBAC gates) can now
  proceed; Auth.js unblocks both.
- ADR-0006 (`createdBy` sweep) gains its enabling prerequisite — but
  the sweep remains explicitly out of scope for *this* ADR and the
  first implementation slice. The sweep is a follow-up task after
  auth is observable.
- Phase 2 (`@heynxt/agent-adapter`) can reuse the same session helper
  (`apps/web/src/lib/session.ts`) to identify which user triggered a
  task execution, without caring about Auth.js internals.
- Phase 9 (governance) inherits a DB-backed session audit surface and
  an identity-merge `Account` table it can extend with Vercel / SAML
  providers without rework.
- **Phase 2 agent-credential implication** — choosing OAuth App for
  Phase 1 means Phase 2's agent runtime has no built-in path to
  read/write target GitHub repos. The OAuth App only supports
  sign-in; it does not grant repo-scope tokens. When Phase 2
  arrives, the agent runtime will need a separate credential path
  (PAT, GitHub App installation token, or similar) to act on
  repos. Document this as an ADR-0002 follow-up when Phase 2 kicks
  off — not resolved here to keep the Phase 1 slice small.
- **Schema renames (implementation detail)** — to satisfy Auth.js's
  hard-coded Drizzle adapter column expectations, two `users`
  columns were renamed in both Drizzle and Zod:
  `imageUrl` → `image` (SQL and JS), and
  `emailVerifiedAt` → `emailVerified` (SQL and JS). The
  `users.createdAt` / `users.updatedAt` columns gained
  `.defaultNow()` so Auth.js's `createUser` (which does not pass
  timestamps) can insert without failure. The dev DB requires a
  one-time schema reset to apply the renames (see HANDOVER.md).

---

## Exit Criteria for This Decision

The decision is accepted when:

- [ ] This ADR's status is flipped from Proposed → Accepted.
- [ ] A GitHub OAuth App (or GitHub App) exists in
  `github.com/settings/developers` with callback URL
  `http://localhost:3000/api/auth/callback/github`.
- [ ] `AUTH_SECRET`, `AUTH_GITHUB_ID`, `AUTH_GITHUB_SECRET` are in
  `apps/web/.env.local` (untracked) and their non-secret counterparts
  are in `apps/web/.env.example`.
- [ ] A manual smoke test: "sign in with GitHub, `/api/auth/session`
  returns `{user: {id, email, name, image}}`."

---

## Open Questions (for this ADR review)

1. **GitHub App vs. GitHub OAuth App.** OAuth App is simpler to set up
   (no installation, no permissions). GitHub App is more capable
   (can act on repos in Phase 2). Recommendation: start with OAuth
   App, migrate to GitHub App in Phase 2 if agent runtime needs
   repo access. Not settled in this ADR — flagging for review.
2. **Organization membership requirement.** Should sign-up be
   restricted to members of `github.com/pskbmohan` (or a HeyNXT org)
   from day one, or should any GitHub user be able to sign in during
   Phase 1? Recommendation: allow any GitHub user in Phase 1; gate
   by org in Phase 9 (governance). Not settled in this ADR.
3. **Sign-up flow.** Auth.js's default is "sign-in = sign-up" for
   OAuth (first sign-in creates the user row). Do we want an explicit
   "invite" step for the workspace? Recommendation: accept default
   in Phase 1; revisit in Phase 9. Not settled in this ADR.
