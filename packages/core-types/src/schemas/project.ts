import { z } from 'zod';
import { WorkspaceId } from './workspace.js';
import { UserId } from './user.js';

/**
 * Project schema — a unit of work inside a workspace.
 *
 * A project groups related tasks, generation runs, and artifacts. It is the
 * primary organizational boundary below workspace: one workspace can contain
 * many projects; each task belongs to exactly one project.
 *
 * Design notes:
 * - The slug is unique per workspace (not globally), so two workspaces
 *   can each have a "my-app" project.
 * - The status FSM is intentionally small: DRAFT → ACTIVE → ARCHIVED.
 *   A project in DRAFT is being configured; ACTIVE is the normal working
 *   state; ARCHIVED is read-only. There is no "deleted" state — soft
 *   deletes should use ARCHIVED plus a policy that eventually purges
 *   archived projects (see Phase 9 governance hardening).
 * - `createdBy` tracks who created the project. Ownership transfer, if
 *   needed, happens at the API layer via a separate mutation.
 */

export const ProjectId = z.string().uuid();

export const ProjectSlug = z
  .string()
  .min(2)
  .max(64)
  .regex(/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/, {
    message:
      'slug must be lowercase, 2-64 chars, start/end with letter or digit, hyphens allowed in the middle',
  });

export const ProjectStatus = z.enum(['draft', 'active', 'archived']);

export const Project = z.object({
  id: ProjectId,
  workspaceId: WorkspaceId,
  name: z.string().min(1).max(200),
  slug: ProjectSlug,
  description: z.string().max(2000).nullish(),
  status: ProjectStatus.default('draft'),

  createdBy: UserId,

  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

export type Project = z.infer<typeof Project>;
export type ProjectId = z.infer<typeof ProjectId>;
export type ProjectSlug = z.infer<typeof ProjectSlug>;
export type ProjectStatus = z.infer<typeof ProjectStatus>;

/**
 * Subset used when embedding projects in task details, generation runs, or UI lists.
 */
export const ProjectSummary = Project.pick({
  id: true,
  workspaceId: true,
  name: true,
  slug: true,
  status: true,
});

export type ProjectSummary = z.infer<typeof ProjectSummary>;

/**
 * Composite key for project lookups scoped to a workspace:
 * `workspaceId + slug` must be unique across projects.
 */
export const ProjectLookupKey = z.object({
  workspaceId: WorkspaceId,
  slug: ProjectSlug,
});

export type ProjectLookupKey = z.infer<typeof ProjectLookupKey>;
