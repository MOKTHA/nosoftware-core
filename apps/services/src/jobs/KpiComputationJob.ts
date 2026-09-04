/**
 * KPI computation job - scheduled periodic aggregation of metrics.
 */

import cron from 'node-cron';
import { eq, and, sql } from 'drizzle-orm';
import {
  db,
  kpiSnapshots,
  kpiDefinitions,
  kpiCalculationJobs,
} from '@heynxt/persistence';

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
        kpiType: kpiDefinitions.kpiType,
        description: kpiDefinitions.description,
        aggregationWindow: kpiDefinitions.aggregationWindow,
      })
      .from(kpiDefinitions)
      .where(eq(kpiDefinitions.enabled, 'true'));

    // Register database-defined jobs using aggregation window as schedule cadence
    for (const def of activeDefinitions) {
      this.registerJob(def);
    }

    // Register default jobs if no custom schedules exist
    const existingJobs = await db
      .select()
      .from(kpiCalculationJobs)
      .where(eq(kpiCalculationJobs.status, 'pending'));

    if (existingJobs.length === 0) {
      for (const job of DEFAULT_KPI_JOBS) {
        this.registerDefaultJob(job);
      }
    }

    console.log(
      `KPI computation jobs initialized: ${this.jobs.size} active schedules`,
    );
  }

  /**
   * Map aggregation window enum to a cron expression.
   */
  private static windowToCron(window: string): string {
    switch (window) {
      case 'minute':
        return '* * * * *';
      case 'hourly':
        return '0 * * * *';
      case 'daily':
        return '0 0 * * *';
      case 'weekly':
        return '0 0 * * 1';
      case 'monthly':
        return '0 0 1 * *';
      default:
        return '0 * * * *'; // default hourly
    }
  }

  /**
   * Register a KPI computation schedule from database definition.
   */
  private static registerJob(def: {
    id: string;
    name: string;
    kpiType: string;
    description: string | null;
    aggregationWindow: string;
  }): void {
    if (!def.id) {
      console.warn(`Invalid KPI definition: missing id`);
      return;
    }

    const jobName = `kpi:${def.id}`;
    const cronExpr = this.windowToCron(def.aggregationWindow);

    // Clear existing schedule if any
    this.jobs.get(jobName)?.stop();

    // Create new scheduled task
    const scheduledTask = cron.schedule(cronExpr, async () => {
      console.log(`Executing KPI computation for ${def.name} (${jobName})`);
      await this.executeKpiComputation(def.id, def.name, def.kpiType);
    });

    this.jobs.set(jobName, scheduledTask);
    console.log(
      `Registered KPI job: ${jobName} - ${def.description || 'No description'}`,
    );
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
      console.log(
        `Executing default KPI computation for ${config.description}`,
      );
      await this.executeDefaultKpiComputation(config.definitionId);
    });

    this.jobs.set(jobName, scheduledTask);
  }

  /**
   * Execute KPI computation for a specific definition.
   */
  private static async executeKpiComputation(
    definitionId: string,
    name: string,
    kpiType?: string,
  ): Promise<void> {
    const startTime = Date.now();
    const now = new Date();
    const periodStart = new Date(now.getTime() - 3600_000); // 1 hour window

    try {
      // Compute KPI metrics (placeholder — in production, queries runtime_events)
      const snapshotData = await this.computeKpiMetrics(definitionId);

      if (!snapshotData) {
        console.warn(`No data available for KPI ${name}`);
        return;
      }

      // Store computation result — kpiSnapshots schema expects:
      //   id, kpiType, lineId, periodStart, periodEnd, availability,
      //   performance, quality, oeeScore, metrics, createdAt (auto)
      await db.insert(kpiSnapshots).values({
        id: crypto.randomUUID(),
        kpiType: (kpiType ?? 'oee') as 'oee' | 'throughput' | 'quality' | 'downtime',
        lineId: 'default',
        periodStart,
        periodEnd: now,
        availability: snapshotData.metadata.availability?.toString() ?? null,
        performance: snapshotData.metadata.performance?.toString() ?? null,
        quality: snapshotData.metadata.quality?.toString() ?? null,
        oeeScore: snapshotData.value.toString(),
        metrics: snapshotData.metadata,
      });

      console.log(
        `KPI ${name} computed successfully: value=${snapshotData.value}, duration=${Date.now() - startTime}ms`,
      );
    } catch (error) {
      console.error(`Failed to compute KPI ${name}:`, error);

      // Log failed computation as a snapshot with null metrics
      await db.insert(kpiSnapshots).values({
        id: crypto.randomUUID(),
        kpiType: (kpiType ?? 'oee') as 'oee' | 'throughput' | 'quality' | 'downtime',
        lineId: 'default',
        periodStart,
        periodEnd: now,
        metrics: { error: String(error) },
      });
    }
  }

  /**
   * Execute default KPI computation (OEE, throughput, quality rate).
   */
  private static async executeDefaultKpiComputation(
    definitionId: string,
  ): Promise<void> {
    switch (definitionId) {
      case 'oee':
        await this.executeKpiComputation(
          'oee',
          'Overall Equipment Effectiveness',
          'oee',
        );
        break;

      case 'throughput':
        await this.executeKpiComputation(
          'throughput',
          'Production Throughput',
          'throughput',
        );
        break;

      case 'quality-rate':
        await this.executeKpiComputation(
          'quality-rate',
          'Quality Rate',
          'quality',
        );
        break;

      default:
        console.warn(`Unknown default KPI definition: ${definitionId}`);
    }
  }

  /**
   * Compute KPI metrics (placeholder — in production, query runtime_events
   * and compute actual metrics).
   */
  private static async computeKpiMetrics(
    definitionId: string,
  ): Promise<{
    value: number;
    metadata: Record<string, number | string>;
  } | null> {
    // Placeholder implementation — replace with actual KPI computation logic

    switch (definitionId) {
      case 'oee': {
        // OEE = Availability × Performance × Quality
        const availability = Math.random() * 0.3 + 0.7; // Simulated: 70-100%
        const performance = Math.random() * 0.2 + 0.8; // Simulated: 80-100%
        const quality = Math.random() * 0.15 + 0.85; // Simulated: 85-100%

        return {
          value: availability * performance * quality * 100,
          metadata: { availability, performance, quality },
        };
      }

      case 'throughput': {
        const throughput = Math.floor(Math.random() * 100) + 50; // 50-150 units/hour
        return { value: throughput, metadata: { unit: 'units/hour' } };
      }

      case 'quality-rate': {
        const qualityRate = Math.random() * 10 + 90; // 90-100%
        return { value: qualityRate, metadata: { unit: '%' } };
      }

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
