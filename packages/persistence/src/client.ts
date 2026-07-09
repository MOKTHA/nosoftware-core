/**
 * Drizzle database client — singleton factory.
 *
 * Reads DATABASE_URL from the environment. Uses the `postgres` (postgres.js)
 * driver for local Postgres 15 dev (matching `docker-compose.yml`). For Neon
 * serverless production, add `@neondatabase/serverless` and swap the driver
 * here — the schema definitions in `./schema/` are driver-agnostic.
 *
 * Why a singleton:
 *   Next.js dev server hot-reloads route handlers, which would otherwise
 *   create a new DB connection per reload and exhaust the connection pool.
 *   Using a module-level binding cached on `globalThis` keeps the same
 *   client across HMR cycles in development, while production (compiled
 *   output) uses a module-scope variable naturally.
 *
 * Usage:
 *   import { db } from '@heynxt/persistence';
 *   // or
 *   import { getDb } from '@heynxt/persistence';
 *   const users = await db.select().from(usersTable);
 *
 * Connection string:
 *   Set DATABASE_URL per .env.example. Local dev default:
 *   postgresql://heynxt:heynxt@localhost:5432/heynxt
 */

import { drizzle, type PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

import * as schema from './schema/index.js';

// Cache the client on `globalThis` so hot-reloading Next.js or Vitest
// doesn't open a new connection on each reload. Typed narrowly to avoid
// leaking `postgres` specifics into the public API.
type DbClient = PostgresJsDatabase<typeof schema>;

declare global {
  // eslint-disable-next-line no-var -- required for globalThis cache key
  var __heynxtDb: DbClient | undefined;
}

function createDb(): DbClient {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error(
      'DATABASE_URL environment variable is not set. ' +
        'Copy .env.example to .env, or set DATABASE_URL directly. ' +
        'Local dev default: postgresql://heynxt:heynxt@localhost:5432/heynxt',
    );
  }

  const client = postgres(connectionString, {
    // Sensible defaults for both dev and Neon serverless.
    max: 10,
    idle_timeout: 20,
    connect_timeout: 10,
  });

  return drizzle(client, { schema });
}

/**
 * Eager accessor — returns the shared Drizzle client, creating it on first
 * call. Subsequent calls return the same instance.
 */
export function getDb(): DbClient {
  if (globalThis.__heynxtDb === undefined) {
    globalThis.__heynxtDb = createDb();
  }
  return globalThis.__heynxtDb;
}

/**
 * Shared singleton — preferred import for most call sites.
 * Equivalent to `getDb()` but evaluates lazily at first import.
 */
export const db: DbClient = new Proxy({} as DbClient, {
  get(_target, prop, receiver) {
    return Reflect.get(getDb(), prop, receiver);
  },
});

/**
 * Type alias for the shared Drizzle client — useful for function signatures
 * in packages that want to accept an explicit client (e.g. for testing or
 * multi-tenant routing).
 */
export type HeyNxtDb = DbClient;
