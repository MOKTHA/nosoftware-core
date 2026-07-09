# Local Development Setup

> How to run HeyNXT Core locally for development. Mirrors production
> (Neon serverless Postgres) via a local Docker container.

---

## Prerequisites

| Tool | Version | Notes |
|---|---|---|
| Node.js | `>= 20.0.0` | LTS recommended |
| pnpm | `>= 9.0.0` | Set via `corepack` or `packageManager` field |
| Docker | `>= 24` | Docker Desktop or engine + compose plugin |
| git | any recent | — |

The repo is configured to use pnpm 9 via the `packageManager` field in
`package.json`. Run `corepack enable` if pnpm isn't available on your PATH.

---

## First-Time Setup

### 1. Install dependencies

```bash
pnpm install
```

This creates `pnpm-lock.yaml` and `node_modules/` across all workspaces.

### 2. Create your local env file

```bash
cp .env.example apps/web/.env
# (and/or any other workspace that needs env vars)
```

The critical value is `DATABASE_URL`, which already defaults to the
credentials used by the local docker-compose:

```
DATABASE_URL=postgresql://heynxt:heynxt@localhost:5432/heynxt
```

These credentials match what `docker-compose.yml` declares
(`POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`). Do **not** change
them locally unless you also update the compose file.

### 3. Start the local Postgres container

```bash
pnpm dev:db
```

Verify the database is reachable:

```bash
pnpm dev:db:logs
# wait for: "database system is ready to accept connections"

# Optional — shell into the container to inspect directly:
pnpm dev:db:bash
# inside container:
psql -U heynxt -d heynxt
```

The first run pulls the `postgres:15-alpine` image (a few MB) and
creates the `heynxt-postgres-data` Docker volume. Data persists across
restarts, so your migrations and seed data survive a `pnpm dev:db:stop`.

---

## Daily Workflow

```bash
pnpm dev:db     # start DB (idempotent — safe to re-run)
pnpm dev        # start all app workspaces (turbo dev)
```

To stop everything:

```bash
pnpm dev:db:stop   # stops the container (volume preserved)
```

To nuke the DB volume and start over (e.g., to test migrations from
scratch):

```bash
pnpm dev:db:stop --volumes
pnpm dev:db
```

---

## Database Details

| Property | Value |
|---|---|
| Image | `postgres:15-alpine` |
| Major version | 15 (matches Neon's supported major) |
| Host | `127.0.0.1` (bound to loopback — never exposed to LAN) |
| Port | `5432` |
| User | `heynxt` |
| Password | `heynxt` |
| Database | `heynxt` |
| Encoding | `UTF8`, collation `C` (matches Neon serverless defaults) |
| Data volume | `heynxt-postgres-data` (named Docker volume) |

### Why Postgres 15?

Neon serverless runs Postgres 15. We use the same major version locally
so that SQL dialect, extension support, and collation semantics behave
identically between dev and production. This prevents a class of bugs
where a migration passes locally but fails in Neon.

### Why these credentials?

- `heynxt / heynxt` — obviously local, unique enough to never collide
  with real credentials.
- `127.0.0.1:5432` binding — prevents accidental exposure on a shared
  network (coffee shop, office LAN). Change this only if you have a
  specific reason (e.g., running the DB on a different host).
- The schema is empty on first boot — Drizzle migrations (planned for
  Task 4 in the build plan) populate tables automatically on app start.

---

## Schema / Migrations

> Status: not yet implemented. This section will grow as Task 4 lands
> the Drizzle persistence layer.

Once migrations are in place, the typical flow is:

```bash
# Generate migration from Drizzle schema changes:
pnpm db:migrate:generate   # runs `drizzle-kit generate`

# Apply migrations to local DB:
pnpm db:migrate            # runs `drizzle-kit migrate`

# Reset local DB (DANGEROUS — wipes data, keeps structure):
pnpm db:migrate:reset
```

---

## Troubleshooting

### `docker compose: command not found`

The standalone `docker-compose` binary (v1) is deprecated. Use the
Compose plugin (`docker compose`) bundled with Docker Desktop /
modern Docker Engine. If you're on an older install, upgrade Docker.

### Port 5432 already in use

You likely have another Postgres running on your machine (homebrew,
another project). Find it and stop it:

```bash
lsof -iTCP:5432 -sTCP:LISTEN
# kill the offending process, OR override the local port:
# In docker-compose.yml, change "127.0.0.1:5432:5432" to
# "127.0.0.1:5433:5432" and update DATABASE_URL to :5433
```

### Container starts unhealthy

Check logs:

```bash
pnpm dev:db:logs
```

Common causes:
- Volume corruption from a prior unclean shutdown → `pnpm dev:db:stop --volumes && pnpm dev:db`
- Port conflict (see above)

### `DATABASE_URL` connection refused

- Confirm the container is healthy: `docker compose ps` → status should be `Up (healthy)`.
- Confirm the URL matches `postgresql://heynxt:heynxt@localhost:5432/heynxt`.
- Try `psql` directly: `psql postgresql://heynxt:heynxt@localhost:5432/heynxt`.

---

## Related

- [`docker-compose.yml`](../docker-compose.yml) — container definition
- [`.env.example`](../.env.example) — environment template
- [`docs/adr/0004-orm-and-database.md`](adr/0004-orm-and-database.md)
  — Drizzle + Neon decision and local-compose rationale
