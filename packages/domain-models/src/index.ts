/**
 * @heynxt/domain-models
 *
 * Industrial domain entities extracted from FactoryNXT reference repositories.
 * Provides TypeScript/Zod definitions for manufacturing MES concepts:
 * - Extrusion manufacturing (aluminum extrusion)
 * - PCB/electronics assembly MES
 * - Production execution & work order management
 */

// Export all entity schemas by domain area

// Extrusion manufacturing entities
export {
  // Billet & Die Management
  ExtrusionBillet,
  AlloyGrade,
  BilletStatus,
  ExtrusionDie,
  DieStatus,
  SetpointProfileId,
  ExtrusionProcessType,
  SetpointProfile,
  HeatTreatmentStage,
  HeatTreatmentProgramId,
  HeatTreatmentProgram,

  // Process Execution & OEE
  ExtrusionProcessRunId,
  RunStatus,
  ExtrusionProcessRun,
  OeeSnapshotId,
  ExtrusionOeeSnapshot,
} from './entities/extrusion.js';

// PCB/electronics assembly entities
export {
  // SMT Line & Equipment
  SmtStationType,
  SmtStation,
  ComponentPackageType,
  FeederReelId,
  ReelStatus,
  FeederReel,
  StencilId,
  StencilMaterialType,
  Stencil,

  // PCB Panels & Boards (Traceability)
  PanelConstructionType,
  PcbPanelId,
  PanelStatus,
  PcbPanel,
  PcbBoardId,
  BoardStatus,
  PcbBoard,

  // Genealogy & Traceability
  GenealogyEventType,
  GenealogyEventId,
  GenealogyEvent,

  // Quality & Inspection
  InspectionLevel,
  DefectClass,
  InspectionPlanId,
  InspectionCriteria,
  InspectionPlan,
  NcrStatus,
  DefectClassSeverity,
  NcrId,
  NonConformanceReport,
  CapaStatus,
  CapaId,
  CorrectiveOrPreventive,
  CorrectiveAndPreventiveAction,
} from './entities/pcb.js';

// Production execution entities (cross-domain)
export {
  // Work Order Lifecycle FSM
  WorkOrderStatus,

  // Routing & Steps
  RoutingStepId,
  StepType,
  RoutingStep,
  RoutingMasterId,
  RoutingStatus,
  RoutingMaster,
  WorkOrderRoutingSnapshotId,
  WorkOrderRoutingSnapshot,

  // Production Execution
  WorkOrderId,
  PriorityLevel,
  WorkOrder,

  // Operation Execution & Serial Numbers
  OperationTransactionId,
  TransactionType,
  OperationTransaction,
  SerialNumberId,
  SerialNumberStatus,
  SerialNumber,
} from './entities/production.js';
