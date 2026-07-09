# ADR-0007 — Phase 1 UI Consolidation Pattern

- **Status**: Accepted
- **Date**: 2026-07-09
- **Deciders**: @pskbmohan (session decision, pending team review)
- **Supersedes**: N/A
- **See also**: ADR-0005 (client form pattern), ADR-0006 (`createdBy` sweep),
  Tasks 8 / 9 / 10 in `buildplan.md`

---

## Context

After the control-plane API surface landed in Tasks 1–7 (Zod schemas,
`/api/workspaces`, `/api/projects`, `/api/tasks`, persistence layer,
seed data), three CRUD pages still had to be built:

- `/workspaces?orgId=<uuid>` — Task 8 (workspaces within an org)
- `/projects?workspaceId=<uuid>` — Task 9 (projects within a workspace)
- `/tasks?workspaceId=<uuid>[&projectId=<uuid>]` — Task 10 (tasks)

ADR-0005 already settled the mutation pattern: client-side `fetch` +
`router.refresh()` into existing `/api/*` routes, no Server Actions.
The remaining question was whether each page should be bespoke, or
whether the three should share a single reproducible pattern.

With only three pages the options were narrow: bespoke per entity, or
one shared pattern enforced by convention (no shared component
abstraction yet). The decision below picks the latter, while stopping
short of extracting `<DataTable>` / `<CrudFormShell>` / `<StatusBadge>`
— YAGNI at three pages.

---

## Decision

**Build all three Phase 1 CRUD pages with one shared pattern rather
than bespoke per-entity implementations.**

The pattern, applied identically across `workspaces`, `projects`, and
`tasks`:

- One server page per entity, with URL shape
  `/<entity>?<parentId>=<uuid>`.
- One client `Create<Entity>Form` component per entity, co-located in
  `apps/web/src/app/components/`.
- Inline styles via `React.CSSProperties` file-local tokens — no shared
  CSS module, no Tailwind, no styled-components.
- Shared error helpers from `@/lib/api` (`ApiErrorBody`,
  `NextApiError`, `errorResponse`).
- Shared Zod schemas from `@heynxt/core-types` (`Create*Input`) used
  for both client-side validation and server-side API validation.
- Same soft-redirect behavior: missing `parentId` in URL → Next.js
  `redirect()` to a well-known seed parent; invalid UUID → inline
  error box, no redirect.
- Same inline field-error surfacing pattern (`fieldErrors` state
  `Record<string, string[]>` keyed by field name).

---

## Rationale

1. **Consistency reduces cognitive load.** A developer reading any one
   of the three pages can copy it for a fourth entity without learning
   a new layout. The shape of the server page, the form client
   component, and the inline styles match across all three files.
2. **Cheap to replicate.** Each page is ~150 lines; each form is
   ~200–280 lines. No abstraction needed to justify the cost.
3. **ADR-0005 already justified the mutation pattern.** Consolidation
   is orthogonal — it standardizes the *page shape* and *error
   handling* around the already-chosen fetch+refresh route.
4. **Three pages is too few to extract.** YAGNI. Extracting
   `<DataTable>` or `<CrudFormShell>` now would front-load design cost
   for a surface we're still learning. Document the convention; extract
   when a 4th page forces the question.
5. **Inline styles are intentional.** The app is in Phase 1 local-dev;
   there is no design system. Inline `CSSProperties` tokens at file
   bottom keep styles co-located with the code and avoid committing to
   a styling approach the app may later replace.

---

## Costs / Tradeoffs

- **Duplicated styling code.** Table styles (`thStyle`, `tdStyle`),
  form styles (`inputStyle`, `errStyle`), and badge color literals are
  copy-pasted across three pages. A styling change to one must be
  mirrored in the others.
- **No shared components.** Each page hand-codes its own table, its
  own form layout, its own "status" color logic. A `<StatusBadge>`
  extracting the active/inactive/draft color map would already pay for
  itself, but is deferred.
- **Copy-paste tax scales linearly.** Adding `/generation-runs` or
  `/artifacts` today means copying ~350 lines and tweaking them.
  Acceptable at four pages; becomes the trigger to extract (see
  "Revisit triggers").
- **Inline styles are not themable.** Dark mode or brand-color changes
  require touching every page. Documented as a revisit trigger, not a
  current requirement.

---

## Conventions

The following rules are locked down for any Phase 1 CRUD page built
under this pattern. New pages MUST follow them; deviations require an
ADR update.

