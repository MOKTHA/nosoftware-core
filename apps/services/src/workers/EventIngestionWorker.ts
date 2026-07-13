/**
 * Event ingestion worker - processes batched PLC/sensor events from queue.
 */

import { Worker, type Job } from 'bullmq';
import IORedis from 'ioredis';
import { getWorkerConcurrency, loadEnvConfig } from '../config';
import { validateEventJobData } from '../queue/eventQueue';
import { EventProcessor, type ProcessedEvent } from '../services/EventProcessor';

/**
 * Process an event ingestion job.
 */
export async function processEventJob(job: Job): Promise<ProcessedEvent> {
  const data = job.data;

  try {
    // Validate job data
    validateEventJobData(data);

    // Process the event through the EventProcessor
    const result = await EventProcessor.processEvent(data);

    return result;
  } catch (error) {
    console.error('Event processing failed:', error instanceof Error ? error.message : String(error));
    throw error; // Let BullMQ handle retries
  }
}

/**
 * Process a batch of events in parallel.
 */
export async function processEventBatchJob(job: Job): Promise<ProcessedEvent[]> {
  const data = job.data as { events: any[] };

  try {
    if (!Array.isArray(data.events) || data.events.length === 0) {
      throw new Error('No events to process');
    }

    // Validate all events first
    for (const event of data.events) {
      validateEventJobData(event);
    }

    // Process batch through EventProcessor
    const results = await EventProcessor.processEventBatch(data.events as any[]);

    return results;
  } catch (error) {
    console.error('Batch event processing failed:', error instanceof Error ? error.message : String(error));
    throw error;
  }
}

/**
 * Create and configure the event ingestion worker.
 */
export function createEventIngestionWorker() {
  const concurrency = getWorkerConcurrency('event');
  const queueName = loadEnvConfig().QUEUE_NAME_EVENT;

  console.log(`Creating Event Ingestion Worker for queue "${queueName}" with concurrency=${concurrency}`);

  return new Worker(
    queueName,
    async (job: Job) => {
      // Check if this is a batch job or single event
      const data = job.data as any;
      if (Array.isArray(data.events)) {
        return await processEventBatchJob(job);
      }

      return await processEventJob(job);
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
