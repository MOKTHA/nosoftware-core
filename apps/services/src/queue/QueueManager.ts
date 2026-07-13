/**
 * Queue manager - centralized BullMQ connection and queue factory.
 * Manages Redis connections and provides typed queues for workers.
 */

import { Queue, Worker, type Job } from 'bullmq';
import IORedis from 'ioredis';
import { getQueueName, loadEnvConfig } from '../config';

export interface QueueDefinition<T = any> {
  name: string;
  jobs?: Array<{ name: string; data: T }>;
}

/**
 * Redis connection singleton.
 */
class RedisConnection {
  private static instance: IORedis | null = null;

  static getInstance(): IORedis {
    if (!RedisConnection.instance) {
      const redisUrl = loadEnvConfig().REDIS_URL;
      RedisConnection.instance = new IORedis(redisUrl, {
        maxRetriesPerRequest: 3,
        retryStrategy: (times: number) => {
          if (times > 10) return null; // Stop retrying after 10 attempts
          const delay = Math.min(times * 50, 2000);
          return delay;
        },
      });

      RedisConnection.instance.on('error', (err) => {
        console.error('Redis connection error:', err.message);
      });

      RedisConnection.instance.on('connect', () => {
        console.log('Connected to Redis');
      });
    }
    return RedisConnection.instance;
  }

  static disconnect(): void {
    if (RedisConnection.instance) {
      RedisConnection.instance.quit();
      RedisConnection.instance = null;
    }
  }
}

/**
 * Queue manager for creating and managing BullMQ queues/workers.
 */
export class QueueManager {
  private static queues: Map<string, Queue> = new Map();
  private static workers: Map<string, Worker> = new Map();

  /**
   * Get or create a queue by name.
   */
  static getQueue(name: string): Queue {
    if (!this.queues.has(name)) {
      const redis = RedisConnection.getInstance();
      this.queues.set(
        name,
        new Queue(name, {
          connection: redis,
          defaultJobOptions: {
            attempts: 3,
            backoff: {
              type: 'exponential',
              delay: 1000,
            },
            removeOnComplete: true,
            removeOnFail: false, // Keep failed jobs for inspection
          },
        })
      );
    }
    return this.queues.get(name)!;
  }

  /**
   * Get or create a worker by queue name and processor.
   */
  static getWorker<T = any>(
    queueName: string,
    processor: (job: Job) => Promise<T>,
    concurrency: number = 5
  ): Worker {
    const key = `${queueName}_worker`;

    if (!this.workers.has(key)) {
      const redis = RedisConnection.getInstance();
      this.workers.set(
        key,
        new Worker(queueName, processor, {
          connection: redis,
          concurrency,
          lockDuration: 30000, // Lock expires after 30s
          lockRenewTime: 15000, // Renew every 15s
        })
      );

      const worker = this.workers.get(key)!;

      worker.on('completed', (job) => {
        console.log(`Job ${job.id} completed in queue ${queueName}`);
      });

      worker.on('failed', (job, err) => {
        console.error(
          `Job ${job?.id ?? 'unknown'} failed in queue ${queueName}:`,
          err.message
        );
      });

      worker.on('stalled', (jobId) => {
        console.warn(`Job ${jobId} stalled in queue ${queueName}`);
      });
    }

    return this.workers.get(key)!;
  }

  /**
   * Get all queues for health check.
   */
  static getQueues(): Map<string, Queue> {
    return new Map(this.queues);
  }

  /**
   * Disconnect all Redis connections.
   */
  static async disconnectAll(): Promise<void> {
    // Close all workers first
    for (const worker of this.workers.values()) {
      await worker.close();
    }
    this.workers.clear();

    // Then close all queues
    for (const queue of this.queues.values()) {
      await queue.close();
    }
    this.queues.clear();

    RedisConnection.disconnect();
  }

  /**
   * Get queue statistics (for health checks).
   */
  static async getQueueStats(queueName: string) {
    const queue = this.getQueue(queueName);
    return {
      waiting: await queue.getWaitingCount(),
      active: await queue.getActiveCount(),
      completed: await queue.getCompletedCount(),
      failed: await queue.getFailedCount(),
    };
  }

  /**
   * Drain a queue (remove all jobs) - for testing only.
   */
  static async drainQueue(queueName: string): Promise<void> {
    const queue = this.getQueue(queueName);
    await queue.drain();
  }
}