1. **Page URL shape.** `/<entity>?<parentId>=<uuid>`. `parentId` is
   always the containing workspace (for projects / tasks) or the
   organization (for workspaces). Tasks accept an optional second
   param (`projectId`).
2. **Missing parentId → `redirect()`.** If the URL lacks the parent
   param entirely, the page uses Next.js `redirect()` to push the user
   to a well-known seed parent (e.g. `SEED_ORG_ID = '…0010'`,
   `SEED_WS_ID = '…0100'`). The user always sees a usable page on
   first visit.
3. **Invalid UUID → inline error, no redirect.** If the param is
   present but fails `safeParse` against the branded ID type, the page
   renders an inline error box. The user can correct the URL manually.
4. **Form POST endpoint.** `/api/<entity>` — always a JSON body, always
   the same shape the API route's Zod handler expects.
5. **Error shape.** `{ error, code, fields? }` produced by
   `@/lib/api` (`ApiErrorBody`, `NextApiError`, `errorResponse`).
   Forms parse this on failure and surface `fields` inline.
6. **`createdBy` is caller-supplied.** Until auth lands (ADR-0006
   sweep), forms send `createdBy` in the body, defaulting to
   `SEED_USER_ID`. Post-auth, the field drops out and the form reads
   the session instead.
7. **Server page directives.** Every page.tsx contains
   `export const dynamic = 'force-dynamic'; export const revalidate = 0;`
   to disable caching during Phase 1 iteration.
8. **Table style tokens at file bottom.** Each page declares
   `const thStyle: React.CSSProperties = { … }` and
   `const tdStyle: React.CSSProperties = { … }` at the bottom of the
   file, used by the list table inline.
9. **Form style tokens at file bottom.** Each form declares
   `const inputStyle: React.CSSProperties = { … }` and
   `const errStyle: React.CSSProperties = { … }` at the bottom, used by
   inputs and per-field error spans.
10. **`<Suspense>` wraps only the list.** The page's top-level layout
    (title, create-form, heading) renders synchronously; only the
    `<EntityList />` sub-component is wrapped in `<Suspense>` with a
    loading fallback. The client form is outside the boundary so it
    never flashes.
11. **Form resets editable fields on success.** After a successful POST
    the form calls `set`ters to clear `name`, `slug`, `description`,
    `inputPrompt`, etc. — but keeps pre-filled parent IDs
    (`organizationId`, `workspaceId`, `projectId`) so the user can
    chain creates without re-selecting the parent.

---

## Revisit Triggers

Reconsider this decision (and likely extract shared components) when
any of the following become true:

- **A 4th CRUD page is added** (e.g. `/generation-runs`,
  `/artifacts`). At four pages the copy-paste tax crosses the
  threshold where `<DataTable>`, `<CrudFormShell>`, and
  `<StatusBadge>` extraction clearly pays for itself.
- **Theming or dark mode is required.** Inline `CSSProperties` tokens
  become a liability; migrate to CSS variables, CSS modules, or a
  design-system token layer before adding theme support.
- **Optimistic UI becomes a product requirement.** The current
  `router.refresh()` re-render produces a brief flash between submit
  and RSC reload. If the product requires "create and see the row
  immediately," this pattern needs either SWR-style revalidation or a
  move to Server Actions with `useOptimistic()` (see ADR-0005).
- **Auth lands.** The form currently sends `createdBy` in the body
  (ADR-0006 concession). When the session sweep happens, the form
  shape changes — `createdBy` is removed from the UI body, and the
  API route reads it from the session. This ADR's conventions 5–6
  need updating in tandem with ADR-0006.

---

## Consequences

- **Any developer reading one page can build the next one.** The
  pattern is reproducible without tribal knowledge; the conventions
  section of this ADR is the reference.
- **The cost of adding a 4th page is explicit.** One more `page.tsx`
  (~150 lines) + one more form component (~200–280 lines), plus the
  matching API route and Zod schema. No new infrastructure.
- **The ADR records the conventions so future pages don't drift.**
  Without this document, a 4th page might silently introduce a
  different layout or styling approach, breaking the consistency this
  ADR preserves.
- **Extraction is cheap when it becomes necessary.** Since the pattern
  is consistent, extracting a shared `<DataTable>` or `<CrudFormShell>`
  later is a matter of pulling the existing duplicated code into one
  place — not redesigning the pages.
- **Phase 1 exit criteria are met.** Workspaces, projects, and tasks
  all have a working browser-exercised CRUD UI backed by the same
  `/api/*` routes and Zod contracts that ADR-0005 established.
