/**
 * KPI aggregation schema for Phase 8 — Industrial Runtime Services
 *
 * Defines Key Performance Indicators that are computed from the event stream.
 * Based on FactoryNXT OEE model: OEE = Availability × Performance × Quality
 */

import { z } from 'zod';

// ============================================================================
// KPI Core Types
// ============================================================================

/** Unique identifier for a KPI definition or snapshot */
export const KpiId = z.string().uuid();
export type KpiId = z.infer<typeof KpiId>;

/** Type of aggregation window */
export const AggregationWindowTypeEnum = z.enum([
  'minute',     // Rolling minute-by-minute metrics
  'hourly',     // Hourly aggregated metrics
  'daily',      // Daily rollup (end-of-day)
  'weekly',     // Weekly summary
  'monthly',    // Monthly summary
]);

export type AggregationWindowType = z.infer<typeof AggregationWindowTypeEnum>;

/** KPI calculation status */
export const KpiCalculationStatusEnum = z.enum([
  'pending',     // Scheduled for computation
  'calculating', // Currently being computed
  'completed',   // Successfully calculated and stored
  'failed',      // Computation failed (will retry)
]);

export type KpiCalculationStatus = z.infer<typeof KpiCalculationStatusEnum>;

// ============================================================================
// OEE (Overall Equipment Effectiveness) - Core Industrial KPI
// ============================================================================

/** OEE factors that combine to form the overall score */
export const OeeFactorsSchema = z.object({
  availability: z.number().min(0).max(1), // A factor: Run Time / Planned Production Time
  performance: z.number().min(0).max(1),   // P factor: (Ideal Cycle Time × Total Count) / Run Time
  quality: z.number().min(0).max(1),       // Q factor: Good Parts / Total Parts
});

export type OeeFactors = z.infer<typeof OeeFactorsSchema>;

/** Computed OEE score */
export const OeescoreSchema = z.number().min(0).max(1); // A × P × Q (automatically computed)

export type Oeescore = z.infer<typeof OeescoreSchema>;

/** Detailed breakdown of OEE components for a given period */
export const OeeDetailedMetricsSchema = z.object({
  plannedProductionTimeMinutes: z.number(),     // Total scheduled production time
  downtimeMinutes: z.number(),                  // Total unplanned downtime
  runTimeMinutes: z.number(),                   // Actual runtime (planned - downtime)
  idealCycleTimeSeconds: z.number(),            // Theoretical cycle time per unit
  totalPartsProduced: z.number().int(),         // All parts produced (good + defective)
  goodPartsCount: z.number().int(),             // Parts that passed quality inspection
  defectRate: OeescoreSchema,                   // Defective / Total (inverse of quality factor)
});

export type OeeDetailedMetrics = z.infer<typeof OeeDetailedMetricsSchema>;

/** Complete OEE snapshot record */
export const OeeSnapshotBaseSchema = z.object({
  id: KpiId.optional(), // Generated on insert if not provided
  lineId: z.string().min(1, 'Production line ID is required'), // Which production line this snapshot is for
  periodStart: z.date(), // Start of the aggregation window
  periodEnd: z.date(),   // End of the aggregation window
  factors: OeeFactorsSchema,
  oeescore: OeescoreSchema, // Computed as availability × performance × quality
  metrics: OeeDetailedMetricsSchema,
});

export const OeeSnapshot = OeeSnapshotBaseSchema.extend({
  id: KpiId, // Required for persisted snapshots
});

export type OeeSnapshot = z.infer<typeof OeeSnapshot>;

// ============================================================================
// Throughput Metrics (Production Rate)
// ============================================================================

/** Production throughput metrics */
export const ThroughputMetricsSchema = z.object({
  unitsProduced: z.number().int(), // Total units produced in period
  targetUnits: z.number().optional(), // Target production quantity for comparison
  idealThroughputPerHour: z.number(), // Theoretical maximum output per hour
  actualThroughputPerHour: z.number(), // Actual average output rate
  efficiencyPercentage: z.number().min(0).max(100), // (Actual / Ideal) × 100
});

