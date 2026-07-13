/**
 * Event processor - normalizes and routes runtime events.
 */

import { db, runtimeEvents, eventProcessingLog } from '@heynxt/persistence';
import type { RuntimeEvent, InsertRuntimeEvent, EventProcessingLog } from '@heynxt/persistence';
import { withTransaction } from '../database/db';

export interface ProcessedEvent extends RuntimeEvent {
  processed: boolean;
  deduplicated: boolean;
  routedTo?: string[]; // Target systems/workflows
}

/**
 * Event processor for normalizing and routing incoming events.
 */
export class EventProcessor {
  /**
   * Buffer for tracking recent events (for deduplication).
   * In production, use Redis cache with TTL.
   */
  private static eventBuffer: Map<string, number> = new Map();
  private static readonly BUFFER_WINDOW_MS = 5000; // 5 second window

  /**
   * Process an incoming runtime event.
   */
  static async processEvent(event: InsertRuntimeEvent): Promise<ProcessedEvent> {
    const startTime = Date.now();

    return await withTransaction(async (client) => {
      // Check for duplicate
      const dedupKey = this.getDuplicateKey(event);
      const isDuplicate = EventProcessor.eventBuffer.has(dedupKey);

      if (!isDuplicate) {
        // Add to buffer
        EventProcessor.eventBuffer.set(dedupKey, Date.now());
        this.cleanOldEntries();
      }

      // Determine routing based on source and event type
      const routedTo = this.determineRouting(event);

      // Insert event into database
      const [insertedEvent] = await db
        .insert(runtimeEvents)
        .values({ ...event, deduplicated: isDuplicate })
        .returning()
        .execute(client);

      if (!insertedEvent) {
        throw new Error('Failed to insert runtime event');
      }

      // Log processing
      const [logEntry] = await db
        .insert(eventProcessingLog)
        .values({
          eventId: insertedEvent.id,
          status: 'processed',
          deduplicated: isDuplicate,
          routedTo: JSON.stringify(routedTo),
          processingTimeMs: Date.now() - startTime,
        })
        .returning()
        .execute(client);

      console.log(
        `Processed event ${insertedEvent.id}: source=${event.source}, type=${event.eventType}, deduplicated=${isDuplicate}, routing=${routedTo.join(',')}`
      );

      return {
        ...insertedEvent,
        processed: true,
        deduplicated: isDuplicate,
        routedTo,
      };
    });
  }

  /**
   * Process a batch of events.
   */
  static async processEventBatch(events: InsertRuntimeEvent[]): Promise<ProcessedEvent[]> {
    const results: ProcessedEvent[] = [];

    for (const event of events) {
      try {
        const result = await this.processEvent(event);
        results.push(result);
      } catch (error) {
        console.error(`Failed to process event ${event.eventId || 'unknown'}:`, error);
      }
    }

    return results;
  }

  /**
   * Determine routing targets based on event source and type.
   */
  private static determineRouting(event: InsertRuntimeEvent): string[] {
    const routes: string[] = [];

    // Route PLC events to work-order workflows
    if (event.source === 'plc' || event.source === 'sensor') {
      routes.push('work-order-execution');
      routes.push('quality-monitoring');
    }

    // Route barcode scans to genealogy tracking
    if (event.eventType.includes('scan') || event.eventType.includes('barcode')) {
      routes.push('genealogy-tracking');
      routes.push('traceability');
    }

    // Route quality events to QA workflows
    if (event.source === 'quality-system' || event.eventType.includes('defect')) {
      routes.push('ncr-workflow');
      routes.push('capa-workflow');
    }

    // Default: route all events for general processing
    if (routes.length === 0) {
      routes.push('general-processor');
    }

    return routes;
  }

  /**
   * Get deduplication key for an event.
   */
  private static getDuplicateKey(event: InsertRuntimeEvent): string {
    // Deduplicate based on source + eventType + entityId + timestamp window
    const timestampWindow = Math.floor(new Date(event.timestamp).getTime() / 1000);
    return `${event.source}:${event.eventType}:${event.entityId}:${timestampWindow}`;
  }

  /**
   * Clean old entries from the event buffer.
   */
  private static cleanOldEntries(): void {
    const cutoff = Date.now() - this.BUFFER_WINDOW_MS;

    for (const [key, timestamp] of EventProcessor.eventBuffer.entries()) {
      if (timestamp < cutoff) {
        EventProcessor.eventBuffer.delete(key);
      }
    }
  }

  /**
   * Get event processing statistics.
   */
  static async getProcessingStats(
    sinceMs: number = 3600000 // Last hour by default
  ): Promise<{ totalProcessed: number; deduplicatedCount: number; avgProcessingTimeMs: number }> {
    const startTime = new Date(Date.now() - sinceMs);

    const stats = await db
      .select({
        totalProcessed: db.sql`COUNT(*)`,
        deduplicatedCount: db.sql`SUM(CASE WHEN deduplicated THEN 1 ELSE 0 END)`,
        avgProcessingTime: db.sql`AVG(processing_time_ms)`,
      })
      .from(eventProcessingLog)
      .where(db.gte(eventProcessingLog.processedAt, startTime));

    return {
      totalProcessed: Number(stats[0].totalProcessed),
      deduplicatedCount: Number(stats[0].deduplicatedCount ?? 0),
      avgProcessingTimeMs: Number(stats[0].avgProcessingTime ?? 0),
    };
  }

  /**
   * Query events by source and time range.
   */
  static async queryEvents(
    source?: string,
    startTime?: Date,
    endTime?: Date,
    limit: number = 100
  ): Promise<RuntimeEvent[]> {
    const conditions: any[] = [];

    if (source) {
      conditions.push(db.eq(runtimeEvents.source, source));
    }

    if (startTime) {
      conditions.push(db.gte(runtimeEvents.timestamp, startTime));
    }

    if (endTime) {
      conditions.push(db.lte(runtimeEvents.timestamp, endTime));
    }

    const where = conditions.length > 0 ? db.and(...conditions) : undefined;

    return await db
      .select()
      .from(runtimeEvents)
      .where(where)
      .orderBy(runtimeEvents.timestamp)
      .limit(limit);
  }
}
