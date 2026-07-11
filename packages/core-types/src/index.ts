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
 *   ParseResult, ValidationResult
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
