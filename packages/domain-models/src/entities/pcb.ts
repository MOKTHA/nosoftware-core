/**
 * @heynxt/domain-models — PCB/Electronics Manufacturing Entities
 *
 * Industrial domain entities for PCB/electronics assembly MES, extracted from:
 * FactoryNxT_PY_V2 reference repository.
 */

import { z } from 'zod';

// ============================================================================
// SMT Line & Equipment
// ============================================================================

/**
 * SmtLine — surface mount technology production line configuration.
 * Represents the ordered sequence of stations (printers, placers, reflow ovens)
 * that process PCBs through component placement operations.
 */
export const SmtStationType = z.enum([
  'screen-printer',     // Solder paste application
  'component-placer',   // Pick-and-place machine
  'reflow-oven',        // Solder reflow heating
  'inspection-aoi',     // Automated optical inspection
  'inspection-spi',     // Solder paste inspection
]);

export const SmtStation = z.object({
  id: z.string().uuid(),

  // Station identification
  name: z.string().min(1).max(200),
  stationType: SmtStationType,

  // Equipment details
  manufacturer: z.string().optional(),
  modelNumber: z.string().optional(),
  serialNumber: z.string().optional(),

  // Position in line (0-indexed)
  positionInLine: z.number().int().nonnegative(),

  // Status
  isActive: z.boolean().default(true),

  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

export type SmtStation = z.infer<typeof SmtStation>;

/**
 * FeederReel — component feeder reel for pick-and-place machines.
 * Tracks tape/carrier reels containing components to be placed on PCBs.
 */
export const ComponentPackageType = z.enum([
  '0201', '0402', '0603', '0805', '1206', // Chip resistors/capacitors
  '0.5mm-pitch', '0.4mm-pitch',          // Fine-pitch ICs
  'QFP', 'BGA', 'QFN',                   // Package styles
  'through-hole',                         // Through-hole components
]);

export const FeederReelId = z.string().uuid();

export const ReelStatus = z.enum([
  'in-stock',       // Available in warehouse
  'in-service',     // Currently on a feeder
  'low-stock',      // Below minimum quantity threshold
  'depleted',       // Empty, needs replacement
  'quarantined',    // Held for quality review
]);

export const FeederReel = z.object({
  id: FeederReelId,

  // Component identification
  partNumber: z.string().min(1).max(200),
  manufacturerPartNumber: z.string().optional(),

  // Package type and pitch
  packageType: ComponentPackageType,
  pitchMm: z.number().positive().optional(),

  // Reel details
  reelSize: z.enum(['7-inch', '13-inch']),
  totalComponentsOnReel: z.number().int().positive(),
  componentsRemaining: z.number().int().nonnegative(),

  // Supplier/vendor info
  supplierName: z.string().optional(),
  dateReceived: z.coerce.date().optional(),
  lotNumber: z.string().optional(),

  // Status & lifecycle
  status: ReelStatus.default('in-stock'),
  currentFeederPosition: z.string().optional(), // e.g., "P1-05" on placement machine

  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

export type FeederReel = z.infer<typeof FeederReel>;

/**
 * Stencil — solder paste application stencil for screen printing.
 */
export const StencilId = z.string().uuid();

export const StencilMaterialType = z.enum(['stainless-steel', 'nickel']);

export const Stencil = z.object({
  id: StencilId,

  // Identification
  partNumber: z.string().min(1).max(200),
  pcbPanelId: z.string().uuid(), // which PCB panel design this stencil is for

  // Physical specs
  materialType: StencilMaterialType.default('stainless-steel'),
  thicknessMm: z.number().positive(),
  frameSize: z.string().optional(),

  // Usage tracking
  totalPrints: z.number().int().nonnegative().default(0),
  lastUsedDate: z.coerce.date().optional(),

  // Status
  isActive: z.boolean().default(true),

  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

export type Stencil = z.infer<typeof Stencil>;

// ============================================================================
// PCB Panels & Boards (Traceability)
// ============================================================================

/**
 * PcbPanel — a panel containing multiple individual PCBs.
 * A production unit that goes through SMT line as a single piece, then depanelized.
 */
export const PanelConstructionType = z.enum([
  'v-score',       // V-groove scoring for depaneling
  'tab-connection', // Breakaway tabs
  'routing',        // Mouse bites/routing slots
]);

export const PcbPanelId = z.string().uuid();

export const PanelStatus = z.enum([
  'design-draft',
  'released',       // Released to production
  'in-production',  // Currently on SMT line
  'completed',      // All panels manufactured
  'quarantined',    // Held for quality review
]);

export const PcbPanel = z.object({
  id: PcbPanelId,

  // Identification
  panelDesignNumber: z.string().min(1).max(200),
  revision: z.string().min(1).max(50),

  // Panel geometry
  widthMm: z.number().positive(),
  heightMm: z.number().positive(),
  thicknessMm: z.number().positive(),

  // Construction details
  constructionType: PanelConstructionType.default('v-score'),
  layers: z.number().int().min(2).max(32),

  // Board count per panel (how many individual boards in this panel)
  boardCountPerPanel: z.number().int().positive(),

  // Current status
  status: PanelStatus.default('design-draft'),

  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

export type PcbPanel = z.infer<typeof PcbPanel>;

/**
 * PcbBoard — an individual PCB extracted from a panel.
 * Each board has unique serial number for traceability.
 */
export const PcbBoardId = z.string().uuid();

export const BoardStatus = z.enum([
  'unprocessed',     // Freshly depanelized, not yet tested
  'tested',          // Passed electrical test
  'repaired',        // Had defects repaired
  'scrapped',        // Failed quality review
]);

export const PcbBoard = z.object({
  id: PcbBoardId,

  // Identification
  serialNumber: z.string().min(1).max(200), // unique serial for this board
  panelId: PcbPanelId,
  positionOnPanel: z.number().int().nonnegative(), // which position on parent panel

  // Board specs (inherited from panel)
  designNumber: z.string().min(1).max(200),
  revision: z.string().min(1).max(50),

  // Status & lifecycle
  status: BoardStatus.default('unprocessed'),
  testResult: z.enum(['pass', 'fail']).optional(),
  defectCode: z.string().optional(),

  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

export type PcbBoard = z.infer<typeof PcbBoard>;

/**
 * GenealogyEvent — traceability event recording component placement.
 * Links components (from reels) to PCBs, creating a complete bill-of-materials
 * genealogy for each board.
 */
export const GenealogyEventType = z.enum([
  'component-placed',   // Component placed on board
  'panel-created',      // New panel created from design
  'board-depanelized',  // Board separated from panel
  'test-verified',      // Board passed electrical test
  'rework-applied',     // Rework performed
]);

export const GenealogyEventId = z.string().uuid();

export const GenealogyEvent = z.object({
  id: GenealogyEventId,

  // Event identification
  eventType: GenealogyEventType,
  timestamp: z.coerce.date(),

  // Board being traced
  boardSerialNumber: PcbBoardId.optional(),

  // Component involved (if applicable)
  componentPartNumber: z.string().optional(),
  reelId: FeederReelId.optional(),
  feederPosition: z.string().optional(),

  // Lot/serial tracking for components used
  componentLotNumber: z.string().optional(),
  componentSerialRangeStart: z.string().optional(),
  componentSerialRangeEnd: z.string().optional(),

  // Operator who performed the action
  operatorId: z.string().optional(),

  createdAt: z.coerce.date(),
});

export type GenealogyEvent = z.infer<typeof GenealogyEvent>;

// ============================================================================
// Quality & Inspection
// ============================================================================

/**
 * InspectionPlan — quality inspection criteria for PCBs.
 * Defines AQL sampling rates, test points, and pass/fail criteria.
 */
export const InspectionLevel = z.enum(['S-1', 'S-2', 'S-3', 'S-4']); // IPC standards
export const DefectClass = z.enum(['critical', 'major', 'minor']);

export const InspectionPlanId = z.string().uuid();

export const InspectionCriteria = z.object({
  testPointName: z.string().min(1).max(200),
  expectedValue: z.string().optional(), // e.g., "5.0V", "< 10ms"
  allowedDeviation: z.number().positive().optional(),
});

export const InspectionPlan = z.object({
  id: InspectionPlanId,

  // Plan identification
  name: z.string().min(1).max(200),
  description: z.string().optional(),

  // Applicable to which designs
  applicableDesignNumbers: z.array(z.string()).default([]),

  // Sampling plan (AQL - Acceptable Quality Level)
  inspectionLevel: InspectionLevel.default('S-3'),
  aqlCritical: z.number().min(0).max(10).default(0.65),
  aqlMajor: z.number().min(0).max(10).default(1.5),
  aqlMinor: z.number().min(0).max(10).default(2.5),

  // Test criteria (list of test points to verify)
  criteria: z.array(InspectionCriteria).default([]),

  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

export type InspectionPlan = z.infer<typeof InspectionPlan>;

/**
 * NCR — Non-Conformance Report.
 * Documents quality defects that do not meet specification.
 */
export const NcrStatus = z.enum([
  'open',           // Under investigation
  'investigating',  // Root cause analysis in progress
  'resolved',       // Corrective action completed
  'closed',         // NCR formally closed
]);

export const DefectClassSeverity = z.enum(['critical', 'major', 'minor']);

export const NcrId = z.string().uuid();

export const NonConformanceReport = z.object({
  id: NcrId,

  // Identification
  ncrNumber: z.string().min(1).max(200), // e.g., "NCR-2024-001"

  // Defect details
  description: z.string(),
  defectClass: DefectClassSeverity.default('major'),

  // Affected boards (serial numbers)
  affectedBoardSerialNumbers: z.array(z.string()).default([]),

  // Investigation
  discoveredAt: z.coerce.date(),
  detectedBy: z.enum(['operator', 'automated-test', 'customer-return']),
  status: NcrStatus.default('open'),

  // Root cause (filled in during investigation)
  rootCauseAnalysis: z.string().optional(),

  // Corrective action
  correctiveAction: z.string().optional(),
  completedAt: z.coerce.date().optional(),

  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

export type NonConformanceReport = z.infer<typeof NonConformanceReport>;

/**
 * CAPA — Corrective and Preventive Action.
 * Systematic process to address recurring quality issues or potential risks.
 */
export const CapaStatus = z.enum([
  'initiated',    // CAPA request opened
  'in-progress',  // Actions being implemented
  'verified',     // Effectiveness verified
  'closed',       // CAPA fully closed
]);

export const CapaId = z.string().uuid();

export const CorrectiveOrPreventive = z.enum(['corrective', 'preventive']);

export const CorrectiveAndPreventiveAction = z.object({
  id: CapaId,

  // Identification
  capaNumber: z.string().min(1).max(200), // e.g., "CAPA-2024-001"

  // Trigger (linked NCR or proactive risk identification)
  triggeredByNcrId: NcrId.optional(),
  triggerDescription: z.string(),

  // Action type
  actionType: CorrectiveOrPreventive.default('corrective'),

  // Description of the issue and proposed action
  issueDescription: z.string(),
  proposedAction: z.string(),

  // Status & timeline
  status: CapaStatus.default('initiated'),
  dueDate: z.coerce.date().optional(),
  completedAt: z.coerce.date().optional(),

  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

export type CorrectiveAndPreventiveAction = z.infer<typeof CorrectiveAndPreventiveAction>;
