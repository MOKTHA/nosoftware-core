/**
 * HeyNXT Core Service Workers - Entry Point
 *
 * Starts all service workers for:
 * - Workflow execution (state machines)
 * - Event ingestion (PLC/sensor data)
 * - Rule evaluation (business rules)
 * - Notification dispatch (email/Slack/webhook)
 * - Scheduled KPI computation jobs
 */

import { db, pool } from './database/db';
import { loadEnvConfig } from './config';
import { QueueManager } from './queue/QueueManager';
import {
  createWorkflowExecutorWorker,
  createEventIngestionWorker,
  createRulesEvaluatorWorker,
  createNotificationDispatcherWorker,
} from './workers';
import { KpiComputationJob, QuotaCheckJob } from './jobs';

/**
 * Graceful shutdown handler.
 */
async function gracefulShutdown(signal: string): Promise<void> {
  console.log(`\nReceived ${signal}. Shutting down gracefully...`);

  try {
    // Stop all scheduled jobs first
    await KpiComputationJob.stopAll();
    QuotaCheckJob.stop();

    // Close all workers (allow in-flight jobs to complete)
    const queues = QueueManager.getQueues();
    for (const [name, worker] of queues.entries()) {
      console.log(`Closing worker: ${name}`);
      await worker.close();
    }

    // Close Redis connection
    await QueueManager.disconnectAll();

    // Close database pool
    await pool.end();

    console.log('Shutdown complete');
    process.exit(0);
  } catch (error) {
    console.error('Error during shutdown:', error);
    process.exit(1);
  }
}

/**
 * Main entry point - initialize and start all workers.
 */
async function main(): Promise<void> {
  const config = loadEnvConfig();

  console.log('========================================');
  console.log('HeyNXT Core Service Workers Starting...');
  console.log(`Environment: ${config.NODE_ENV}`);
  console.log('========================================\n');

  // Register signal handlers for graceful shutdown
  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));

  try {
    // Initialize KPI computation jobs (scheduled tasks)
    await KpiComputationJob.initialize();

    // Initialize quota check job (daily at 9 AM)
    QuotaCheckJob.initialize();

    // Start all workers
    const workers = [
      createWorkflowExecutorWorker(),
      createEventIngestionWorker(),
      createRulesEvaluatorWorker(),
      createNotificationDispatcherWorker(),
    ];

    console.log(`\nStarted ${workers.length} workers:`);
    for (const worker of workers) {
      console.log(`  - Worker initialized and polling queue`);
    }

    // Log startup complete
    console.log('\n========================================');
    console.log('Service Workers Running');
    console.log('========================================');
    console.log('Press Ctrl+C to stop\n');

    // Keep process running (workers run in background)
  } catch (error) {
    console.error('Failed to start service workers:', error);
    await gracefulShutdown('UNEXPECTED_ERROR');
    throw error;
  }
}

// Start the service workers
main().catch((error) => {
  console.error('Fatal error in main():', error);
  process.exit(1);
});
