/**
 * Database connection for service workers.
 * Uses Drizzle ORM with PostgreSQL via Neon serverless or local Postgres.
 */

import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool, type PoolClient } from 'pg';
import * as schema from '@heynxt/persistence';

const DATABASE_URL = process.env.DATABASE_URL ?? 'postgresql://heynxt:heynxt@localhost:5432/heynxt';

// Create connection pool (shared across workers)
export const pool = new Pool({
  connectionString: DATABASE_URL,
  max: 20, // Max concurrent connections from worker service
});

// Drizzle ORM instance
export const db = drizzle(pool, { schema });

/**
 * Get a client from the connection pool.
 * Caller is responsible for releasing the client.
 */
export async function getClient(): Promise<PoolClient> {
  return pool.connect();
}

/**
 * Execute a callback with an acquired database client.
 * Ensures proper release even if error occurs.
 */
export async function withTransaction<T>(
  fn: (client: PoolClient) => Promise<T>
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
