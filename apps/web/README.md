# @heynxt/web

Next.js application — the primary user interface for the HeyNXT industrial AI app builder platform.

## Purpose

This is the control plane UI that allows users to:
- Browse and select industrial blueprints
- Configure prompt-to-spec transformations
- Manage agent execution and monitor results
- View generated applications and their outputs

## Status

**Phase 1.6 — API routes live, DB client wired**

The app now runs as a real Next.js 14 App Router application (not a stub).
Landing page, `/api/health`, and `/api/workspaces` (GET list + POST create)
are wired through the new `@heynxt/persistence` Drizzle client. Endpoints
query and insert against the local Postgres 15 container from `docker-compose.yml`.

Auth, RBAC enforcement, and full CRUD pages for workspaces/projects/tasks
will follow in later slices.

## Scripts

```bash
pnpm dev        # Start Next.js dev server (http://localhost:3000)
pnpm build      # Build for production
pnpm lint       # Run ESLint
pnpm typecheck  # Type-check without emitting
```

## Local Setup

1. Start the local Postgres container (see repo root):
   ```bash
   pnpm dev:db
   pnpm db:migrate   # apply the Drizzle migration
   ```

2. Copy `.env.example` to `.env.local` (already in `.gitignore`).
   The default `DATABASE_URL` matches `docker-compose.yml`.

3. Start the dev server:
   ```bash
   pnpm dev
   ```

4. Visit:
   - http://localhost:3000 — landing page
   - http://localhost:3000/api/health — JSON health probe
   - http://localhost:3000/api/workspaces — workspace listing

## API Contract

### GET /api/workspaces?organizationId=<uuid>
List workspaces for an organization. Returns `{ workspaces: Workspace[] }`.

### POST /api/workspaces
Create a workspace. Body:
```json
{
  "organizationId": "<uuid>",
  "name": "My Workspace",
  "slug": "my-workspace",
  "description": "optional",
  "status": "active"  // optional; defaults to "active"
}
```
Returns 201 with `{ workspace: Workspace }`.

### GET /api/health
Liveness + DB connectivity probe. Returns `{ status: "ok" | "degraded", dbConnected: boolean, timestamp }`.

Error responses follow a consistent shape:
```json
{ "error": "...", "code": "ERROR_CODE", "fields": { ... } }
```

## Package Dependencies (runtime)

- `@heynxt/core-types` — Zod schemas for request/response validation
- `@heynxt/persistence` — Drizzle client + pgTable definitions
- `drizzle-orm` — query operators (`eq`, `sql`) used directly in route handlers
- `next` / `react` / `react-dom` — framework
- `zod` — runtime input validation
