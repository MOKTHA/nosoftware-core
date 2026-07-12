/**
 * Rules engine schema for Phase 8 — Industrial Runtime Services
 *
 * Defines the structure of business rules that are evaluated at runtime.
 * Examples: "billet temperature out of range → alert", "defect rate > threshold → CAPA trigger"
 */

import { z } from 'zod';

// ============================================================================
// Rule Core Types
// ============================================================================

/** Unique identifier for a rule definition */
export const RuleDefinitionId = z.string().uuid();
export type RuleDefinitionId = z.infer<typeof RuleDefinitionId>;

/** Status of a rule (draft, active, disabled) */
export const RuleStatus = z.enum(['draft', 'active', 'disabled']);
export type RuleStatus = z.infer<typeof RuleStatus>;

/** Severity level for rule violations */
export const ViolationSeverity = z.enum(['info', 'warning', 'error', 'critical']);
export type ViolationSeverity = z.infer<typeof ViolationSeverity>;

/** Base rule definition schema */
export const RuleDefinitionBase = z.object({
  id: RuleDefinitionId.optional(), // Generated on insert if not provided
  name: z.string().min(1, 'Rule name is required'),
  description: z.string().optional(),
  status: RuleStatus.default('draft'),
  domain: z.enum([
    'quality',      // Quality-related rules (defects, tolerances)
    'process',      // Process parameter rules (temperature, pressure)
    'equipment',    // Equipment health rules
    'production',   // Production KPI rules (OEE, throughput)
    'safety',       // Safety-critical rules
    'custom',       // Custom domain-specific rules
  ]),
  createdBy: z.string().min(1, 'Created by is required'),
  createdAt: z.date(),
  updatedAt: z.date().optional(),
});

export const RuleDefinition = RuleDefinitionBase.extend({
  id: RuleDefinitionId, // Required for persisted definitions
});

export type RuleDefinition = z.infer<typeof RuleDefinition>;

// ============================================================================
// Condition Expressions
// ============================================================================

/** Comparison operators supported in rule conditions */
export const ComparisonOperator = z.enum([
  'eq',     // equals (==)
  'neq',    // not equal (!=)
  'gt',     // greater than (>)
  'gte',    // greater or equal (>=)
  'lt',     // less than (<)
  'lte',    // less or equal (<=)
  'in',     // in array/list
  'notIn',  // not in array/list
  'contains', // string contains substring
]);

export type ComparisonOperator = z.infer<typeof ComparisonOperator>;

/** Field reference path for rule conditions */
export const FieldPath = z.string().regex(
  /^[a-zA-Z_][a-zA-Z0-9_]*(\.[a-zA-Z_][a-zA-Z0-9_]*)*$/,
  'Field path must be dot-separated identifiers (e.g., "measurement.value", "billet.temperature")'
);

export type FieldPath = z.infer<typeof FieldPath>;

/** Simple condition expression - single comparison */
export const ConditionExpressionSchema = z.object({
  field: FieldPath, // e.g., "signal.temperature"
  operator: ComparisonOperator,
  value: z.unknown(), // Value to compare against (number, string, array based on operator)
});

export type ConditionExpression = z.infer<typeof ConditionExpressionSchema>;

/** Logical operators for combining conditions */
export const LogicalOperatorEnum = z.enum(['and', 'or']);
export type LogicalOperator = z.infer<typeof LogicalOperatorEnum>;

/** Type alias for complex condition (forward reference for lazy schema) */
export type ComplexConditionType = {
  operator: LogicalOperator;
  conditions: Array<ComplexConditionType | ConditionExpression>;
};

/** Complex condition with nested logical operations (self-referential) */
export const ComplexConditionSchema: z.ZodType<ComplexConditionType> = z.lazy(() =>
  z.object({
    operator: LogicalOperatorEnum,
    conditions: z.array(z.union([ConditionExpressionSchema, ComplexConditionSchema])).min(1),
  })
);

/** Inferred type for complex condition */
export type ComplexCondition = z.infer<typeof ComplexConditionSchema>;

/** Union of simple and complex conditions (not discriminated - use 'operator' field to check) */
export const RuleConditionUnion = z.union([
  ConditionExpressionSchema,
  ComplexConditionSchema,
]);

export type RuleCondition = z.infer<typeof RuleConditionUnion>;

// ============================================================================
// Action Definitions (what happens when rule fires)
// ============================================================================

/** Type of action to take when a rule triggers */
export const ActionTypeEnum = z.enum([
  'alert',        // Create alert/notification
  'log',          // Write to audit log with severity
  'escalate',     // Escalate to supervisor/management
  'stopProcess',  // Stop production process (PLC command)
  'flagProduct',  // Flag product for quality review
  'triggerWorkflow', // Start a workflow instance (e.g., CAPA workflow)
  'webhook',      // Call external webhook
]);

export type ActionType = z.infer<typeof ActionTypeEnum>;

/** Alert action configuration */
export const AlertActionConfigSchema = z.object({
  type: z.literal('alert'),
  messageType: z.enum(['notification', 'email', 'slack']),
  recipientIds: z.array(z.string()).optional(), // Who receives the alert
});

export type AlertActionConfig = z.infer<typeof AlertActionConfigSchema>;

/** Log action configuration */
export const LogActionConfigSchema = z.object({
  type: z.literal('log'),
  severity: ViolationSeverity,
});

export type LogActionConfig = z.infer<typeof LogActionConfigSchema>;

