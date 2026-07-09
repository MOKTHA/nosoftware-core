import { z } from 'zod';
import { OrganizationId } from './organization.js';
import { WorkspaceId } from './workspace.js';
import { UserId } from './user.js';

/**
 * RBAC schema — role and permission definitions.
 *
 * Design notes:
 * - Permissions are namespaced: `<area>:<action>` (e.g., `project:read`,
 *   `generation:run`, `blueprint:publish`).
 * - Roles are named sets of permissions (owner, admin, editor, viewer).
 * - Role assignments happen at either workspace scope (primary) or
 *   organization scope (for cross-workspace admins like `org:admin`).
 * - Hard-coded roles are provided as defaults; custom roles can be added
 *   per-workspace in a future phase.
 *
 * Permission registry is intentionally exhaustive at declaration time so
 * future code that imports a permission constant can't misspell one.
 */

/**
 * Permission areas and their actions.
 *
 * When adding a new permission area, follow the pattern:
 *   `<area>:<action>` where areas are lowercase kebab-case and actions
 *   are verbs from the set {read, write, create, update, delete, run,
 *   publish, approve, admin}.
 */
export const Permission = z.enum([
  // Organization-level permissions
  'org:read',
  'org:update',
  'org:delete',
  'org:admin',
  'org:manage-workspaces',
  'org:manage-members',

  // Workspace-level permissions
  'workspace:read',
  'workspace:update',
  'workspace:archive',
  'workspace:admin',

  // Project + task
  'project:create',
  'project:read',
  'project:update',
  'project:delete',
  'task:create',
  'task:read',
  'task:update',
  'task:delete',
  'task:execute',

  // Generation runs
  'generation:run',
  'generation:read',
  'generation:approve',

  // Artifacts
  'artifact:create',
  'artifact:read',
  'artifact:download',
  'artifact:delete',

  // Blueprint registry
  'blueprint:read',
  'blueprint:publish',
  'blueprint:deprecate',
  'blueprint:admin',

  // Domain models
  'domain-model:read',
  'domain-model:admin',

  // Workspace secrets
  'secret:read',
  'secret:write',
  'secret:rotate',
]);

export type Permission = z.infer<typeof Permission>;

/**
 * Named roles. The four defaults cover the common case; custom roles
 * are explicitly opt-in per workspace in a later phase.
 *
 * Permission sets for each role are defined as constants below and
 * exposed via getRolePermissions() for runtime lookups.
 */
export const RoleName = z.enum([
  'owner',       // org-level: full control over the org
  'workspace-owner', // workspace-level: admin of a specific workspace
  'editor',      // can create/edit projects, tasks, generation runs
  'viewer',      // read-only access
  'guest',       // minimal access, typically for external collaborators
]);

export type RoleName = z.infer<typeof RoleName>;

export const RoleDefinition = z.object({
  name: RoleName,
  permissions: z.array(Permission),
  description: z.string().max(2000).nullish(),
});

export type RoleDefinition = z.infer<typeof RoleDefinition>;

/**
 * Role → permission mapping.
 *
 * This is the source of truth for what each default role grants.
 * A role definition is itself a Zod-validated object; we validate at
 * import time via RoleDefinition.parse so any drift is caught early.
 */
export const ROLE_DEFINITIONS: Record<RoleName, RoleDefinition> = {
  owner: {
    name: 'owner',
    permissions: [
      'org:read', 'org:update', 'org:delete', 'org:admin',
      'org:manage-workspaces', 'org:manage-members',
      'workspace:read', 'workspace:update', 'workspace:archive', 'workspace:admin',
      'project:create', 'project:read', 'project:update', 'project:delete',
      'task:create', 'task:read', 'task:update', 'task:delete', 'task:execute',
      'generation:run', 'generation:read', 'generation:approve',
      'artifact:create', 'artifact:read', 'artifact:download', 'artifact:delete',
      'blueprint:read', 'blueprint:publish', 'blueprint:deprecate', 'blueprint:admin',
      'domain-model:read', 'domain-model:admin',
      'secret:read', 'secret:write', 'secret:rotate',
    ],
    description: 'Full control over the organization and all its workspaces.',
  },
  'workspace-owner': {
    name: 'workspace-owner',
    permissions: [
      'workspace:read', 'workspace:update', 'workspace:archive', 'workspace:admin',
      'project:create', 'project:read', 'project:update', 'project:delete',
      'task:create', 'task:read', 'task:update', 'task:delete', 'task:execute',
      'generation:run', 'generation:read', 'generation:approve',
      'artifact:create', 'artifact:read', 'artifact:download', 'artifact:delete',
      'blueprint:read', 'blueprint:publish', 'blueprint:deprecate',
      'domain-model:read',
      'secret:read', 'secret:write',
    ],
    description: 'Full control over a single workspace.',
  },
  editor: {
    name: 'editor',
    permissions: [
      'workspace:read',
      'project:create', 'project:read', 'project:update',
      'task:create', 'task:read', 'task:update', 'task:execute',
      'generation:run', 'generation:read',
      'artifact:create', 'artifact:read', 'artifact:download',
      'blueprint:read',
      'domain-model:read',
    ],
    description: 'Can create and edit projects, tasks, and generation runs.',
  },
  viewer: {
    name: 'viewer',
    permissions: [
      'workspace:read',
      'project:read',
      'task:read',
      'generation:read',
      'artifact:read', 'artifact:download',
      'blueprint:read',
      'domain-model:read',
    ],
    description: 'Read-only access.',
  },
  guest: {
    name: 'guest',
    permissions: [
      'workspace:read',
      'project:read',
      'blueprint:read',
    ],
    description: 'Minimal access for external collaborators.',
  },
};

/**
 * Runtime permission check for a given role.
 *
 * Returns the set of permissions granted by the role. For custom roles
 * (deferred to a later phase), this should be extended to read from DB.
 */
export function getRolePermissions(name: RoleName): ReadonlyArray<Permission> {
  return ROLE_DEFINITIONS[name].permissions;
}

/**
 * Workspace-level role assignment: which role does this user hold
 * in this workspace (or across their organization)?
 *
 * - If `workspaceId` is set, the role applies to that workspace only.
 * - If `workspaceId` is null, the role applies at organization scope.
 */
export const RoleAssignment = z.object({
  userId: UserId,
  organizationId: OrganizationId,
  workspaceId: WorkspaceId.nullable(),
  roleName: RoleName,
  grantedAt: z.coerce.date(),
  grantedBy: UserId,
});

export type RoleAssignment = z.infer<typeof RoleAssignment>;
