/**
 * @heynxt/core-types
 *
 * Shared Zod schemas and TypeScript types for the HeyNXT platform.
 * This is the contract layer — every other package depends on these types.
 *
 * For each schema export, both the Zod value (for runtime validation)
 * and the inferred TypeScript type (via `z.infer`) are exported with
 * the same name. Consumers can use either form:
 *
 *   import { User, type User } from '@heynxt/core-types';
 *   //    ^^^ Zod schema     ^^^ TypeScript type
 *
 * Current schemas (Phase 1 — Product Control Plane):
 *
 *   Identity & tenancy:
 *     User, Organization, Workspace
 *
 *   RBAC:
 *     Permission, RoleName, RoleDefinition, ROLE_DEFINITIONS,
 *     RoleAssignment, getRolePermissions()
 *
 *   Execution domain:
 *     Project, ProjectStatus
 *     Task, TaskStatus, TaskType
 *     GenerationRun, GenerationRunStatus, GenerationRunSnapshot
 *     Artifact, ArtifactKind, ArtifactStorageKind
 *
 *   Audit:
 *     AuditLogEntry, AuditEntityType, AuditAction, createStatusChangeEntry()
 *
 *   Invitations (Phase 1.8):
 *     Invitation, InvitationStatus, InvitationSummary, InviteUserInput
 *
 * Agent execution (Phase 2):
 *   AgentSpec, AgentType, AgentStatus, AgentSpecId, AgentSpecSummary
 *   ExecutionConfig
 *   AgentExecutionResult, ExecutionResultStatus
 *   TaskPayload, TaskPriority, TaskPayloadSummary
 *
 * Blueprint registry (Phase 3):
 *   BlueprintMetadata, BlueprintFamily, BlueprintDomain, BlueprintTag
 *   DomainEntity, CompositionPlan, BlueprintPack
 *
 * Prompt-to-spec engine (Phase 4):
 *   PromptSpec, SpecTemplate, ParsedIntent, PromptContext
 *   AppType, ScreenDefinition, ApiEndpointDefinition
 *   ParseResult, ValidationErrors (Phase 4 prompt validation)
 *   Note: Phase 7 uses ValidationResult (from generation-pipeline) for validation check results;
 *         ValidationRunResult and ValidationRunRecord from validation-stage are legacy names.
 */

// Control plane — identity and tenancy
export * from './schemas/user.js';
export * from './schemas/organization.js';
export * from './schemas/workspace.js';

// Control plane — RBAC
export * from './schemas/rbac.js';

// Control plane — invitations (Phase 1.8 — Task 23)
export * from './schemas/invitation.js';

// Control plane — execution domain
export * from './schemas/project.js';
export * from './schemas/task.js';
export * from './schemas/generation-run.js';
export * from './schemas/artifact.js';

// Control plane — audit
export * from './schemas/audit-log.js';

// Agent execution (Phase 2)
export * from './schemas/agent-spec.js';
export * from './schemas/task-payload.js';

// Blueprint registry (Phase 3)
export * from './schemas/blueprint.js';

// Prompt-to-spec engine (Phase 4)
export * from './schemas/prompt-spec.js';

// App spec schemas (LLM-generated application specification)
export * from './schemas/app-spec.js';

// Generation pipeline orchestration (Phase 6 + Phase 7 validation types)
export {
  GenerationStageName,
  GenerationStageExecution,
  GenerationArtifact,
  GenerationStageInput,
  GenerationStageOutput,
  GenerationPipelineExecution,
  CreatePipelineInput,
  RequiredStages,
  StageExecutionOrder,
  StageDependencies,
} from './schemas/generation-pipeline.js';

// Validation and review loop (Phase 7) - main types defined in generation-pipeline for unified access
export {
  ValidationCheckType,
  ValidationResult, // Phase 7 validation check result (distinct from Phase 4 prompt ValidationResult)
  ValidationStageInput,
  ValidationStageOutput,
  ValidationStageName,
} from './schemas/generation-pipeline.js';

// Legacy Phase 7 exports (for backward compatibility - re-exported from generation-pipeline via validation-stage.ts)
export {
  ValidationRunResult,
  ValidationRunRecord,
  ValidationEvidence,
  ApprovalDecision,
  RerunRequest,
  PRMetadata,
} from './schemas/validation-stage.js';

// Type aliases for convenience (Phase 7)
export type {
  ValidationCheckResult as ValidationCheckTypeCore, // Alias for ValidationResult
  ValidationRunRecordType as ValidationRunRecordTypeAlias, // Alias for ValidationRunRecord
} from './schemas/validation-stage.js';

// ============================================================================
// Phase 8 — Industrial Runtime Services (NEW - schemas defined in this session)
// Exported as separate namespace to avoid conflicts with existing exports
// ============================================================================

/** Workflow definitions and state machines */
export * as workflowDefinitions from './schemas/workflow-definitions.js';

/** Runtime events (PLC signals, barcode scans, sensor data) */
export * as runtimeEvents from './schemas/runtime-events.js';

/** Rules engine (business rules evaluated at runtime) */
export * as rulesEngine from './schemas/rules-engine.js';

/** Notification service (email, Slack, webhook) */
export * as notifications from './schemas/notifications.js';

/** File/evidence service (artifact persistence and serving) */
export * as fileEvidenceService from './schemas/file-evidence-service.js';

/** KPI aggregation (OEE, throughput, quality metrics) */
export * as kpiAggregation from './schemas/kpi-aggregation.js';

// Export schema unions for convenience (Phase 8)
export { RuleDefinitionSchema } from './schemas/rules-engine.js';
export { FileEvidenceServiceSchema } from './schemas/file-evidence-service.js';

// ============================================================================
// Phase 8 exports complete - all runtime service schemas are now available