/** Escalation action configuration */
export const EscalateActionConfigSchema = z.object({
  type: z.literal('escalate'),
  escalationLevel: z.number().int().min(1).max(5), // Which level of escalation
  targetRole: z.enum(['supervisor', 'manager', 'director']), // Role to escalate to
  timeoutMinutes: z.number().int().positive(), // If not acknowledged, escalate further
});

export type EscalateActionConfig = z.infer<typeof EscalateActionConfigSchema>;

/** Stop process action configuration */
export const StopProcessActionConfigSchema = z.object({
  type: z.literal('stopProcess'),
  assetId: z.string().min(1), // Which equipment to stop
  reasonCode: z.string().optional(), // Why the process is stopping
  notifyOperators: z.boolean().default(true),
});

export type StopProcessActionConfig = z.infer<typeof StopProcessActionConfigSchema>;

/** Flag product action configuration */
export const FlagProductActionConfigSchema = z.object({
  type: z.literal('flagProduct'),
  qualityHoldReason: z.string().min(1, 'Quality hold reason required'),
  affectedQuantity: z.number().int().positive(), // How many units to flag
  reviewRequiredBy: z.date().optional(), // When quality review must complete by
});

export type FlagProductActionConfig = z.infer<typeof FlagProductActionConfigSchema>;

/** Trigger workflow action configuration */
export const TriggerWorkflowActionConfigSchema = z.object({
  type: z.literal('triggerWorkflow'),
  workflowDefinitionId: z.string().uuid(), // Which workflow to start
  contextData: z.record(z.unknown()).optional(), // Initial data for workflow instance
});

export type TriggerWorkflowActionConfig = z.infer<typeof TriggerWorkflowActionConfigSchema>;

/** Webhook action configuration */
export const WebhookActionConfigSchema = z.object({
  type: z.literal('webhook'),
  url: z.string().url('Valid URL required'),
  method: z.enum(['POST', 'PUT']).default('POST'),
  headers: z.record(z.string()).optional(), // Custom HTTP headers
  bodyTemplate: z.string().optional(), // Template for request body (must be valid JSON)
});

export type WebhookActionConfig = z.infer<typeof WebhookActionConfigSchema>;

/** Union of all action types */
export const RuleActionUnion = z.discriminatedUnion('type', [
  AlertActionConfigSchema,
  LogActionConfigSchema,
  EscalateActionConfigSchema,
  StopProcessActionConfigSchema,
  FlagProductActionConfigSchema,
  TriggerWorkflowActionConfigSchema,
  WebhookActionConfigSchema,
]);

export type RuleAction = z.infer<typeof RuleActionUnion>;

// ============================================================================
// Complete Rule Definition (with conditions and actions)
// ============================================================================

/** Complete rule definition with conditions and actions */
export const RuleDefinitionWithGraph = RuleDefinitionBase.extend({
  conditions: z.array(RuleConditionUnion).min(1, 'Rule must have at least one condition'),
  actions: z.array(RuleActionUnion).min(1, 'Rule must have at least one action'),
  evaluationWindow: z.object({
    enabled: z.boolean().default(false),
    startTime: z.string().optional(), // HH:mm format (e.g., "08:00")
    endTime: z.string().optional(),   // HH:mm format (e.g., "17:00")
    daysOfWeek: z.array(z.enum(['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'])).optional(),
  }).optional(), // Only evaluate during specified times
  dependencies: z.array(RuleDefinitionId).optional(), // Other rules that must pass before this one is evaluated
});

export type RuleDefinitionWithGraph = z.infer<typeof RuleDefinitionWithGraph>;

// ============================================================================
// Rule Evaluation Results (runtime)
// ============================================================================

/** Result of evaluating a single condition */
export const ConditionEvaluationResultSchema = z.object({
  field: FieldPath,
  operator: ComparisonOperator,
  actualValue: z.unknown(), // What the rule evaluated to
  expectedValue: z.unknown(), // What was compared against
  passed: z.boolean(),
});

export type ConditionEvaluationResult = z.infer<typeof ConditionEvaluationResultSchema>;

/** Result of evaluating a complete rule */
export const RuleEvaluationResultSchema = z.object({
  ruleId: RuleDefinitionId,
  evaluatedAt: z.date(), // When the evaluation occurred
  contextSnapshot: z.record(z.unknown()), // The data that was evaluated (for audit trail)
  conditionResults: z.array(ConditionEvaluationResultSchema),
  allConditionsPassed: z.boolean(),
  triggeredActionIndex: z.number().int().min(0).optional(), // Which action fired (-1 if none, undefined if rule didn't trigger)
});

export type RuleEvaluationResult = z.infer<typeof RuleEvaluationResultSchema>;

// ============================================================================
// Violation Records (when rules fire)
// ============================================================================

/** Record of a rule violation - created when an active rule triggers */
export const ViolationRecordBase = z.object({
  id: z.string().uuid().optional(), // Generated on creation if not provided
  ruleId: RuleDefinitionId, // Which rule was violated
  severity: ViolationSeverity, // How serious is this violation
  createdAt: z.date(),
  acknowledgedAt: z.date().optional(), // When someone acknowledged it
  acknowledgedBy: z.string().optional(), // Who acknowledged it
  resolvedAt: z.date().optional(), // When the issue was fixed
  resolutionNotes: z.string().optional(), // How it was resolved
});

export const ViolationRecord = ViolationRecordBase.extend({
  id: z.string().uuid(), // Required for persisted violations
});

export type ViolationRecord = z.infer<typeof ViolationRecord>;

// ============================================================================
// Export Types
// ============================================================================

/** All rule definition types */
export const RuleDefinitionSchema = z.object({
  base: RuleDefinitionBase,
  withGraph: RuleDefinitionWithGraph,
  violationRecord: ViolationRecord,
});
