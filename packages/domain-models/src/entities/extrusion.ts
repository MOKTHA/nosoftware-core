/**
 * @heynxt/domain-models — Extrusion Manufacturing Entities
 *
 * Industrial domain entities for aluminum extrusion manufacturing, extracted from:
 * FactoryNXT_PY_v2_Extrusion reference repository.
 */

import { z } from 'zod';

// ============================================================================
// Billet & Die Management (Extrusion Domain)
// ============================================================================

/**
 * Billet — the starting material for extrusion process.
 * Represents an aluminum billet ready to be heated and pressed through a die.
 *
 * Reference: FactoryNXT_PY_v2_Extrusion models.py → Billet class
 */
export const ExtrusionBilletId = z.string().uuid();

export const AlloyGrade = z.enum([
  '6061',
  '6063',
  '6082',
  '5052',
  '7075',
  'Other',
]);

export const BilletStatus = z.enum(['received', 'heated', 'in-process', 'completed', 'scrap']);

export const ExtrusionBillet = z.object({
  id: ExtrusionBilletId,

  // Material properties
  alloyGrade: AlloyGrade,
  weightKg: z.number().positive(),
  lengthMm: z.number().positive(),
  diameterMm: z.number().positive(),

  // Heat treatment status (if applicable)
  heatTreated: z.boolean().default(false),

  // Lifecycle tracking
  receivedAt: z.coerce.date(),
  location: z.string().optional(), // storage location in warehouse

  // Status & lifecycle
  status: BilletStatus.default('received'),
  scrapReason: z.string().optional(),

  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

export type ExtrusionBillet = z.infer<typeof ExtrusionBillet>;

/**
 * Die — the tooling used to shape extruded aluminum.
 * Includes lifecycle states from new through refurbishment/recycling.
 *
 * Reference: FactoryNXT_PY_v2_Extrusion models.py → Die class (22-state FSM)
 */
export const ExtrusionDieId = z.string().uuid();

export const DieStatus = z.enum([
  'design',           // Design phase, not yet manufactured
  'manufacturing',    // Being manufactured by tooling vendor
  'received',         // Received from vendor, awaiting inspection
  'inspected',        // Passed quality inspection
  'qualified',        // Qualified for production use
  'in-service',       // Currently in service on a press
  'maintenance',      // Undergoing maintenance/refurbishment
  'archived',         // Archived, not actively used
  'recycled',         // Recycled (aluminum recovered)
]);

export const ExtrusionDie = z.object({
  id: ExtrusionDieId,

  // Identification
  partNumber: z.string().min(1).max(200),
  drawingRevision: z.string().optional(),

  // Physical properties
  widthMm: z.number().positive(),
  heightMm: z.number().positive(),
  cavityCount: z.number().int().positive(),

  // Vendor information
  vendorId: z.string().optional(),
  vendorPartNumber: z.string().optional(),

  // Lifecycle tracking
  dateManufactured: z.coerce.date().optional(),
  dateReceived: z.coerce.date().optional(),
  currentLocation: z.string().optional(),

  // Status & lifecycle
  status: DieStatus.default('design'),
  serviceCount: z.number().int().nonnegative().default(0),

  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

export type ExtrusionDie = z.infer<typeof ExtrusionDie>;

/**
 * SetpointProfile — process parameters for extrusion operation.
 * Contains temperature, speed, and other setpoints keyed by alloy + die combination.
 *
 * Reference: FactoryNXT_PY_v2_Extrusion models.py → SetpointProfile class
 */
export const SetpointProfileId = z.string().uuid();

export const ExtrusionProcessType = z.enum([
  'quench',         // Standard quench extrusion
  'air-cool',       // Air cooling after extrusion
  'furnace-cool',   // Furnace cooling (for certain alloys)
]);

export const SetpointProfile = z.object({
  id: SetpointProfileId,

  // Profile identification
  name: z.string().min(1).max(200),
  description: z.string().optional(),

  // Applicable to this alloy + process type combination
  applicableAlloy: AlloyGrade,
  processType: ExtrusionProcessType.default('quench'),

  // Temperature setpoints (Celsius)
  billetTempMin: z.number().positive(),
  billetTempMax: z.number().positive(),
  dieTempMin: z.number().positive(),
  dieTempMax: z.number().positive(),
  quenchWaterTempMin: z.number().optional(),
  quenchWaterTempMax: z.number().optional(),

  // Speed setpoints (mm/s)
  targetExtrusionSpeed: z.number().positive(),
  minExtrusionSpeed: z.number().positive(),

  // Tensioning settings
  tensionerSetting: z.string().optional(),

  // Status
  isActive: z.boolean().default(true),

  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

export type SetpointProfile = z.infer<typeof SetpointProfile>;

/**
 * HeatTreatmentProgram — thermal treatment profile for post-extrusion processing.
 * Contains staged temperature/time parameters for aging/hardening operations.
 *
 * Reference: FactoryNXT_PY_v2_Extrusion models.py → HeatTreatmentProgram class
 */
export const HeatTreatmentStage = z.object({
  stageNumber: z.number().int().positive(),
  targetTempCelsius: z.number().positive(),
  holdTimeMinutes: z.number().positive(),
  coolingMethod: z.enum(['air', 'furnace', 'water', 'controlled']),
});

export const HeatTreatmentProgramId = z.string().uuid();

export const HeatTreatmentProgram = z.object({
  id: HeatTreatmentProgramId,

  // Program identification
  name: z.string().min(1).max(200),
  description: z.string().optional(),

  // Treatment type
  treatmentType: z.enum(['aging', 'solution-treat', 'stress-relief']),

  // Staged thermal profile (ordered list of stages)
  stages: z.array(HeatTreatmentStage).min(1),

  // Applicable alloys
  applicableAlloys: z.array(AlloyGrade).default([]),

  // Status
  isActive: z.boolean().default(true),

  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

export type HeatTreatmentProgram = z.infer<typeof HeatTreatmentProgram>;

// ============================================================================
// Process Execution & OEE
// ============================================================================

/**
 * ProcessRun — actual extrusion run with measured values vs setpoints.
 * Tracks the execution of an extrusion operation including material consumed,
 * output produced, and process performance metrics.
 *
 * Reference: FactoryNXT_PY_v2_Extrusion models.py → ProcessRun class
 */
export const ExtrusionProcessRunId = z.string().uuid();

export const RunStatus = z.enum([
  'scheduled',
  'started',
  'in-progress',
  'completed',
  'aborted',
]);

export const ExtrusionProcessRun = z.object({
  id: ExtrusionProcessRunId,

  // Run identification
  runNumber: z.string().min(1).max(200), // e.g., "PR-2024-001"

  // Associated entities
  billetIds: z.array(z.string().uuid()),
  dieId: ExtrusionDieId.optional(),
  setpointProfileId: SetpointProfileId.optional(),

  // Execution timeline
  scheduledStart: z.coerce.date().optional(),
  actualStart: z.coerce.date().optional(),
  actualEnd: z.coerce.date().optional(),

  // Status & lifecycle
  status: RunStatus.default('scheduled'),
  abortReason: z.string().optional(),

  // Process measurements (actual vs setpoint)
  measuredBilletTempAvgCelsius: z.number().optional(),
  measuredDieTempAvgCelsius: z.number().optional(),
  actualExtrusionSpeedMmPerSec: z.number().optional(),

  // Output tracking
  totalLengthExtractedMm: z.number().nonnegative().default(0),
  weightOutputKg: z.number().nonnegative().default(0),
  scrapWeightKg: z.number().nonnegative().default(0),

  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

export type ExtrusionProcessRun = z.infer<typeof ExtrusionProcessRun>;

/**
 * OEE Snapshot — Overall Equipment Effectiveness calculation for extrusion press.
 * A × P × Q where:
 * - Availability = actual runtime / scheduled time
 * - Performance = actual speed / target speed
 * - Quality = good output / total output
 *
 * Reference: FactoryNXT_PY_v2_Extrusion services/erp_adapter.py → KPIEngine (OEE computation)
 */
export const OeeSnapshotId = z.string().uuid();

export const ExtrusionOeeSnapshot = z.object({
  id: OeeSnapshotId,

  // Snapshot identification
  pressId: z.string().min(1).max(200), // which extrusion press

  // Time period covered by this snapshot
  periodStart: z.coerce.date(),
  periodEnd: z.coerce.date(),

  // Component calculations (0-1 range)
  availabilityRatio: z.number().min(0).max(1).optional(),
  performanceRatio: z.number().min(0).max(1).optional(),
  qualityRatio: z.number().min(0).max(1).optional(),

  // Final OEE score (product of A × P × Q)
  oeeScore: z.number().min(0).max(1).optional(),

  // Component metrics for debugging
  scheduledMinutes: z.number().nonnegative().optional(),
  runtimeMinutes: z.number().nonnegative().optional(),
  targetOutputKg: z.number().nonnegative().optional(),
  actualOutputKg: z.number().nonnegative().optional(),

  createdAt: z.coerce.date(),
});

export type ExtrusionOeeSnapshot = z.infer<typeof ExtrusionOeeSnapshot>;
