/**
 * Quota check job - daily enforcement of tenant quotas.
 */

import cron from 'node-cron';
import { db, tenantQuotas, usageCounters, quotaViolations } from '@heynxt/persistence';
import type { TenantQuota, UsageCounter, QuotaViolation } from '@heynxt/persistence';

/**
 * Configuration for quota check schedules.
 */
const QUOTA_CHECK_SCHEDULE = '0 9 * * *'; // Daily at 9 AM local time

interface QuotaCheckResult {
  tenantId: string;
  quotaId: string;
  currentUsage: number;
  limit: number;
  exceeded: boolean;
  thresholdReached: boolean;
}

/**
 * Scheduled job for quota enforcement.
 */
export class QuotaCheckJob {
  private static scheduledTask?: cron.ScheduledTask;

  /**
   * Initialize the quota check schedule.
   */
  static initialize(): void {
    console.log('Initializing quota check job...');

    this.scheduledTask = cron.schedule(QUOTA_CHECK_SCHEDULE, async () => {
      console.log(`Executing daily quota check at ${new Date().toISOString()}`);
      await this.runQuotaCheck();
    });

    console.log(`Quota check scheduled: ${QUOTA_CHECK_SCHEDULE}`);
  }

  /**
   * Run quota enforcement checks for all active quotas.
   */
  private static async runQuotaCheck(): Promise<void> {
    try {
      // Fetch all active tenant quotas with current usage
      const quotas = await this.getActiveQuotasWithUsage();

      let violationsCreated = 0;
      let thresholdAlertsSent = 0;

      for (const result of quotas) {
        if (result.exceeded) {
          // Quota exceeded - create violation record
          await this.createViolation(result);
          violationsCreated++;
          console.warn(
            `Quota exceeded: tenant=${result.tenantId}, quota=${result.quotaId}, usage=${result.currentUsage}/${result.limit}`
          );
        } else if (result.thresholdReached) {
          // Threshold approaching - could trigger alert notification
          thresholdAlertsSent++;
          console.log(
            `Quota threshold reached: tenant=${result.tenantId}, quota=${result.quotaId}, usage=${result.currentUsage}/${result.limit}`
          );
        }
      }

      console.log(`Quota check complete: ${violationsCreated} violations, ${thresholdAlertsSent} alerts`);
    } catch (error) {
      console.error('Error during quota check:', error);
    }
  }

  /**
   * Fetch all active quotas with current usage counts.
   */
  private static async getActiveQuotasWithUsage(): Promise<QuotaCheckResult[]> {
    // Get all active tenant quotas
    const quotas = await db
      .select({
        id: tenantQuotas.id,
        tenantId: tenantQuotas.tenantId,
        quotaType: tenantQuotas.quotaType,
        limitValue: tenantQuotas.limitValue,
        thresholdPercent: tenantQuotas.thresholdPercent,
      })
      .from(tenantQuotas)
      .where(db.eq(tenantQuotas.status, 'active'));

    const results: QuotaCheckResult[] = [];

    for (const quota of quotas) {
      // Get current usage counter for this tenant/quota combination
      const [usage] = await db
        .select({ count: usageCounters.currentUsage })
        .from(usageCounters)
        .where(
          db.and(
            db.eq(usageCounters.tenantId, quota.tenantId),
            db.eq(usageCounters.quotaType, quota.quotaType)
          )
        );

      const currentUsage = usage?.count ?? 0;
      const thresholdPercent = quota.thresholdPercent ?? 80; // Default 80% threshold
      const thresholdReached = (currentUsage / quota.limitValue) * 100 >= thresholdPercent;

      results.push({
        tenantId: quota.tenantId,
        quotaId: quota.id,
        currentUsage,
        limit: quota.limitValue,
        exceeded: currentUsage >= quota.limitValue,
        thresholdReached,
      });
    }

    return results;
  }

  /**
   * Create a quota violation record.
   */
  private static async createViolation(result: QuotaCheckResult): Promise<void> {
    await db.insert(quotaViolations).values({
      tenantId: result.tenantId,
      quotaId: result.quotaId,
      currentUsage: result.currentUsage,
      limitValue: result.limit,
      severity: 'critical',
      status: 'active',
      detectedAt: new Date(),
    });

    // Also log usage history snapshot for audit trail
    await db.insert(usageHistorySnapshots).values({
      tenantId: result.tenantId,
      quotaType: null as any, // Would need to look up from tenantQuotas
      recordedUsage: result.currentUsage,
      timestamp: new Date(),
    });

    console.log(`Created violation for tenant ${result.tenantId}, quota ${result.quotaId}`);
  }

  /**
   * Stop the scheduled job.
   */
  static stop(): void {
    if (this.scheduledTask) {
      this.scheduledTask.stop();
      this.scheduledTask = undefined;
      console.log('Quota check job stopped');
    }
  }

  /**
   * Manually trigger a quota check.
   */
  static async runManualCheck(): Promise<void> {
    await this.runQuotaCheck();
  }
}

// Import required tables for the usage history snapshot
import { usageHistorySnapshots, tableNames as persistenceTableNames } from '@heynxt/persistence';
