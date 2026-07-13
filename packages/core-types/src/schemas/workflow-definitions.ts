/**
 * Workflow definitions schema for Phase 8 — Industrial Runtime Services
 *
 * Defines the structure of workflow state machines that can be executed by the runtime.
 * Based on FactoryNXT reference patterns (WorkOrder FSM, Routing FSM).
 */

import { z } from 'zod';

// ============================================================================
// Workflow Core Types
// ============================================================================

/** Unique identifier for a workflow definition */
export const WorkflowDefinitionId = z.string().uuid();
export type WorkflowDefinitionId = z.infer<typeof WorkflowDefinitionId>;

/** Status of a workflow definition (draft, published, deprecated) */
export const WorkflowDefinitionStatus = z.enum(['draft', 'published', 'deprecated']);
export type WorkflowDefinitionStatus = z.infer<typeof WorkflowDefinitionStatus>;

/** Base workflow definition schema */
export const WorkflowDefinitionBase = z.object({
  id: WorkflowDefinitionId.optional(), // Generated on insert if not provided
  name: z.string().min(1, 'Name is required'),
  description: z.string().optional(),
  version: z.string().min(1, 'Version is required').regex(/^[\d]+\.[\d]+\.[\d]+$/, 'Semver format (x.y.z)'),
  status: WorkflowDefinitionStatus.default('draft'),
  domain: z.enum(['work-order', 'routing', 'quality', 'maintenance', 'inventory', 'custom']),
  createdBy: z.string().min(1, 'Created by is required'),
  createdAt: z.date(),
  updatedAt: z.date().optional(),
});

export const WorkflowDefinition = WorkflowDefinitionBase.extend({
  id: WorkflowDefinitionId, // Required for persisted definitions
});

export type WorkflowDefinition = z.infer<typeof WorkflowDefinition>;

// ============================================================================
// State Machine Types - Transition Triggers
// ============================================================================

/** Type of state transition trigger */
export const TransitionTriggerTypeEnum = z.enum(['event', 'timer', 'manual', 'webhook']);
export type TransitionTriggerType = z.infer<typeof TransitionTriggerTypeEnum>;

/** Event name that triggers a transition (e.g., "workOrderReleased", "inspectionComplete") */
export const TriggerEventName = z.string().min(1, 'Event name is required');

/** Timer interval in ISO 8601 duration format (e.g., "PT1H" for 1 hour) */
export const TimerInterval = z.string().regex(/^\d+(?:\.\d+)?(?:s|m|h|d|w)$/, 'Invalid duration format. Use: number + unit (s/m/h/d/w)');

/** Manual transition trigger configuration */
export const ManualTriggerConfigSchema = z.object({
  requiredPermission: z.string().min(1, 'Required permission is needed for manual transitions'),
});

export type ManualTriggerConfig = z.infer<typeof ManualTriggerConfigSchema>;

/** Event-based trigger configuration */
export const EventTriggerConfigSchema = z.object({
  eventName: TriggerEventName,
});

export type EventTriggerConfig = z.infer<typeof EventTriggerConfigSchema>;

/** Timer-based trigger configuration */
export const TimerTriggerConfigSchema = z.object({
  interval: TimerInterval,
});

export type TimerTriggerConfig = z.infer<typeof TimerTriggerConfigSchema>;

/** Webhook trigger configuration */
export const WebhookTriggerConfigSchema = z.object({
  webhookUrl: z.string().url('Valid URL required for webhook triggers'),
  secret: z.string().min(1, 'Secret key required for webhook verification'),
});

export type WebhookTriggerConfig = z.infer<typeof WebhookTriggerConfigSchema>;

// ============================================================================
// Transition Types (discriminated union by triggerType)
// ============================================================================

/** Base transition schema */
const TransitionBaseSchema = z.object({
  id: z.string().uuid(), // Unique ID within the workflow
  fromState: z.string().min(1, 'Source state is required'),
  toState: z.string().min(1, 'Target state is required'),
  triggerType: z.enum(['event', 'timer', 'manual', 'webhook']),
  description: z.string().optional(),
});

/** Event transition (most common) */
export const EventTransitionSchema = TransitionBaseSchema.extend({
  triggerType: z.literal('event'),
  config: EventTriggerConfigSchema.optional(),
});

export type EventTransition = z.infer<typeof EventTransitionSchema>;

/** Timer transition */
export const TimerTransitionSchema = TransitionBaseSchema.extend({
  triggerType: z.literal('timer'),
  config: TimerTriggerConfigSchema,
});

export type TimerTransition = z.infer<typeof TimerTransitionSchema>;

/** Manual transition (requires permission) */
export const ManualTransitionSchema = TransitionBaseSchema.extend({
  triggerType: z.literal('manual'),
  config: ManualTriggerConfigSchema.optional().default({ requiredPermission: 'admin' }),
});

export type ManualTransition = z.infer<typeof ManualTransitionSchema>;

/** Webhook transition */
export const WebhookTransitionSchema = TransitionBaseSchema.extend({
  triggerType: z.literal('webhook'),
  config: WebhookTriggerConfigSchema,
});

export type WebhookTransition = z.infer<typeof WebhookTransitionSchema>;

/** Union of all transition types - discriminated by triggerType */
export const TransitionUnion = z.discriminatedUnion('triggerType', [
  EventTransitionSchema,
  TimerTransitionSchema,
  ManualTransitionSchema,
  WebhookTransitionSchema,
]);

export type Transition = z.infer<typeof TransitionUnion>;

// ============================================================================
// State Types
// ============================================================================

/** Type of state (initial, final, normal) */
export const StateTypeEnum = z.enum(['initial', 'final', 'normal']);
export type StateType = z.infer<typeof StateTypeEnum>;

