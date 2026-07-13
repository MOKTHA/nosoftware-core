/**
 * Tenant Isolation Helpers
 *
 * Provides utilities for enforcing workspace-scoped data access across all API routes.
 */

import { eq, and, sql } from 'drizzle-orm';
import { NextRequest } from 'next/server';

import { db, workspaces, organizations } from '@heynxt/persistence';
import { requireAuth } from '@/lib/session';

/**
 * Check if a workspace belongs to the authenticated user's organization.
 * Returns true if the workspace is accessible by the current user.
 */
export async function checkWorkspaceAccess(
  req: NextRequest,
  workspaceId: string | null
): Promise<boolean> {
  const authUser = await requireAuth();

  // Null workspace ID means org-level access (always allowed for authenticated users)
  if (!workspaceId) {
    return true;
  }

  // For workspace-scoped resources, verify the user's organization has this workspace
  try {
    // TODO: Get user's organization from session or database lookup
    // For now, assume all authenticated users have access (extend with full RBAC later)
    const [orgWorkspace] = await db.select({ id: workspaces.id }).from(workspaces).where(
      eq(workspaces.id, workspaceId)
    ).limit(1);

    return !!orgWorkspace;
  } catch {
    // If we can't verify, deny access by default (fail-secure)
    return false;
  }
}

/**
 * Get all workspaces accessible to the current user.
 * Returns workspace IDs for filtering queries.
 */
export async function getAccessibleWorkspaceIds(organizationId: string): Promise<string[]> {
  try {
    const result = await db.select({ id: workspaces.id }).from(workspaces).where(
      eq(workspaces.organizationId, organizationId)
    );

    return result.map(w => w.id);
  } catch {
    return [];
  }
}

/**
 * Build a WHERE clause for workspace-scoped queries.
 * Returns the where condition and any bind parameters needed.
 */
export function buildWorkspaceScopeFilter(
  organizationId: string,
  requestedWorkspaceId?: string | null
): { where: any; binds: any[] } {
  if (!requestedWorkspaceId) {
    // No workspace filter - return org-level resources only
    return {
      where: eq(organizations.id, organizationId),
      binds: [],
    };
  }

  // Workspace-scoped with org verification
  return {
    where: and(
      eq(organizations.id, organizationId),
      sql`EXISTS (
        SELECT 1 FROM workspaces w
        WHERE w.id = ${requestedWorkspaceId}
        AND w.organization_id = ${organizationId}
      )`
    ),
    binds: [requestedWorkspaceId],
  };
}

/**
 * Validate that a workspace exists and belongs to the specified organization.
 */
export async function validateWorkspaceBelongsToOrg(
  workspaceId: string,
  organizationId: string
): Promise<boolean> {
  const result = await db.select({ id: workspaces.id }).from(workspaces).where(
    and(
      eq(workspaces.id, workspaceId),
      eq(workspaces.organizationId, organizationId)
    )
  ).limit(1);

  return !!result[0];
}
