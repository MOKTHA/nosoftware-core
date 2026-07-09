import { z } from 'zod';
import { OrganizationId } from './organization.js';

/**
 * Workspace schema — the primary execution boundary in an organization.
 *
 * Each workspace groups projects, tasks, artifacts, and generation runs.
 * All runtime isolation (quota, secret scope, agent execution context)
 * happens at workspace scope.
 *
 * Design notes:
 * - A workspace belongs to exactly one organization.
 * - A user's membership in a workspace is via a WorkspaceMembership row
 *   that references Role — kept separate (see workspace-membership.ts,
 *   deferred to Phase 1 follow-up).
 * - The slug is unique per organization, not globally (so two orgs can
 *   both have a "production" workspace).
 */

export const WorkspaceId = z.string().uuid();

export const WorkspaceSlug = z
  .string()
  .min(2)
  .max(48)
  .regex(/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/, {
    message:
      'slug must be lowercase, 2-48 chars, start/end with letter or digit, hyphens allowed in the middle',
  });

export const WorkspaceStatus = z.enum(['active', 'archived', 'suspended']);

export const Workspace = z.object({
  id: WorkspaceId,
  organizationId: OrganizationId,
  name: z.string().min(1).max(200),
  slug: WorkspaceSlug,
  description: z.string().max(2000).nullish(),
  status: WorkspaceStatus.default('active'),

  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

export type Workspace = z.infer<typeof Workspace>;
export type WorkspaceId = z.infer<typeof WorkspaceId>;
export type WorkspaceSlug = z.infer<typeof WorkspaceSlug>;
export type WorkspaceStatus = z.infer<typeof WorkspaceStatus>;

/**
 * Composite key for workspace lookups scoped to an org:
 * `organizationId + slug` must be unique across workspaces.
 */
export const WorkspaceLookupKey = z.object({
  organizationId: OrganizationId,
  slug: WorkspaceSlug,
});

export type WorkspaceLookupKey = z.infer<typeof WorkspaceLookupKey>;

export const WorkspaceSummary = Workspace.pick({
  id: true,
  organizationId: true,
  name: true,
  slug: true,
  status: true,
});

export type WorkspaceSummary = z.infer<typeof WorkspaceSummary>;

/**
 * Input schema for creating a new Workspace.
 *
 * Omits the fields that the server generates:
 *   - `id` (UUID, server-assigned)
 *   - `createdAt` / `updatedAt` (timestamps, server-assigned)
 *   - `status` (server-defaults to `'active'`)
 *
 * The client should not be allowed to set any of these on creation.
 */
export const CreateWorkspaceInput = Workspace.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).partial({
  description: true,
  status: true,
});

export type CreateWorkspaceInput = z.infer<typeof CreateWorkspaceInput>;
