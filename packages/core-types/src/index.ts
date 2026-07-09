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
 * TODO: Define remaining core schemas (Phase 4+):
 *   - AgentSpec schema (agent configuration contract)
 *   - PromptSpec schema (prompt-to-spec input/output types)
 *   - Blueprint schema (industrial recipe definition)
 *   - DomainModel schema (industrial entity types)
 */

// Control plane — identity and tenancy
export * from './schemas/user.js';
export * from './schemas/organization.js';
export * from './schemas/workspace.js';

// Control plane — RBAC
export * from './schemas/rbac.js';

// Control plane — execution domain
export * from './schemas/project.js';
export * from './schemas/task.js';
export * from './schemas/generation-run.js';
export * from './schemas/artifact.js';

// Control plane — audit
export * from './schemas/audit-log.js';
