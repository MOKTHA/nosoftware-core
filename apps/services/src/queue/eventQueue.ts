/**
 * Event ingestion queue definitions and utilities.
 */

import { Queue } from 'bullmq';
import type { RuntimeEvent, InsertRuntimeEvent } from '@heynxt/persistence';
import { QueueManager } from './QueueManager';
import { getQueueName } from '../config';

export interface EventJobData extends InsertRuntimeEvent {
  batchId?: string; // For batch processing tracking
}

/**
 * Get the event ingestion queue.
 */
function getEventQueue(): Queue {
  return QueueManager.getQueue(getQueueName('event'));
}

/**
 * Enqueue a single event for processing.
 */
export async function enqueueEvent(data: EventJobData): Promise<string> {
  const queue = getEventQueue();

  const jobId = `event:${data.source}:${data.eventType}:${Date.now()}`;

  await queue.add('ingest', data, {
    jobId,
    attempts: 3,
    backoff: { type: 'exponential', delay: 500 },
  });

  return jobId;
}

/**
 * Enqueue a batch of events for processing.
 */
export async function enqueueEventBatch(
  events: EventJobData[],
  batchId?: string
): Promise<string[]> {
  const queue = getEventQueue();
  const jobIds: string[] = [];

  for (const event of events) {
    const jobId = `event:${event.source}:${event.eventType}:${Date.now()}`;
    await queue.add('ingest', { ...event, batchId }, {
      jobId,
      attempts: 3,
      backoff: { type: 'exponential', delay: 500 },
    });
    jobIds.push(jobId);
  }

  return jobIds;
}

/**
 * Enqueue bulk event ingestion (high throughput mode).
 */
export async function enqueueBulkEvents(
  events: EventJobData[],
  priority?: number
): Promise<void> {
  const queue = getEventQueue();

  // Use addBulk for high-throughput batch processing
  await queue.addBulk(
    events.map((event) => ({
      name: 'ingest',
      data: event,
      jobId: `bulk-event:${Date.now()}:${event.source}:${event.eventType}`,
      priority: priority ?? 10,
    }))
  );
}

/**
 * Get pending events by source.
 */
export async function getPendingEventsBySource(source: string): Promise<any[]> {
  const queue = getEventQueue();
  const jobs = await queue.getWaiting();
  return jobs.filter((job) => job.data.source === source);
}

/**
 * Deduplicate incoming events based on eventType + eventId + timestamp window.
 */
export function isDuplicateEvent(
  event: EventJobData,
  recentEvents: EventJobData[],
  windowMs = 5000
): boolean {
  const now = Date.now();

  return recentEvents.some((e) => {
    if (e.eventType !== event.eventType || e.eventId !== event.eventId) {
      return false;
    }

    // Check timestamp window for potential duplicate
    const timeDiff = Math.abs(now - new Date(event.timestamp).getTime());
    return timeDiff < windowMs && e.source === event.source;
  });
}

/**
 * Validate event job data.
 */
export function validateEventJobData(data: EventJobData): void {
  if (!data.eventType || typeof data.eventType !== 'string') {
    throw new Error('eventType is required and must be a string');
  }

  if (!data.source || typeof data.source !== 'string') {
    throw new Error('source is required and must be a string');
  }

  if (!data.data || typeof data.data !== 'object') {
    throw new Error('data must be a valid JSON object');
  }

  // Validate timestamp is valid ISO date
  try {
    new Date(data.timestamp);
  } catch {
    throw new Error('timestamp must be a valid ISO date string');
  }
}