export type ThroughputMetrics = z.infer<typeof ThroughputMetricsSchema>;

/** Throughput snapshot record */
export const ThroughputSnapshotBaseSchema = OeeSnapshotBaseSchema.extend({
  kpiType: z.literal('throughput'),
  metrics: ThroughputMetricsSchema,
}).omit({ oeescore: true }); // Throughput doesn't use the composite score

export type ThroughputSnapshot = z.infer<typeof ThroughputSnapshotBaseSchema>;

// ============================================================================
// Quality Metrics (Defect Rate & Yield)
// ============================================================================

/** Quality inspection summary */
export const QualityMetricsSchema = z.object({
  totalInspected: z.number().int(), // Total items inspected in period
  passedCount: z.number().int(),    // Items that passed all inspections
  failedCount: z.number().int(),    // Items that failed any inspection
  passRate: OeescoreSchema,               // Passed / Total (0-1)
  defectCountsByType: z.record(z.string(), z.number().int()).optional(), // Defects grouped by type/code
  firstPassYield: OeescoreSchema.optional(), // First-time-through success rate (no rework needed)
});

export type QualityMetrics = z.infer<typeof QualityMetricsSchema>;

/** Quality snapshot record */
export const QualitySnapshotBaseSchema = OeeSnapshotBaseSchema.extend({
  kpiType: z.literal('quality'),
  metrics: QualityMetricsSchema,
}).omit({ oeescore: true }); // Quality has its own passRate metric

export type QualitySnapshot = z.infer<typeof QualitySnapshotBaseSchema>;

// ============================================================================
// Downtime Analysis Metrics
// ============================================================================

/** Downtime event summary */
export const DowntimeEventSummarySchema = z.object({
  downtimeType: z.enum(['planned', 'unplanned', 'materialShortage', 'qualityIssue', 'changeover']),
  totalDurationMinutes: z.number(), // Total time lost to this type of downtime
  incidentCount: z.number().int(),  // Number of separate incidents in period
  averageIncidentDurationMinutes: z.number().optional(), // Average per-incident duration
});

export type DowntimeEventSummary = z.infer<typeof DowntimeEventSummarySchema>;

/** Downtime breakdown by root cause category */
export const DowntimeBreakdownSchema = z.object({
  totalDowntimeMinutes: z.number(),           // Total downtime in period
  unplannedDowntimeMinutes: z.number(),       // Unplanned/unscheduled downtime
  plannedMaintenanceMinutes: z.number(),      // Scheduled maintenance time
  changeoverTimeMinutes: z.number(),          // Time spent on product changeovers
  otherDowntimeMinutes: z.number(),           // Other causes
});

export type DowntimeBreakdown = z.infer<typeof DowntimeBreakdownSchema>;

/** Downtime snapshot record */
export const DowntimeSnapshotBaseSchema = OeeSnapshotBaseSchema.extend({
  kpiType: z.literal('downtime'),
  metrics: z.object({
    breakdown: DowntimeBreakdownSchema,
    topDowntimeCauses: z.array(DowntimeEventSummarySchema).max(5), // Top 5 causes by duration
  }),
}).omit({ oeescore: true });

export type DowntimeSnapshot = z.infer<typeof DowntimeSnapshotBaseSchema>;

// ============================================================================
// KPI Definition (configuration)
// ============================================================================

/** KPI definition - what to calculate and how often */
export const KpiDefinitionBaseSchema = z.object({
  id: KpiId.optional(), // Generated on insert if not provided
  name: z.string().min(1, 'KPI name is required'),
  description: z.string().optional(),
  kpiType: z.enum(['oee', 'throughput', 'quality', 'downtime']),
  scope: z.object({
    lineIds: z.array(z.string()).optional(), // Which lines to aggregate (empty = all)
    stationIds: z.array(z.string()).optional(), // Filter by specific stations
  }),
  aggregationWindow: AggregationWindowTypeEnum.default('hourly'),
  enabled: z.boolean().default(true),
  createdBy: z.string().min(1, 'Created by is required'),
  createdAt: z.date(),
  updatedAt: z.date().optional(),
});

