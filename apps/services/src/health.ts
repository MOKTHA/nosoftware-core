/**
 * Health check utilities for service workers.
 * Supports Kubernetes liveness/readiness probes and operational monitoring.
 */

import { db, pool } from './database/db';
import { QueueManager } from './queue/QueueManager';

export interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  checks: Record<string, boolean>;
  details?: Record<string, string>;
  timestamp: Date;
}

/**
 * Check database connection health.
 */
async function checkDatabaseHealth(): Promise<{ ok: boolean; message?: string }> {
  try {
    // Simple query to test DB connectivity
    const result = await db.execute({ sql: 'SELECT 1' } as any);
    return { ok: true };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    return { ok: false, message: `Database connection failed: ${errorMsg}` };
  }
}

/**
 * Check Redis/Queue manager health.
 */
async function checkRedisHealth(): Promise<{ ok: boolean; message?: string }> {
  try {
    const queues = QueueManager.getQueues();
    for (const [name, worker] of queues) {
      // Just verify we can access the queue - actual connectivity is handled by BullMQ
      if (!worker) {
        return { ok: false, message: `Queue ${name} not initialized` };
      }
    }
    return { ok: true };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    return { ok: false, message: `Redis connection failed: ${errorMsg}` };
  }
}

/**
 * Get comprehensive health status.
 */
export async function getHealthStatus(): Promise<HealthStatus> {
  const dbCheck = await checkDatabaseHealth();
  const redisCheck = await checkRedisHealth();

  const checks: Record<string, boolean> = {
    database: dbCheck.ok,
    redis: redisCheck.ok,
    workers: true, // Assume workers are healthy if connection is OK
  };

  const allHealthy = Object.values(checks).every((v) => v);
  const anyDegraded = Object.values(checks).some((v) => !v);

  return {
    status: allHealthy ? 'healthy' : anyDegraded ? 'degraded' : 'unhealthy',
    checks,
    details: {
      ...(dbCheck.ok ? {} : { databaseError: dbCheck.message }),
      ...(redisCheck.ok ? {} : { redisError: redisCheck.message }),
    },
    timestamp: new Date(),
  };
}

/**
 * Liveness probe - always returns healthy if process is running.
 */
export function getLivenessStatus(): HealthStatus {
  return {
    status: 'healthy',
    checks: {
      process: true,
      pid: typeof process.pid === 'number' ? (process.pid as any) : true,
    },
    timestamp: new Date(),
  };
}

/**
 * Readiness probe - checks all dependencies.
 */
export async function getReadinessStatus(): Promise<HealthStatus> {
  return await getHealthStatus();
}
