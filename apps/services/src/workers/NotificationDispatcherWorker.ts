/**
 * Notification dispatcher worker - sends notifications via configured channels.
 */

import { Worker, type Job } from 'bullmq';
import IORedis from 'ioredis';
import { getWorkerConcurrency, loadEnvConfig } from '../config';
import { validateNotificationData } from '../queue/notificationQueue';
import { NotificationService, type NotificationResult } from '../services/NotificationService';

export interface DispatchContext {
  retryCount: number;
  lastError?: string;
}

/**
 * Process a notification dispatch job.
 */
export async function processNotificationJob(job: Job): Promise<NotificationResult> {
  const data = job.data as any;

  try {
    // Validate job data
    validateNotificationData(data);

    // Dispatch the notification based on channel
    const result = await NotificationService.send(
      data.channel,
      data.recipient,
      data.subject ?? undefined,
      data.body,
      data.metadata
    );

    if (!result.success) {
      console.warn(`Notification failed: ${data.channel} to ${data.recipient}`, result.error);

      // Check if we should retry (transient errors)
      const retriableErrors = ['SMTP not configured', 'Connection timeout', 'Network error'];
      if (retriableErrors.some((err) => result.error?.includes(err))) {
        throw new Error(result.error);
      }

      // Non-retriable - log and return
    } else {
      console.log(`Notification sent: ${data.channel} to ${data.recipient}`);
    }

    return result;
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error('Notification dispatch failed:', errorMsg);

    // Re-throw to trigger BullMQ retry logic
    throw error;
  }
}

/**
 * Create and configure the notification dispatcher worker.
 */
export function createNotificationDispatcherWorker() {
  const concurrency = getWorkerConcurrency('notification');
  const queueName = loadEnvConfig().QUEUE_NAME_NOTIFICATION;

  console.log(`Creating Notification Dispatcher Worker for queue "${queueName}" with concurrency=${concurrency}`);

  return new Worker(
    queueName,
    async (job: Job) => {
      return await processNotificationJob(job);
    },
    {
      connection: loadRedisConnection(),
      concurrency,
      lockDuration: 30000, // Lock expires after 30s
      lockRenewTime: 15000, // Renew every 15s
    }
  );
}

/**
 * Get Redis connection from config.
 */
function loadRedisConnection() {
  const redisUrl = loadEnvConfig().REDIS_URL;
  return new IORedis(redisUrl);
}
