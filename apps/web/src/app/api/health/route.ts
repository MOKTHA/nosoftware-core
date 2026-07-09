/**
 * GET /api/health — liveness + DB connectivity probe.
 *
 * Returns JSON:
 *   { status: 'ok' | 'degraded', dbConnected: boolean }
 *
 * - 200 when both the app and DB are reachable.
 * - 200 + `status: degraded` when the app is up but DB probe failed —
 *   lets monitoring systems distinguish app-level vs. DB-level failures.
 *
 * The DB probe is a trivial `SELECT 1`. It catches:
 *   - Missing DATABASE_URL env var
 *   - Unreachable Postgres
 *   - Invalid credentials
 *
 * Does NOT prove the schema is migrated (that needs a real table query).
 */

import { NextResponse } from 'next/server';
import { sql } from 'drizzle-orm';
import { getDb } from '@heynxt/persistence';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  let dbConnected = false;
  let errorMessage: string | undefined;

  try {
    const db = getDb();
    await db.execute(sql`SELECT 1 AS ok`);
    dbConnected = true;
  } catch (err) {
    errorMessage =
      err instanceof Error ? err.message : 'Unknown database error';
  }

  const body = {
    status: dbConnected ? 'ok' : 'degraded',
    dbConnected,
    timestamp: new Date().toISOString(),
    ...(errorMessage ? { error: errorMessage } : {}),
  };

  return NextResponse.json(body, {
    // Even when degraded, return 200 — health endpoints reporting a status.
    // Use a separate /ready endpoint (future) for readiness that 503s.
    status: 200,
  });
}
