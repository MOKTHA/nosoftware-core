/**
 * Drizzle table definition for `runtime_events`.
 *
 * Phase 8 — Industrial Runtime Services: Event ingestion tables.
 * Handles PLC signals, barcode scans, sensor data, and external events.
 */
import {
  pgTable,
  text,
  timestamp,
  jsonb,
  integer,
  index,
} from 'drizzle-orm/pg-core';

// ---------------------------------------------------------------------------
// Enums for event types
// ---------------------------------------------------------------------------

export const eventSourceEnum = text('source', {
  enum: [
    'plc',
    'barcode_scanner',
    'manual_entry',
    'external_api',
    'sensor',
    'system',
  ],
});

export const eventPriorityEnum = text('priority', {
  enum: ['low', 'normal', 'high', 'critical'],
});

// ---------------------------------------------------------------------------
// Table: runtime_events (unified event store)
// ---------------------------------------------------------------------------

/**
 * Unified event ingestion table. All industrial events flow through here,
 * regardless of source type. The `eventType` and `data` fields are used
 * to distinguish between PLC signals, barcode scans, etc.
 */
export const runtimeEvents = pgTable(
  'runtime_events',
  {
    /** UUID string (server-generated if not provided). */
    id: text('id').primaryKey(),

    /** Business-level event identifier (e.g., serial number + timestamp). */
    eventId: text('eventId').notNull(),

    /** Source of the event. */
    source: eventSourceEnum.notNull().default('system'),

    /** Event priority level. */
    priority: eventPriorityEnum.notNull().default('normal'),

    /** Domain-specific event type (e.g., "signalUpdate", "operationComplete"). */
    eventType: text('eventType').notNull(),

    /** When the event occurred in the physical world. */
    timestamp: timestamp('timestamp', { mode: 'date' }).notNull(),

    /** When heynxt-core ingested the event (server time). */
    receivedAt: timestamp('receivedAt', { mode: 'date' })
      .notNull()
      .$defaultFn(() => new Date()),

    /** Event-specific data payload (JSON object, schema varies by eventType). */
    data: jsonb('data').$type<unknown>().notNull(),

    /** Optional FK to related generation run (for traceability). */
    generationRunId: text('generationRunId'),

    /** Optional FK to workspace for multi-tenant filtering. */
    workspaceId: text('workspaceId'),
  },
  (table) => ({
    eventIdIdx: index('runtime_events_eventId_idx').on(table.eventId),
    sourceIdx: index('runtime_events_source_idx').on(table.source),
    eventTypeIdx: index(
      'runtime_events_eventType_idx',
    ).on(table.eventType),
    timestampIdx: index('runtime_events_timestamp_idx').on(table.timestamp),
    receivedAtIdx: index(
      'runtime_events_receivedAt_idx',
    ).on(table.receivedAt),
  }),
);

// ---------------------------------------------------------------------------
// Table: event_processing_log (processing audit trail)
// ---------------------------------------------------------------------------

/**
 * Tracks how events were processed by the system. Useful for debugging
 * and understanding event flow through rules engine, workflow engine, etc.
 */
export const eventProcessingLog = pgTable(
  'event_processing_log',
  {
    /** UUID string. */
    id: text('id').primaryKey(),

    /** FK to the original event that triggered this processing record. */
    eventId: text('eventId')
      .notNull()
      .references(() => runtimeEvents.id, { onDelete: 'cascade' }),

    /** Processing step name (e.g., "rules_engine", "workflow_trigger"). */
    stepName: text('stepName').notNull(),

    /** Processing status. */
    status: text('status', {
      enum: ['pending', 'processing', 'completed', 'failed'],
    }).notNull(),

    /** Result or error message from processing. */
    resultMessage: text('resultMessage'),

    /** Processing metadata (JSON object). */
    metadata: jsonb('metadata').$type<unknown>(),

    createdAt: timestamp('createdAt', { mode: 'date' }).notNull(),
  },
  (table) => ({
    eventIdIdx: index(
      'event_processing_log_eventId_idx',
    ).on(table.eventId),
    stepNameIdx: index(
      'event_processing_log_stepName_idx',
    ).on(table.stepName),
  }),
);

// ---------------------------------------------------------------------------
// Type Exports
// ---------------------------------------------------------------------------

/** Runtime event record type. */
export type RuntimeEvent = typeof runtimeEvents.$inferSelect;

/** Insertable runtime event (without id, receivedAt). */
export type InsertRuntimeEvent = Omit<
  typeof runtimeEvents.$inferInsert,
  'id' | 'receivedAt'
>;

/** Event processing log record type. */
export type EventProcessingLog = typeof eventProcessingLog.$inferSelect;

/** Insertable event processing log (without id). */
export type InsertEventProcessingLog = Omit<
  typeof eventProcessingLog.$inferInsert,
  'id' | 'createdAt'
>;
