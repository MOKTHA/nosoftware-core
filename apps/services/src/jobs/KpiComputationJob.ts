/**
 * KPI computation job - scheduled periodic aggregation of metrics.
 */

import cron from 'node-cron';
import { db, kpiSnapshots, kpiDefinitions, type KpiDefinition } from '@heynxt/persistence';
import { getSmtpConfig, loadEnvConfig } from '../config';

/**
 * Configuration for scheduled KPI computation jobs.
 */
interface KpiJobConfig {
  definitionId: string;
  cronExpression: string; // node-cron expression
  description: string;
}

const DEFAULT_KPI_JOBS: KpiJobConfig[] = [
  {
    definitionId: 'oee',
    cronExpression: '0 */4 * * *', // Every 4 hours
    description: 'Compute Overall Equipment Effectiveness (OEE) snapshot',
  },
  {
    definitionId: 'throughput',
    cronExpression: '0 * * * *', // Hourly
    description: 'Compute production throughput KPI',
  },
  {
    definitionId: 'quality-rate',
    cronExpression: '0 */2 * * *', // Every 2 hours
    description: 'Compute quality rate KPI',
  },
];

/**
 * Scheduled job runner for KPI computation.
 */
export class KpiComputationJob {
  private static jobs: Map<string, cron.ScheduledTask> = new Map();

  /**
   * Initialize all scheduled KPI computation jobs.
   */
  static async initialize(): Promise<void> {
    console.log('Initializing KPI computation jobs...');

    // Load active KPI definitions from database
    const activeDefinitions = await db
      .select({
        id: kpiDefinitions.id,
        name: kpiDefinitions.name,
        cronExpression: kpiDefinitions.cronExpression,
        description: kpiDefinitions.description,
      })
      .from(kpiDefinitions)
      .where(
        // Filter for active KPIs that don't have a scheduled job yet
        db.sql`id NOT IN (SELECT definition_id FROM kpi_calculation_jobs WHERE status = 'active')`
      );

    // Register database-defined jobs
    for (const def of activeDefinitions) {
      this.registerJob(def);
    }

    // Register default jobs if no custom schedules exist
    const existingJobs = await db.select().from(kpiCalculationJobs).where(
      db.and(
        eq(kpiCalculationJobs.status, 'active'),
        eq(kpiCalculationJobs.definitionId, 'oee')
      )
    );

    if (existingJobs.length === 0) {
      for (const job of DEFAULT_KPI_JOBS) {
        this.registerDefaultJob(job);
      }
    }

    console.log(
      `KPI computation jobs initialized: ${this.jobs.size} active schedules`
    );
  }

  /**
   * Register a KPI computation schedule from database definition.
   */
  private static registerJob(def: (typeof kpiDefinitions.$inferSelect) & { cronExpression: string }): void {
    if (!def.cronExpression || !def.id) {
      console.warn(`Invalid KPI definition ${def.id}: missing cron expression`);
      return;
    }

    const jobName = `kpi:${def.id}`;

    // Clear existing schedule if any
    this.jobs.get(jobName)?.stop();

    // Create new scheduled task
    const scheduledTask = cron.schedule(def.cronExpression, async () => {
      console.log(`Executing KPI computation for ${def.name} (${jobName})`);
      await this.executeKpiComputation(def.id, def.name);
    });

    this.jobs.set(jobName, scheduledTask);
    console.log(`Registered KPI job: ${jobName} - ${def.description || 'No description'}`);
  }

  /**
   * Register a default KPI computation schedule.
   */
  private static registerDefaultJob(config: KpiJobConfig): void {
    const jobName = `kpi:${config.definitionId}`;

    if (this.jobs.has(jobName)) {
      return; // Already registered
    }

    const scheduledTask = cron.schedule(config.cronExpression, async () => {
      console.log(`Executing default KPI computation for ${config.description}`);
      await this.executeDefaultKpiComputation(config.definitionId);
    });

    this.jobs.set(jobName, scheduledTask);
  }

  /**
   * Execute KPI computation for a specific definition.
   */
  private static async executeKpiComputation(definitionId: string, name: string): Promise<void> {
    const startTime = Date.now();

    try {
      // Simulate KPI calculation (in production, this would query runtime_events and compute metrics)
      const snapshotData = await this.computeKpiMetrics(definitionId);

      if (!snapshotData) {
        console.warn(`No data available for KPI ${name}`);
        return;
      }

      // Store computation result
      await db.insert(kpiSnapshots).values({
        definitionId,
        timestamp: new Date(),
        value: snapshotData.value,
        metadata: snapshotData.metadata,
        status: 'completed',
        computedAt: new Date(startTime),
      });

      console.log(
        `KPI ${name} computed successfully: value=${snapshotData.value}, duration=${Date.now() - startTime}ms`
      );
    } catch (error) {
      console.error(`Failed to compute KPI ${name}:`, error);

      // Log failed computation
      await db.insert(kpiSnapshots).values({
        definitionId,
        timestamp: new Date(),
        value: null,
        metadata: { error: String(error) },
        status: 'failed',
        computedAt: new Date(startTime),
      });
    }
  }

  /**
   * Execute default KPI computation (OEE, throughput, quality rate).
   */
  private static async executeDefaultKpiComputation(definitionId: string): Promise<void> {
    switch (definitionId) {
      case 'oee':
        await this.executeKpiComputation('oee', 'Overall Equipment Effectiveness');
        break;

      case 'throughput':
        await this.executeKpiComputation('throughput', 'Production Throughput');
        break;

      case 'quality-rate':
        await this.executeKpiComputation('quality-rate', 'Quality Rate');
        break;

      default:
        console.warn(`Unknown default KPI definition: ${definitionId}`);
    }
  }

  /**
   * Compute KPI metrics (placeholder - in production, query runtime_events and compute actual metrics).
   */
  private static async computeKpiMetrics(
    definitionId: string
  ): Promise<{ value: number; metadata: Record<string, any> } | null> {
    // Placeholder implementation - replace with actual KPI computation logic

    switch (definitionId) {
      case 'oee':
        // OEE = Availability × Performance × Quality
        const availability = Math.random() * 0.3 + 0.7; // Simulated: 70-100%
        const performance = Math.random() * 0.2 + 0.8; // Simulated: 80-100%
        const quality = Math.random() * 0.15 + 0.85;   // Simulated: 85-100%

        return {
          value: (availability * performance * quality) * 100,
          metadata: { availability, performance, quality },
        };

      case 'throughput':
        const throughput = Math.floor(Math.random() * 100) + 50; // Simulated: 50-150 units/hour
        return { value: throughput, metadata: { unit: 'units/hour' } };

      case 'quality-rate':
        const qualityRate = Math.random() * 10 + 90; // Simulated: 90-100%
        return { value: qualityRate, metadata: { unit: '%' } };

      default:
        return null;
    }
  }

  /**
   * Stop all scheduled jobs.
   */
  static async stopAll(): Promise<void> {
    console.log('Stopping KPI computation jobs...');
    for (const [name, task] of this.jobs.entries()) {
      task.stop();
      console.log(`Stopped job: ${name}`);
    }
    this.jobs.clear();
  }

  /**
   * Get list of active scheduled jobs.
   */
  static getActiveJobs(): string[] {
    return Array.from(this.jobs.keys());
  }
}
