/**
 * Runtime events schema for Phase 8 — Industrial Runtime Services
 *
 * Defines the structure of industrial events that flow through the system:
 * - PLC signals (sensor readings, device states)
 * - Barcode scans (operation transactions, material movements)
 * - External events (ERP updates, quality inspections)
 */

import { z } from 'zod';

// ============================================================================
// Event Core Types
// ============================================================================

/** Unique identifier for an event */
export const EventId = z.string().uuid();
export type EventId = z.infer<typeof EventId>;

/** Source of the event (PLC, scanner, external system) */
export const EventSourceEnum = z.enum([
  'plc',           // Programmable Logic Controller signal
  'barcode_scanner', // Barcode/QR code scan at station
  'manual_entry',   // Operator manual input
  'external_api',   // ERP/MES integration webhook
  'sensor',         // IoT sensor reading
  'system',         // Internal system-generated event
]);

export type EventSource = z.infer<typeof EventSourceEnum>;

/** Priority level for event processing */
export const EventPriorityEnum = z.enum(['low', 'normal', 'high', 'critical']);
export type EventPriority = z.infer<typeof EventPriorityEnum>;

/** Base event schema - all events extend this */
export const RuntimeEventBaseSchema = z.object({
  id: EventId.optional(), // Generated on ingest if not provided
  eventId: z.string().min(1, 'Event ID is required'), // Business-level unique identifier (e.g., serial number + timestamp)
  source: EventSourceEnum.default('system'),
  priority: EventPriorityEnum.default('normal'),
  eventType: z.string().min(1, 'Event type is required'), // Domain-specific event type
  timestamp: z.date(), // When the event occurred in the physical world
  receivedAt: z.date(), // When heynxt-core ingested the event
});

export const RuntimeEvent = RuntimeEventBaseSchema.extend({
  id: EventId, // Required for persisted events
});

export type RuntimeEvent = z.infer<typeof RuntimeEvent>;

// ============================================================================
// PLC Signal Events
// ============================================================================

/** PLC signal reading schema */
export const PlcSignalReadingSchema = z.object({
  tagName: z.string().min(1, 'PLC tag name is required'), // e.g., "Temp_Quench_Line1"
  value: z.union([z.number(), z.boolean()]),
  quality: z.enum(['good', 'uncertain', 'bad']).optional(),
  timestampMs: z.number().int(), // PLC-native millisecond timestamp
});

export type PlcSignalReading = z.infer<typeof PlcSignalReadingSchema>;

/** PLC device state event */
export const PlcDeviceStateEventSchema = RuntimeEventBaseSchema.extend({
  source: z.literal('plc'),
  eventType: z.enum(['deviceOnline', 'deviceOffline', 'deviceError', 'signalUpdate']),
  deviceId: z.string().min(1, 'PLC device ID is required'), // e.g., "PLC_Extrusion_Line1"
  data: z.object({
    signals: z.array(PlcSignalReadingSchema).optional(), // Array of signal readings for this event
    state: z.enum(['online', 'offline', 'error']).optional(), // Device overall state
    errorCodes: z.array(z.string()).optional(), // Error codes if in error state
  }),
});

export type PlcDeviceStateEvent = z.infer<typeof PlcDeviceStateEventSchema>;

// ============================================================================
// Barcode Scan Events (Operation Execution)
// ============================================================================

/** Operation transaction event - barcode scan at station */
export const OperationTransactionEventSchema = RuntimeEventBaseSchema.extend({
  source: z.literal('barcode_scanner'),
  eventType: z.enum(['operationStart', 'operationComplete', 'operationPause', 'operationResume']),
  data: z.object({
    serialNumber: z.string().min(1, 'Serial number is required'), // Work item being processed
    stationId: z.string().min(1, 'Station ID is required'), // Where the operation occurred
    operatorId: z.string().optional(), // Who performed the operation (from badge scan or login)
    workOrderId: z.string().uuid().optional(), // Associated work order
    operationCode: z.string().min(1, 'Operation code is required'), // e.g., "SMT_001", "QC_INSPECT"
    routingStepId: z.string().optional(), // Which step in the routing this corresponds to
    timestampPlc: z.number().int().optional(), // PLC-timed scan (more precise than receivedAt)
  }),
});

export type OperationTransactionEvent = z.infer<typeof OperationTransactionEventSchema>;

