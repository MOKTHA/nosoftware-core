/**
 * Barrel re-export for all Drizzle table definitions and enums.
 *
 * Consumers should import from `@heynxt/persistence` (the top-level
 * re-export), not from this file directly.
 */

// Tables
export {
  users,
  userStatusEnum,
} from './users.js';

export {
  organizations,
  organizationStatusEnum,
} from './organizations.js';

export {
  workspaces,
  workspaceStatusEnum,
} from './workspaces.js';

export {
  roleAssignments,
  roleNameEnum,
} from './role-assignments.js';

export {
  projects,
  projectStatusEnum,
} from './projects.js';

export {
  tasks,
  taskTypeEnum,
  taskStatusEnum,
} from './tasks.js';

export {
  generationRuns,
  generationRunStatusEnum,
} from './generation-runs.js';

export {
  artifacts,
  artifactKindEnum,
  artifactStorageKindEnum,
} from './artifacts.js';

export {
  auditLog,
  auditEntityTypeEnum,
  auditActionEnum,
} from './audit-log.js';

// Auth.js adapter tables (ADR-0008)
export { accounts } from './accounts.js';
export { sessions } from './sessions.js';
export { verificationTokens } from './verification-tokens.js';

// Invitation flow (Phase 1.8 — Task 23)
export { invitations, invitationStatusEnum } from './invitations.js';

// Agent execution (Phase 2)
export {
  agentSpecs,
  agentExecutionResults,
  agentTypeEnum,
  agentStatusEnum,
  executionResultStatusEnum,
} from './agent-spec.js';

// Validation runs (Phase 7.3)
export {
  validationRuns,
  type ValidationRun,
} from './validation-run.js';

export {
  validationResults,
  type ValidationResultDbRecord as ValidationResultRecord,
} from './validation-results.js';

// Approval decisions and rerun requests (Phase 7.5)
export {
  approvalDecisions,
  type ApprovalDecision,
  type InsertApprovalDecision,
} from './approval-decisions.js';

export {
  rerunRequests,
  type RerunRequest,
  type InsertRerunRequest,
} from './approval-decisions.js';

// ============================================================================
// Phase 8 — Industrial Runtime Services (NEW)
// ============================================================================

// Workflow engine tables
export {
  workflowDefinitions,
  workflowInstances,
  workflowTransitions,
  workflowDefinitionStatusEnum,
  workflowDomainEnum,
  workflowInstanceStatusEnum,
  type WorkflowDefinition,
  type InsertWorkflowDefinition,
  type WorkflowInstance,
  type InsertWorkflowInstance,
  type WorkflowTransition,
  type InsertWorkflowTransition,
} from './workflow-definitions.js';

// Runtime events (PLC signals, barcode scans, sensor data)
export {
  runtimeEvents,
  eventProcessingLog,
  eventSourceEnum,
  eventPriorityEnum,
  type RuntimeEvent,
  type InsertRuntimeEvent,
  type EventProcessingLog,
  type InsertEventProcessingLog,
} from './runtime-events.js';

// Rules engine tables
export {
  rules,
  ruleViolations,
  ruleEvaluationLog,
  ruleStatusEnum,
  violationSeverityEnum,
  ruleDomainEnum,
  type RuleDefinition,
  type InsertRule,
  type RuleViolation,
  type InsertRuleViolation,
  type RuleEvaluationLog,
  type InsertRuleEvaluationLog,
} from './rules-engine.js';

// Notification service tables
export {
  notifications,
  notificationDeliveryAttempts,
  notificationTemplates,
  notificationChannelEnum,
  notificationPriorityEnum,
  notificationStatusEnum,
  type Notification,
  type InsertNotification,
  type NotificationDeliveryAttempt,
  type InsertNotificationDeliveryAttempt,
  type NotificationTemplate,
  type InsertNotificationTemplate,
} from './notifications.js';

// File/evidence service tables (artifacts)
export {
  artifacts as fileEvidenceArtifacts, // Renamed to avoid conflict with Phase 1 artifacts table
  artifactVerificationLog,
  artifactStorageTypeEnum,
  artifactContentTypeEnum,
  storageTierEnum,
  evidenceTypeEnum,
  type Artifact as FileArtifact,
  type InsertArtifact as InsertFileArtifact,
  type ArtifactVerificationLog,
  type InsertArtifactVerificationLog,
} from './file-evidence-service.js';

// KPI aggregation tables
export {
  kpiSnapshots,
  kpiDefinitions,
  kpiCalculationJobs,
  kpiTypeEnum,
  aggregationWindowTypeEnum,
  kpiCalculationStatusEnum,
  type KpiSnapshot,
  type InsertKpiSnapshot,
  type KpiDefinition,
  type InsertKpiDefinition,
  type KpiCalculationJob,
  type InsertKpiCalculationJob,
} from './kpi-aggregation.js';
