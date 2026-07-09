/**
 * RBAC runtime enforcement — the seam between "user is authenticated"
 * (session.ts) and "user is allowed to do this thing" (this file).
 *
 * Permission model (see packages/core-types/src/schemas/rbac.ts):
 *   - Roles → permissions mapping is hard-coded in ROLE_DEFINITIONS.
 *   - Role assignments live in the `role_assignments` DB table with two
 *     scopes:
 *       - workspace-scoped: (userId, orgId, workspaceId, roleName)
 *       - org-scoped:       (userId, orgId, NULL,       roleName)
 *     An org-scoped role grants its permissions across every workspace
 *     in that org. A workspace-scoped role only applies within its own
 *     workspace.
 *
 * Resolution algorithm:
 *   Given (userId, workspaceId):
 *     1. Look up the workspace's organizationId.
 *     2. Query role_assignments WHERE userId = ? AND organizationId = ?
 *        AND (workspaceId = ? OR workspaceId IS NULL).
 *     3. Union permissions from every matching role.
 *     4. If the required permission is in the union, the check passes.
 *        Otherwise, throw ForbiddenError → 403 FORBIDDEN.
 *
 * Design notes:
 *   - This is intentionally a per-request DB lookup. Caching the user's
 *     permissions in the session cookie is a Phase 9 optimisation — at
 *     Phase 1 the role set is small (5 roles, ~1-2 assignments per user)
 *     and the extra query is sub-millisecond on index.
 *   - We deliberately do NOT short-circuit on org-scoped 'owner' role.
 *     The union over all matching roles is the same outcome and leaves
 *     room for future role compositions without special-casing.
 *   - getUserPermissions() never throws for "no roles found" — an empty
 *     permission set is valid (viewer/guest without assignments).
 *     requirePermission() is the one that throws on miss.
 *
 * Why a separate file from session.ts?
 *   session.ts is auth-only (who is this user?) and must never depend on
 *   business data tables. rbac.ts is authorization (what may they do?)
 *   and inherently needs DB access. Mixing them would either:
 *     - Leak the persistence dependency into the middleware layer
 *       (middleware runs at edge and can't import Node modules), or
 *     - Require two separate abstractions anyway — so let the seam be
 *       the file boundary.
 */
import { eq, and, or, isNull } from 'drizzle-orm';

import type { Permission } from '@heynxt/core-types';
import { getRolePermissions, RoleName } from '@heynxt/core-types';
import { db, roleAssignments, workspaces } from '@heynxt/persistence';

import { ForbiddenError } from './api';

/**
 * Parameters accepted by the permission lookup. WorkspaceId is the
 * common case; organizationId is provided for callers that already
 * know the org scope (e.g. a workspace-create route where the body
 * carries organizationId directly).
 *
 * At least one of workspaceId or organizationId must be provided.
 */
export interface PermissionScope {
  userId: string;
  workspaceId?: string;
  organizationId?: string;
}

/**
 * Return the union of permissions granted to `userId` within the given
 * scope (workspace + org). Returns an empty array if the user has no
 * role assignments — the caller decides what to do with that.
 *
 * The returned array may contain duplicates (e.g. if the user has both
 * an org-scoped editor role and a workspace-scoped editor role — the
 * same `editor` permissions appear twice). Callers that care about
 * uniqueness can pass through a Set; for the common check "does this
 * array contain X", duplicates are harmless.
 */
export async function getUserPermissions(
  scope: PermissionScope,
): Promise<Permission[]> {
  // Resolve the organizationId if we only have a workspaceId.
  const organizationId = await resolveOrganizationIdForRbac(scope);
  if (!organizationId) {
    // No org scope could be derived — user has no permissions here.
    return [];
  }

  // Build the WHERE clause: same org, with workspace-scoped OR
  // org-scoped (workspaceId IS NULL) role rows.
  const whereClause = scope.workspaceId
    ? and(
        eq(roleAssignments.userId, scope.userId),
        eq(roleAssignments.organizationId, organizationId),
        or(
          eq(roleAssignments.workspaceId, scope.workspaceId),
          isNull(roleAssignments.workspaceId),
        ),
      )
    : and(
        eq(roleAssignments.userId, scope.userId),
        eq(roleAssignments.organizationId, organizationId),
        isNull(roleAssignments.workspaceId),
      );

  const rows = await db
    .select({ roleName: roleAssignments.roleName })
    .from(roleAssignments)
    .where(whereClause);

  // Union permissions across every role the user holds in this scope.
  // RoleName.parse validates the DB enum value before we hand it to
  // getRolePermissions() — defence in depth against enum drift between
  // DB and core-types.
  const permissions = new Set<Permission>();
  for (const row of rows) {
    const roleName = RoleName.parse(row.roleName);
    for (const perm of getRolePermissions(roleName)) {
      permissions.add(perm);
    }
  }
  return [...permissions];
}

/**
 * Resolve the organizationId from the scope. Returns the id, or null if
 * neither organizationId nor workspaceId was provided, or if the
 * workspace doesn't exist (defensive — the route will 404 on its own).
 *
 * Not exported — internal to this file.
 */
async function resolveOrganizationIdForRbac(
  scope: PermissionScope,
): Promise<string | null> {
  if (scope.organizationId) {
    return scope.organizationId;
  }
  if (!scope.workspaceId) {
    // No scope — no permissions. Caller's problem.
    return null;
  }
  const rows = await db
    .select({ organizationId: workspaces.organizationId })
    .from(workspaces)
    .where(eq(workspaces.id, scope.workspaceId))
    .limit(1);
  return rows[0]?.organizationId ?? null;
}

/**
 * Boolean check: does the user hold the given permission in scope?
 *
 * Use this for conditional UI / branching. For route handlers that want
 * to fail with 403 on miss, prefer requirePermission() below — it wraps
 * this check and throws the typed ForbiddenError.
 */
export async function hasPermission(
  scope: PermissionScope & { permission: Permission },
): Promise<boolean> {
  const permissions = await getUserPermissions(scope);
  return permissions.includes(scope.permission);
}

/**
 * Gate: throw ForbiddenError if the user lacks the given permission.
 * Called at the top of protected routes, after requireAuth(). The
 * ForbiddenError bubbles up through errorResponse() → 403 FORBIDDEN.
 *
 * Usage:
 *   const session = await requireAuth();
 *   await requirePermission({
 *     userId: session.user.id,
 *     workspaceId: input.workspaceId,
 *     permission: 'project:create',
 *   });
 *   // From this point on, the user has 'project:create' in scope.
 */
export async function requirePermission(
  scope: PermissionScope & { permission: Permission },
): Promise<void> {
  const allowed = await hasPermission(scope);
  if (!allowed) {
    throw new ForbiddenError(
      `User ${scope.userId} lacks permission '${scope.permission}' in the required scope`,
    );
  }
}