/** Material movement event - barcode scan for material tracking */
export const MaterialMovementEventSchema = RuntimeEventBaseSchema.extend({
  source: z.literal('barcode_scanner'),
  eventType: z.enum(['materialReceived', 'materialIssued', 'materialReturned', 'materialScrapped']),
  data: z.object({
    lotNumber: z.string().min(1, 'Lot number is required'), // Material batch being tracked
    serialNumbers: z.array(z.string()).optional(), // Individual serials if applicable
    fromLocation: z.string().optional(), // Source location (bin, rack, warehouse)
    toLocation: z.string().min(1, 'Destination location is required'), // Target location
    quantity: z.number().int().positive('Quantity must be positive'),
    operatorId: z.string().optional(),
  }),
});

export type MaterialMovementEvent = z.infer<typeof MaterialMovementEventSchema>;

// ============================================================================
// Quality Inspection Events
// ============================================================================

/** Measurement reading from quality inspection */
export const MeasurementReadingSchema = z.object({
  featureName: z.string().min(1, 'Measured feature name is required'), // e.g., "Diameter", "Thickness"
  measuredValue: z.number(),
  nominalValue: z.number().optional(), // Target value
  toleranceMin: z.number().optional(), // Acceptable lower bound
  toleranceMax: z.number().optional(), // Acceptable upper bound
  unit: z.string().default('mm'), // Measurement unit (mm, inches, etc.)
});

export type MeasurementReading = z.infer<typeof MeasurementReadingSchema>;

/** Quality inspection event */
export const QualityInspectionEventSchema = RuntimeEventBaseSchema.extend({
  source: z.enum(['barcode_scanner', 'manual_entry']),
  eventType: z.literal('inspectionComplete'),
  data: z.object({
    serialNumber: z.string().min(1, 'Serial number is required'), // Item being inspected
    inspectorId: z.string().optional(), // Who performed the inspection
    workOrderId: z.string().uuid().optional(),
    inspectionPlanId: z.string().optional(), // Which plan was followed
    measurements: z.array(MeasurementReadingSchema).min(1, 'At least one measurement required'),
    overallResult: z.enum(['pass', 'fail', 'conditional']),
    defectsFound: z.array(z.object({
      defectCode: z.string().min(1),
      description: z.string(),
      severity: z.enum(['minor', 'major', 'critical']).optional(),
    })).optional(),
  }),
});

export type QualityInspectionEvent = z.infer<typeof QualityInspectionEventSchema>;

// ============================================================================
// Equipment/Maintenance Events
// ============================================================================

/** Downtime event - equipment stopped unexpectedly */
export const DowntimeEventSchema = RuntimeEventBaseSchema.extend({
  source: z.enum(['plc', 'manual_entry']),
  eventType: z.enum(['downtimeStart', 'downtimeEnd']),
  data: z.object({
    assetId: z.string().min(1, 'Asset ID is required'), // e.g., "Press_Line1", "Conveyor_A"
    downtimeType: z.enum([
      'planned',       // Scheduled maintenance
      'unplanned',     // Unexpected failure
      'materialShortage',
      'qualityIssue',
      'changeover',
      'breakdown',
      'other',
    ]).optional(),
    causeCode: z.string().optional(), // Root cause code (from lookup table)
    description: z.string().optional(), // Free-text description
  }),
});

export type DowntimeEvent = z.infer<typeof DowntimeEventSchema>;

/** Preventive maintenance completion event */
export const MaintenanceEventSchema = RuntimeEventBaseSchema.extend({
  source: z.enum(['manual_entry', 'system']),
  eventType: z.literal('maintenanceComplete'),
  data: z.object({
    assetId: z.string().min(1, 'Asset ID is required'),
    maintenanceType: z.enum(['pm', 'corrective', 'inspection']), // Preventive, corrective, or inspection
    workOrderId: z.string().uuid().optional(), // Associated PM work order
    technicianId: z.string().optional(),
    durationMinutes: z.number().int().positive().optional(),
  }),
});

export type MaintenanceEvent = z.infer<typeof MaintenanceEventSchema>;

// ============================================================================
// Production Execution Events (Work Order Lifecycle)
// ============================================================================

/** Work order status change event */
export const WorkOrderStatusChangeEventSchema = RuntimeEventBaseSchema.extend({
  source: z.enum(['system', 'manual_entry']),
  eventType: z.enum(['workOrderReleased', 'workOrderPaused', 'workOrderResumed', 'workOrderCompleted']),
  data: z.object({
    workOrderId: z.string().uuid(),
    previousStatus: z.enum(['DRAFT', 'RELEASED', 'RUNNING', 'PAUSED']),
    newStatus: z.enum(['RELEASED', 'RUNNING', 'COMPLETED', 'CANCELLED', 'PAUSED']),
    operatorId: z.string().optional(), // Who triggered the change
  }),
});