export const KpiDefinition = KpiDefinitionBaseSchema.extend({
  id: KpiId, // Required for persisted definitions
});

export type KpiDefinition = z.infer<typeof KpiDefinition>;

// ============================================================================
// KPI Calculation Job (runtime execution)
// ============================================================================

/** KPI calculation job - scheduled computation */
export const KpiCalculationJobBaseSchema = z.object({
  id: KpiId.optional(), // Generated on insert if not provided
  definitionId: KpiId, // Which KPI this job is for
  windowStart: z.date(), // Period being calculated
  windowEnd: z.date(),   // End of period
  status: KpiCalculationStatusEnum.default('pending'),
  startedAt: z.date().optional(), // When calculation began
  completedAt: z.date().optional(), // When calculation finished
  error: z.string().optional(), // Error message if failed
});

export const KpiCalculationJob = KpiCalculationJobBaseSchema.extend({
  id: KpiId, // Required for persisted jobs
});

export type KpiCalculationJob = z.infer<typeof KpiCalculationJob>;

// ============================================================================
// KPI Trend Query (time series)
// ============================================================================

/** KPI trend query parameters */
export const KpiTrendQuerySchema = z.object({
  kpiType: z.enum(['oee', 'throughput', 'quality', 'downtime']),
  lineId: z.string().optional(), // Filter by specific line
  startDate: z.date(), // Start of trend period
  endDate: z.date(),   // End of trend period
  granularity: AggregationWindowTypeEnum.default('hourly'), // Data point frequency in results
});

export type KpiTrendQuery = z.infer<typeof KpiTrendQuerySchema>;

/** Response with time-series data points */
export const KpiTrendResponseSchema = z.object({
  kpiType: z.enum(['oee', 'throughput', 'quality', 'downtime']),
  lineId: z.string().optional(),
  startDate: z.date(),
  endDate: z.date(),
  dataPoints: z.array(z.object({
    timestamp: z.date(), // Start of this period
    value: z.number(),   // The KPI value (OEE score, pass rate, etc.)
    metadata: z.record(z.unknown()).optional(), // Additional context for each point
  })),
});

export type KpiTrendResponse = z.infer<typeof KpiTrendResponseSchema>;

// ============================================================================
// KPI Benchmarking (comparison against targets)
// ============================================================================

/** KPI benchmark target */
export const KbmarkTargetSchema = z.object({
  targetValue: z.number(), // Target value to achieve
  thresholdWarning: z.number().optional(), // Value below which warning is triggered
  thresholdCritical: z.number().optional(), // Value below which critical alert is triggered
});

export type KpiBenchmarkTarget = z.infer<typeof KbmarkTargetSchema>;

/** Benchmark comparison result */
export const KpiBenchmarkResultSchema = z.object({
  kpiId: KpiId,
  lineId: z.string(),
  periodStart: z.date(),
  periodEnd: z.date(),
  actualValue: z.number(), // Actual measured value
  targetValue: z.number(), // Target from definition
  variancePercent: z.number().optional(), // (Actual - Target) / Target × 100
  status: z.enum(['onTarget', 'warning', 'critical']),
});

export type KpiBenchmarkResult = z.infer<typeof KpiBenchmarkResultSchema>;

// ============================================================================
// Export Types
// ============================================================================

/** Complete KPI aggregation service schemas */
export const KpiAggregationSchema = z.object({
  oeeSnapshot: OeeSnapshot,
  throughputSnapshot: ThroughputSnapshotBaseSchema,
  qualitySnapshot: QualitySnapshotBaseSchema,
  downtimeSnapshot: DowntimeSnapshotBaseSchema,
  kpiDefinition: KpiDefinition,
  calculationJob: KpiCalculationJob,
});
