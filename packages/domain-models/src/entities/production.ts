/**
 * @heynxt/domain-models — Production Execution Entities
 *
 * Work order lifecycle, operation execution, and routing management.
 * Patterns extracted from both FactoryNXT reference repos for cross-domain MES capabilities.
 */

import { z } from 'zod';

// ============================================================================
// Work Order Lifecycle (Common FSM)
// ============================================================================

/**
 * WorkOrderStatus — standard work order lifecycle state machine.
 * DRAFT → RELEASED → RUNNING → COMPLETED | ABORTED
 *
 * Reference: FactoryNxT_PY_V2 models.py → WorkOrder status FSM
 */
export const WorkOrderStatus = z.enum([
  'draft',         // Work order being created/edited
  'released',      // Released to production floor
  'running',       // Actively being executed
  'completed',     // All operations finished
  'aborted',       // Stopped before completion
]);

export type WorkOrderStatus = z.infer<typeof WorkOrderStatus>;

/**
 * RoutingStep — a single step in a work order routing DAG.
 */
export const RoutingStepId = z.string().uuid();

export const StepType = z.enum([
  'operation',      // Standard manufacturing operation (SMT, through-hole)
  'inspection',     // Quality inspection point
  'transfer',       // Material transfer between locations
]);

export const RoutingStep = z.object({
  id: RoutingStepId,

  // Step identification
  stepNumber: z.number().int().positive(), // e.g., 10, 20, 30 (tens for ordering)
  name: z.string().min(1).max(200),
  description: z.string().optional(),

  // Step type classification
  stepType: StepType.default('operation'),

  // Target station/line
  targetStationId: z.string().uuid(),

  // Estimated duration (minutes)
  estimatedDurationMinutes: z.number().positive().optional(),

  // Requirements for this step
  requiredTools: z.array(z.string()).default([]),
  requiredCertifications: z.array(z.string()).default([]),

  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

export type RoutingStep = z.infer<typeof RoutingStep>;

/**
 * RoutingMaster — the complete routing DAG for a product.
 * Immutable snapshot pattern ensures routings don't change mid-execution.
 *
 * Reference: FactoryNXT_PY_v2_Extrusion models_routing.py → RoutingMaster + WorkOrderRoutingSnapshot
 */
export const RoutingMasterId = z.string().uuid();

export const RoutingStatus = z.enum([
  'draft',
  'published',    // Active routing in use
  'deprecated',   // No longer used for new work orders
]);

export const RoutingMaster = z.object({
  id: RoutingMasterId,

  // Identification
  name: z.string().min(1).max(200),
  description: z.string().optional(),

  // Applicable to which products/designs
  applicableDesignNumbers: z.array(z.string()).default([]),

  // Routing order (sequence of steps)
  steps: z.array(RoutingStep).min(1),

  // DAG topology (step dependencies for parallel execution support)
  stepDependencies: z.record(RoutingStepId, z.array(RoutingStepId)).optional(),

  // Status & lifecycle
  status: RoutingStatus.default('draft'),

  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

export type RoutingMaster = z.infer<typeof RoutingMaster>;

/**
 * WorkOrderRoutingSnapshot — immutable routing snapshot attached to a work order.
 * Ensures that even if the master routing changes, the executed work order
 * maintains traceability to the exact routing version used.
 */
export const WorkOrderRoutingSnapshotId = z.string().uuid();

export const WorkOrderRoutingSnapshot = z.object({
  id: WorkOrderRoutingSnapshotId,

  // Link back to parent work order
  workOrderId: z.string().uuid(),

  // Snapshot of routing at time of release
  masterRoutingId: RoutingMasterId,
  routingVersionAtRelease: z.string(), // e.g., "v1.2" or commit hash

  // Frozen copy of steps (deep snapshot)
  frozenSteps: z.array(
    z.object({
      id: RoutingStepId,
      stepNumber: z.number().int().positive(),
      name: z.string(),
      targetStationId: z.string().uuid(),
    })
  ),

  createdAt: z.coerce.date(),
});

export type WorkOrderRoutingSnapshot = z.infer<typeof WorkOrderRoutingSnapshot>;

/**
 * WorkOrder — production work order for manufacturing execution.
 */
export const WorkOrderId = z.string().uuid();

export const PriorityLevel = z.enum(['low', 'normal', 'high', 'urgent']);

export const WorkOrder = z.object({
  id: WorkOrderId,

  // Identification
  workOrderNumber: z.string().min(1).max(200), // e.g., "WO-2024-0001"

  // Product being manufactured
  designNumber: z.string().min(1).max(200),
  revision: z.string().min(1).max(50),

  // Quantity to produce
  targetQuantity: z.number().int().positive(),
  quantityCompleted: z.number().int().nonnegative().default(0),

  // Routing reference (which process flow to follow)
  routingMasterId: RoutingMasterId.optional(),

  // Priority & scheduling
  priority: PriorityLevel.default('normal'),
  requestedDate: z.coerce.date().optional(),
  dueDate: z.coerce.date().optional(),

  // Status & lifecycle
  status: WorkOrderStatus.default('draft'),

  // Notes/flags
  specialInstructions: z.string().optional(),

  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

export type WorkOrder = z.infer<typeof WorkOrder>;

// ============================================================================
// Operation Execution & Serial Number Management
// ============================================================================

/**
 * OperationTransaction — barcode-scan operation execution record.
 * Each scan at a station creates an operation transaction, enforcing routing order.
 *
 * Reference: FactoryNxT_PY_V2 routes/operations.py → scan_serial() function
 */
export const OperationTransactionId = z.string().uuid();

export const TransactionType = z.enum([
  'start-operation',    // Starting work at a station
  'complete-operation', // Finishing work at a station
  'scan-serial',        // Scanning serial number for traceability
  'transfer',           // Material transfer between stations
]);

export const OperationTransaction = z.object({
  id: OperationTransactionId,

  // Identification
  transactionNumber: z.string().min(1).max(200),

  // Link to work order and routing step
  workOrderId: WorkOrderId,
  routingStepId: RoutingStepId.optional(),

  // Transaction details
  transactionType: TransactionType.default('scan-serial'),
  stationId: z.string().uuid(),

  // Serial numbers involved (could be multiple for panel operations)
  serialNumbers: z.array(z.string()).default([]),

  // Operator who performed the action
  operatorId: z.string().optional(),

  // Timestamp of execution
  executedAt: z.coerce.date(),

  createdAt: z.coerce.date(),
});

export type OperationTransaction = z.infer<typeof OperationTransaction>;

/**
 * SerialNumber — serial number registration for traceability.
 */
export const SerialNumberId = z.string().uuid();

export const SerialNumberStatus = z.enum([
  'registered',     // Registered but not yet assigned to work order
  'assigned',       // Assigned to a specific work order
  'in-use',         // Currently being processed
  'completed',      // Work complete, serial is finished good
  'scrapbed',       // Scrapped during production
]);

export const SerialNumber = z.object({
  id: SerialNumberId,

  // Identification
  serialNumber: z.string().min(1).max(200), // unique identifier string
  formatPattern: z.string().optional(), // e.g., "SN-YYYY-######"

  // Assignment status
  status: SerialNumberStatus.default('registered'),
  workOrderId: WorkOrderId.optional(),

  // Generation metadata
  generatedAt: z.coerce.date().optional(),
  assignedAt: z.coerce.date().optional(),

  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

export type SerialNumber = z.infer<typeof SerialNumber>;