export type WorkOrderStatusChangeEvent = z.infer<typeof WorkOrderStatusChangeEventSchema>;

// ============================================================================
// KPI/Metrics Events
// ============================================================================

/** OEE snapshot event - computed from production data */
export const OeeSnapshotEventSchema = RuntimeEventBaseSchema.extend({
  source: z.literal('system'), // Computed internally, not external input
  eventType: z.literal('oeeSnapshot'),
  data: z.object({
    lineId: z.string().min(1), // Which production line this snapshot is for
    periodStart: z.date(),
    periodEnd: z.date(),
    availability: z.number().min(0).max(1), // A factor (0-1)
    performance: z.number().min(0).max(1), // P factor (0-1)
    quality: z.number().min(0).max(1), // Q factor (0-1)
    oeeScore: z.number().min(0).max(1), // A × P × Q
    plannedProductionTimeMinutes: z.number(),
    runTimeMinutes: z.number(),
    totalParts: z.number().int(),
    goodParts: z.number().int(),
  }),
});

export type OeeSnapshotEvent = z.infer<typeof OeeSnapshotEventSchema>;

// ============================================================================
// Event Ingestion API Schema
// ============================================================================

/** Request to ingest a batch of events */
export const BatchEventIngestRequestSchema = z.object({
  events: z.array(RuntimeEventBaseSchema).min(1, 'At least one event required'),
});

export type BatchEventIngestRequest = z.infer<typeof BatchEventIngestRequestSchema>;

/** Response after ingesting events */
export const BatchEventIngestResponseSchema = z.object({
  acceptedCount: z.number().int(), // Number of events successfully ingested
  rejectedEvents: z.array(z.object({
    index: z.number().int(), // Index in the original batch
    reason: z.string(), // Why this event was rejected
    eventData: RuntimeEventBaseSchema, // The original event data
  })).optional(),
});

export type BatchEventIngestResponse = z.infer<typeof BatchEventIngestResponseSchema>;

// ============================================================================
// Event Query Filters
// ============================================================================

/** Filter options for querying events */
export const EventFilterSchema = z.object({
  eventType: z.string().optional(), // Exact event type match
  source: EventSourceEnum.optional(),
  startDate: z.date().optional(), // Include events from this date onwards
  endDate: z.date().optional(), // Include events up to this date
  limit: z.number().int().min(1).max(10000).default(100),
  offset: z.number().int().min(0).default(0),
  sortBy: z.enum(['timestamp', 'receivedAt']).default('timestamp'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

export type EventFilter = z.infer<typeof EventFilterSchema>;

// ============================================================================
// Type Guards for discriminated union (runtime helpers)
// Note: These are type guards that narrow the IndustrialRuntimeEvent union, not RuntimeEventBase
// ============================================================================

/** Type guard helper for PLC device state events */
export function isPlcDeviceStateEvent(event: unknown): event is PlcDeviceStateEvent {
  const evt = event as Record<string, unknown>;
  return (evt.source === 'plc' && typeof evt.eventType === 'string') &&
    ['deviceOnline', 'deviceOffline', 'deviceError', 'signalUpdate'].includes(evt.eventType);
}

/** Type guard helper for operation transaction events */
export function isOperationTransactionEvent(event: unknown): event is OperationTransactionEvent {
  const evt = event as Record<string, unknown>;
  return (evt.source === 'barcode_scanner' && typeof evt.eventType === 'string') &&
    ['operationStart', 'operationComplete', 'operationPause', 'operationResume'].includes(evt.eventType);
}

/** Type guard helper for quality inspection events */
export function isQualityInspectionEvent(event: unknown): event is QualityInspectionEvent {
  const evt = event as Record<string, unknown>;
  return (evt.source === 'barcode_scanner' || evt.source === 'manual_entry');
}

// ============================================================================
// Union of All Event Types (discriminated by source + eventType)
// Note: This is complex due to overlapping sources, so we use a looser union
// In practice, you'd validate against specific event types based on context
// ============================================================================

export const IndustrialRuntimeEvent = z.union([
  PlcDeviceStateEventSchema,
  OperationTransactionEventSchema,
  MaterialMovementEventSchema,
  QualityInspectionEventSchema,
  DowntimeEventSchema,
  MaintenanceEventSchema,
  WorkOrderStatusChangeEventSchema,
  OeeSnapshotEventSchema,
]);

export type IndustrialRuntimeEvent = z.infer<typeof IndustrialRuntimeEvent>;
