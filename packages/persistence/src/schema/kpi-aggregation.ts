/**
 * Drizzle table definition for KPI aggregation tables.
 *
 * Phase 8 — Industrial Runtime Services: KPI computation and storage.
 * OEE, throughput, quality metrics computed from event stream.
 */
import {
  pgTable,
  text,
  timestamp,
  jsonb,
  index,
} from 'drizzle-orm/pg-core';

// ---------------------------------------------------------------------------
// Enums for KPI types
// ---------------------------------------------------------------------------

export const kpiTypeEnum = text('kpiType', {
  enum: ['oee', 'throughput', 'quality', 'downtime'],
});

export const aggregationWindowTypeEnum = text('aggregationWindow', {
  enum: ['minute', 'hourly', 'daily', 'weekly', 'monthly'],
});

export const kpiCalculationStatusEnum = text('status', {
  enum: ['pending', 'calculating', 'completed', 'failed'],
});

// ---------------------------------------------------------------------------
// Table: kpi_snapshots (computed KPI metrics)
// ---------------------------------------------------------------------------

/**
 * Stores computed KPI snapshots. Each snapshot represents a time period's
 * aggregated metrics for a specific production line or asset group.
 */
export const kpiSnapshots = pgTable(
  'kpi_snapshots',
  {
    /** UUID string (server-generated if not provided). */
    id: text('id').primaryKey(),

    /** KPI type being measured. */
    kpiType: kpiTypeEnum.notNull(),

    /** Which production line this snapshot is for. */
    lineId: text('lineId').notNull(),

    /** Start of the aggregation period. */
    periodStart: timestamp('periodStart', { mode: 'date' }).notNull(),

    /** End of the aggregation period. */
    periodEnd: timestamp('periodEnd', { mode: 'date' }).notNull(),

    /** OEE availability factor (0-1). Run Time / Planned Production Time. */
    availability: text('availability'),

    /** OEE performance factor (0-1). */
    performance: text('performance'),

    /** OEE quality factor (0-1). Good Parts / Total Parts. */
    quality: text('quality'),

    /** Composite OEE score (availability × performance × quality, 0-1). */
    oeeScore: text('oeeScore'),

    /** Detailed metrics as JSON object (varies by kpiType). */
    metrics: jsonb('metrics').$type<unknown>(),

    createdAt: timestamp('createdAt', { mode: 'date' })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => ({
    lineIdx: index('kpi_snapshots_lineId_idx').on(table.lineId),
    kpiTypeIdx: index(
      'kpi_snapshots_kpiType_idx',
    ).on(table.kpiType),
    periodStartIdx: index(
      'kpi_snapshots_periodStart_idx',
    ).on(table.periodStart),
  }),
);

// ---------------------------------------------------------------------------
// Table: kpi_definitions (KPI configuration)
// ---------------------------------------------------------------------------

/**
 * Stores KPI definition metadata. Each definition specifies what to compute,
 * how often, and for which assets/lines.
 */
export const kpiDefinitions = pgTable(
  'kpi_definitions',
  {
    /** UUID string (server-generated if not provided). */
    id: text('id').primaryKey(),

    /** KPI name. */
    name: text('name').notNull(),

    /** Optional description. */
    description: text('description'),

    /** KPI type. */
    kpiType: kpiTypeEnum.notNull(),

    /** Scope configuration (which lines/stations to include). */
    scope: jsonb('scope').$type<unknown>(),

    /** Aggregation window size. */
    aggregationWindow: aggregationWindowTypeEnum.notNull().default('hourly'),

    /** Whether this KPI is enabled for computation. */
    enabled: text('enabled', {
      enum: ['true', 'false'],
    }).notNull().default('true'),

    /** Created by user ID. */
    createdBy: text('createdBy').notNull(),

    createdAt: timestamp('createdAt', { mode: 'date' })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: timestamp('updatedAt', { mode: 'date' }),
  },
  (table) => ({
    kpiTypeIdx: index(
      'kpi_definitions_kpiType_idx',
    ).on(table.kpiType),
    enabledIdx: index('kpi_definitions_enabled_idx').on(table.enabled),
  }),
);

// ---------------------------------------------------------------------------
// Table: kpi_calculation_jobs (scheduled computation tracking)
// ---------------------------------------------------------------------------

/**
 * Tracks scheduled KPI calculation jobs. Each job represents a computation
 * request for a specific time period, with status and execution details.
 */
export const kpiCalculationJobs = pgTable(
  'kpi_calculation_jobs',
  {
    /** UUID string (server-generated if not provided). */
    id: text('id').primaryKey(),

    /** FK to the KPI definition this job is for. */
    definitionId: text('definitionId')
      .notNull()
      .references(() => kpiDefinitions.id),

    /** Start of the period being calculated. */
    windowStart: timestamp('windowStart', { mode: 'date' }).notNull(),

    /** End of the period being calculated. */
    windowEnd: timestamp('windowEnd', { mode: 'date' }).notNull(),

    /** Current status of this calculation job. */
    status: kpiCalculationStatusEnum.notNull().default('pending'),

    /** When computation began (if applicable). */
    startedAt: timestamp('startedAt', { mode: 'date' }),

    /** When computation finished (if applicable). */
    completedAt: timestamp('completedAt', { mode: 'date' }),

    /** Error message if calculation failed. */
    error: text('error'),
  },
  (table) => ({
    definitionIdx: index(
      'kpi_calculation_jobs_definitionId_idx',
    ).on(table.definitionId),
    statusIdx: index(
      'kpi_calculation_jobs_status_idx',
    ).on(table.status),
    windowStartIdx: index(
      'kpi_calculation_jobs_windowStart_idx',
    ).on(table.windowStart),
  }),
);

// ---------------------------------------------------------------------------
// Type Exports
// ---------------------------------------------------------------------------

/** KPI snapshot record type. */
export type KpiSnapshot = typeof kpiSnapshots.$inferSelect;

/** Insertable KPI snapshot (without id, createdAt). */
export type InsertKpiSnapshot = Omit<
  typeof kpiSnapshots.$inferInsert,
  'id' | 'createdAt'
>;

/** KPI definition record type. */
export type KpiDefinition = typeof kpiDefinitions.$inferSelect;

/** Insertable KPI definition (without id). */
export type InsertKpiDefinition = Omit<
  typeof kpiDefinitions.$inferInsert,
  'id' | 'createdAt'
>;

/** KPI calculation job record type. */
export type KpiCalculationJob = typeof kpiCalculationJobs.$inferSelect;

/** Insertable KPI calculation job (without id). */
export type InsertKpiCalculationJob = Omit<
  typeof kpiCalculationJobs.$inferInsert,
  'id' | 'startedAt' | 'completedAt'
>;