/** Base state schema */
export const StateBaseSchema = z.object({
  id: z.string().min(1, 'State ID is required'),
  name: z.string().min(1, 'State name is required'),
  type: StateTypeEnum.default('normal'),
  description: z.string().optional(),
});

export type StateBase = z.infer<typeof StateBaseSchema>;

/** Initial state (entry point of workflow) */
export const InitialStateSchema = StateBaseSchema.extend({
  id: z.string().min(1, 'State ID is required'),
  name: z.string().min(1, 'State name is required'),
  type: z.literal('initial'),
});

/** Final state (terminal state where workflow ends) */
export const FinalStateSchema = StateBaseSchema.extend({
  id: z.string().min(1, 'State ID is required'),
  name: z.string().min(1, 'State name is required'),
  type: z.literal('final'),
});

/** Normal state (can be entered and exited) */
export const NormalStateSchema = StateBaseSchema.extend({
  id: z.string().min(1, 'State ID is required'),
  name: z.string().min(1, 'State name is required'),
  type: z.literal('normal').optional(), // Distinct from initial/final types
});

/** Union of all state types - discriminated by type */
export const StateUnion = z.discriminatedUnion('type', [
  InitialStateSchema,
  FinalStateSchema,
  NormalStateSchema,
]);

export type State = z.infer<typeof StateUnion>;

// ============================================================================
// Workflow Instance Types (runtime execution)
// ============================================================================

/** Unique identifier for a workflow instance */
export const WorkflowInstanceId = z.string().uuid();
export type WorkflowInstanceId = z.infer<typeof WorkflowInstanceId>;

/** Current status of a running workflow instance */
export const WorkflowInstanceStatusEnum = z.enum(['pending', 'running', 'completed', 'failed', 'cancelled']);
export type WorkflowInstanceStatus = z.infer<typeof WorkflowInstanceStatusEnum>;

/** Base configuration for starting a workflow instance */
export const WorkflowStartConfigBaseSchema = z.object({
  definitionId: WorkflowDefinitionId,
  definitionVersion: z.string().min(1),
  initialState: z.string().optional(), // Override default initial state
  contextData: z.record(z.unknown()).optional(), // Initial context for workflow execution
});

export const WorkflowStartConfig = WorkflowStartConfigBaseSchema.extend({
  createdBy: z.string().min(1, 'Created by is required'),
  correlationId: z.string().uuid().optional(), // For tracing across systems
});

export type WorkflowStartConfig = z.infer<typeof WorkflowStartConfig>;

/** Runtime state of a workflow instance */
export const WorkflowInstanceStateSchema = z.object({
  id: WorkflowInstanceId,
  definitionId: WorkflowDefinitionId,
  status: WorkflowInstanceStatusEnum.default('pending'),
  currentState: z.string().min(1), // Current active state ID
  contextData: z.record(z.unknown()).default({}), // Runtime context data
  createdAt: z.date(),
  updatedAt: z.date(),
  completedAt: z.date().optional(),
  error: z.string().optional(), // Error message if failed
});

export type WorkflowInstanceState = z.infer<typeof WorkflowInstanceStateSchema>;

// ============================================================================
// Work Order FSM (derived from FactoryNXT patterns)
// ============================================================================

/** WorkOrder status FSM states - matches FactoryNXT_PY_V2 pattern */
export const WorkOrderStatusFSMEnum = z.object({
  DRAFT: z.literal('DRAFT'),
  RELEASED: z.literal('RELEASED'),
  RUNNING: z.literal('RUNNING'),
  PAUSED: z.literal('PAUSED'),
  COMPLETED: z.literal('COMPLETED'),
  CANCELLED: z.literal('CANCELLED'),
});

export const WorkOrderStatusFSMType = z.enum(['DRAFT', 'RELEASED', 'RUNNING', 'PAUSED', 'COMPLETED', 'CANCELLED']).default('DRAFT');

export type WorkOrderStatus = z.infer<typeof WorkOrderStatusFSMType>;

// ============================================================================
// Routing FSM (derived from FactoryNXT patterns)
// ============================================================================

/** RoutingMaster status FSM states */
export const RoutingStatusFSMEnum = z.object({
  DRAFT: z.literal('DRAFT'),
  REVISED: z.literal('REVISED'),
  APPROVED: z.literal('APPROVED'),
  ACTIVE: z.literal('ACTIVE'),
  OBSOLETE: z.literal('OBSOLETE'),
});

export const RoutingStatusFSMType = z.enum(['DRAFT', 'REVISED', 'APPROVED', 'ACTIVE', 'OBSOLETE']).default('DRAFT');

export type RoutingStatus = z.infer<typeof RoutingStatusFSMType>;

// ============================================================================
// Predefined FSM Templates
// ============================================================================

/** Map of predefined FSM templates by domain */
export const PREDEFINED_FSM_TEMPLATES: Record<string, typeof WorkOrderStatusFSMEnum> = {
  'work-order': WorkOrderStatusFSMEnum,
  'routing': RoutingStatusFSMEnum as unknown as typeof WorkOrderStatusFSMEnum,
};

// ============================================================================
// Export Types
// ============================================================================

/** Complete workflow definition with states and transitions */
export const WorkflowDefinitionWithGraphSchema = WorkflowDefinitionBase.extend({
  description: z.string().optional(),
  version: z.string().min(1),
  status: WorkflowDefinitionStatus,
  domain: z.enum(['work-order', 'routing', 'quality', 'maintenance', 'inventory', 'custom']),
  createdBy: z.string().min(1),
  createdAt: z.date(),
  updatedAt: z.date().optional(),
});

export type WorkflowDefinitionWithGraph = z.infer<typeof WorkflowDefinitionWithGraphSchema>;
