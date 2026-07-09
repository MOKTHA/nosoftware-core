# @heynxt/web

Next.js application — the primary user interface for the HeyNXT industrial AI app builder platform.

## Purpose

This is the control plane UI that allows users to:
- Browse and select industrial blueprints
- Configure prompt-to-spec transformations
- Manage agent execution and monitor results
- View generated applications and their outputs

## Status

**Phase 1.8 — Task 8: workspaces CRUD page live**

The Next.js 14 App Router app exposes eleven live API endpoints wired through
`@heynxt/persistence` against local Postgres 15, plus a first React Server
Component CRUD page for workspaces:

**UI pages:**
- `/workspaces?orgId=<uuid>` — workspace list + inline create form (RSC list, client form)

**API endpoints:**

| Endpoint | Purpose |
|---|---|
| `GET /api/health` | DB connectivity + timestamp |
| `GET /api/workspaces` | list workspaces for an organization |
| `POST /api/workspaces` | create a workspace |
| `GET /api/projects` | list projects in a workspace |
| `POST /api/projects` | create a project |
| `GET /api/tasks` | list tasks in a workspace (optional project filter) |
| `POST /api/tasks` | create a task |
| `GET /api/generation-runs` | list generation runs in a workspace |
| `POST /api/generation-runs` | create a generation run |
| `GET /api/artifacts` | list artifacts in a workspace |
| `POST /api/artifacts` | create an artifact |

A seed script (`pnpm db:seed`, lives in `packages/persistence/scripts/seed.ts`)
inserts a starting user, org, workspace, projects, and tasks so the API is
usable without hand-`INSERT`ing rows.

Auth, RBAC enforcement, and project/task CRUD pages will follow in later
slices.

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
   - http://localhost:3000/workspaces?orgId=00000000-0000-0000-0000-000000000010 — workspaces UI
   - http://localhost:3000/api/health — JSON health probe
   - http://localhost:3000/api/workspaces — workspace API listing

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

### Generation Runs
- `GET /api/generation-runs?workspaceId=<uuid>[&projectId=<uuid>][&taskId=<uuid>]`
  → `{ generationRuns: GenerationRun[] }`
- `POST /api/generation-runs`
  Body: `{ workspaceId, projectId, taskId, snapshot?, createdBy }`
  → 201 `{ generationRun }`
  Server auto-computes `runNumber` (MAX+1 within the task).
  `status` defaults to `'pending'`. `snapshot` defaults to all-null if omitted.
  400 `FOREIGN_KEY_VIOLATION` when a referenced FK does not exist.

### Artifacts
- `GET /api/artifacts?workspaceId=<uuid>[&generationRunId=<uuid>][&taskId=<uuid>]`
  → `{ artifacts: Artifact[] }`
- `POST /api/artifacts`
  Body: `{ workspaceId, projectId, taskId, generationRunId, kind, storageKind,
  name, mimeType?, textContent?, storageUrl?, storageRef?, contentHash?,
  byteSize?, createdBy }` → 201 `{ artifact }`
  400 `FOREIGN_KEY_VIOLATION` when a referenced FK does not exist.

## Package Dependencies (runtime)

- `@heynxt/core-types` — Zod schemas for request/response validation
- `@heynxt/persistence` — Drizzle client + pgTable definitions
- `drizzle-orm` — query operators (`eq`, `sql`) used directly in route handlers
- `next` / `react` / `react-dom` — framework
- `zod` — runtime input validation
