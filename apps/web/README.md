# @heynxt/web

Next.js application — the primary user interface for the HeyNXT industrial AI app builder platform.

## Purpose

This is the control plane UI that allows users to:
- Browse and select industrial blueprints
- Configure prompt-to-spec transformations
- Manage agent execution and monitor results
- View generated applications and their outputs

## Status

**Phase 1.6 — Task 6: workspaces, projects, and tasks APIs live**

The Next.js 14 App Router app exposes seven live API endpoints wired through
`@heynxt/persistence` against local Postgres 15:

| Endpoint | Purpose |
|---|---|
| `GET /api/health` | DB connectivity + timestamp |
| `GET /api/workspaces` | list workspaces for an organization |
| `POST /api/workspaces` | create a workspace |
| `GET /api/projects` | list projects in a workspace |
| `POST /api/projects` | create a project |
| `GET /api/tasks` | list tasks in a workspace (optional project filter) |
| `POST /api/tasks` | create a task |

A seed script (`pnpm db:seed`, lives in `packages/persistence/scripts/seed.ts`)
inserts a starting user, org, workspace, projects, and tasks so the API is
usable without hand-`INSERT`ing rows.

Auth, RBAC enforcement, and full React Server Component CRUD pages will
follow in later slices.

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

All endpoints return JSON. Error responses follow `{ error, code, fields? }`.

### Health
- `GET /api/health` → `{ status: "ok" | "degraded", dbConnected: boolean, timestamp }`

### Workspaces
- `GET /api/workspaces?organizationId=<uuid>` → `{ workspaces: Workspace[] }`
- `POST /api/workspaces`
  Body: `{ organizationId, name, slug, description?, status? }` → 201 `{ workspace }`
  400 `WORKSPACE_SLUG_CONFLICT` when `(organizationId, slug)` already exists.

### Projects
- `GET /api/projects?workspaceId=<uuid>` → `{ projects: Project[] }`
- `POST /api/projects`
  Body: `{ workspaceId, name, slug, description?, createdBy }` → 201 `{ project }`
  400 `PROJECT_SLUG_CONFLICT` when `(workspaceId, slug)` already exists.
  `status` defaults to `'draft'`; `createdBy` will move to auth session later.

### Tasks
- `GET /api/tasks?workspaceId=<uuid>[&projectId=<uuid>]` → `{ tasks: Task[] }`
- `POST /api/tasks`
  Body: `{ workspaceId, projectId, type, title, description?, inputPrompt?, createdBy }`
  → 201 `{ task }`
  400 `FOREIGN_KEY_VIOLATION` when a referenced FK does not exist.
  `status` defaults to `'draft'`.

## Package Dependencies (runtime)

- `@heynxt/core-types` — Zod schemas for request/response validation
- `@heynxt/persistence` — Drizzle client + pgTable definitions
- `drizzle-orm` — query operators (`eq`, `sql`) used directly in route handlers
- `next` / `react` / `react-dom` — framework
- `zod` — runtime input validation
