# ADR-0005 — Client Form Pattern (fetch + router.refresh)

- **Status**: Accepted
- **Date**: 2026-07-09
- **Deciders**: @pskbmohan (session decision, pending team review)
- **Supersedes**: N/A
- **See also**: ADR-0004 (ORM + database), Task 8 in `buildplan.md`

---

## Context

Task 8 shipped the first browser-exercised CRUD surface:
`/workspaces?orgId=<uuid>`. The page is a React Server Component that
reads workspaces directly from Postgres via `@heynxt/persistence`, and
it embeds a `<CreateWorkspaceForm>` that mutates via `POST /api/workspaces`.

The form had to choose between two Next.js 14 mutation patterns:

1. **Server Actions** (`'use server'` + `action={createWorkspace}`) —
   Next.js's canonical "mutations from components" story. The action
   runs on the server; the client doesn't need to write a fetch call.
2. **Client-side `fetch` + `router.refresh()`** — classic client
   component calls the existing API route, then asks Next.js to
   re-render the RSC subtree.

Both patterns are supported in Next.js 14. The decision is about which
one we standardize on across the Phase 1 CRUD pages (workspaces,
projects, tasks) and any subsequent UI work.

---

## Decision

**Use client-side `fetch` + `router.refresh()` for Phase 1 CRUD forms.**

The choice is justified by the current state of the codebase and keeps
the slice narrow. Server Actions are not rejected — see "Revisit when"
below.

---

## Rationale

1. **Existing mutation surface is `/api/*` routes.** The API routes we
   built in Tasks 5-7 already implement validation, error shaping,
   FK-violation translation, and response contracts. Reusing them from
   the browser means the form and any future non-browser caller
   (scripts, other services, tests) exercise exactly the same code
   path. With Server Actions we'd either (a) duplicate that logic in
   an action wrapper, or (b) have the action internally call the API
   route handler — both add indirection.

2. **Client-side validation before network call.** The form can call
   `CreateWorkspaceInput.safeParse(body)` in the browser and surface
   Zod errors inline without hitting the server. This matches the
   validation shape of the API exactly (same schema module) and avoids
   a server round-trip for trivial typing mistakes. Server Actions
   *can* also do client-side validation, but the natural pattern with
   Actions is to let the server re-validate authoritative; keeping
   both the fetch route and the Action route consistent requires two
   validation calls instead of one.

3. **Testability.** API routes are unit-testable with standard `fetch`
   against a running server (or by importing the route handler). Tests
   written against `/api/workspaces` in Tasks 5-7 continue to cover
   the mutation path the UI uses. Server Action tests require a
   separate surface to test.

4. **Slice size.** The workspaces page is one page, one form. The
   fetch pattern lets us close the Phase 1 exit criterion without
   designing the server-action boundary that the rest of the app
   would also have to use. Projects and tasks reuse the same
   pattern.

---

## Costs / Tradeoffs

- **Not idiomatic Next.js 14.** Server Actions are the canonical story;
  going fetch+refresh means we're using a less-preferred pattern. The
  team should be aware.
- **Full page revalidation.** `router.refresh()` re-downloads the RSC
  payload for the current route. For the workspaces page this is
  cheap (small list), but the cost grows with the page's data shape.
  A targeted optimistic UI update would be faster.
- **Flash of loading state.** Without optimistic UI, the list shows a
  brief gap between submit and the RSC re-render completing.
  Acceptable for Phase 1; revisit with optimistic updates in Phase 2.

---

## Revisit When

Move to Server Actions if any of the following become true:

- **Auth lands and we need session context in mutations.** Server
  Actions integrate more cleanly with `cookies()` / `headers()` for
  session reads; with fetch+refresh we'd have to thread the session
  through the API route explicitly (which we already do, but the
  indirection grows).
- **Optimistic UI becomes a product requirement.** `useOptimistic()`
  pairs naturally with Server Actions in Next.js 14. If the product
  needs the "create and see the row immediately" feel, Server
  Actions are the right mechanism.
- **The API surface grows a parallel form surface.** If we find
  ourselves writing Action wrappers that just delegate to API routes,
  the indirection is no longer worth it.

When the migration happens, an ADR-0005-revisit should record the
trigger + the migration plan (which pages, what breaks, test changes).

---

## Consequences

- **Phase 1 pages (workspaces, projects, tasks)** use Client Component
  forms with `fetch` + `router.refresh()`. Validate client-side via
  the same `Create*Input` schema the API uses; surface errors inline.
- **API routes remain the canonical mutation path.** They continue to
  be the only place that talks to the DB, so non-browser callers
  (scripts, tests, future agent-adapter callers) share the path.
- **Test surface stays tight.** Tests continue to target
  `/api/*` routes; UI smoke tests exercise those same routes via the
  form.
- **Future migration cost contained.** If we move to Server Actions
  later, the cost is per-form: no shared infrastructure to rewrite.
