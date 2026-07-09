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
 * Current schemas:
 *   - Control plane: User, Organization, Workspace, RoleAssignment
 *   - RBAC: Permission, RoleName, RoleDefinition, ROLE_DEFINITIONS,
 *     getRolePermissions()
 *
 * TODO: Define remaining core schemas (Phase 1+):
 *   - Project schema
 *   - Task schema + TaskStatus FSM
 *   - Artifact schema
 *   - GenerationRun schema
 *   - AgentSpec schema (agent configuration contract)
 *   - PromptSpec schema (prompt-to-spec input/output types)
 *   - Blueprint schema (industrial recipe definition)
 *   - DomainModel schema (industrial entity types)
 */

// Control plane
export * from './schemas/user.js';
export * from './schemas/organization.js';
export * from './schemas/workspace.js';

// RBAC
export * from './schemas/rbac.js';
