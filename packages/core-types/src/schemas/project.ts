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

/**
 * Input schema for creating a new Project.
 *
 * Omits server-generated fields:
 *   - `id` (UUID, server-assigned)
 *   - `createdAt` / `updatedAt` (timestamps, server-assigned)
 *   - `status` (server-defaults to `'draft'`)
 *
 * `createdBy` is omitted from the input — the API derives it from the
 * authenticated session (see `apps/web/src/app/api/projects/route.ts`).
 * Callers cannot set it directly; the server enforces the audit trail.
 */
export const CreateProjectInput = Project.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  status: true,
  createdBy: true,
}).partial({
  description: true,
});

export type CreateProjectInput = z.infer<typeof CreateProjectInput>;

/**
 * Allowed status transitions for the project lifecycle.
 *
 * The FSM is intentionally small and forward-only:
 *   draft  → active  (project is being configured → ready for work)
 *   active → archived (project is finished → read-only, pending Phase 9 purge)
 *
 * `archived` is terminal for v1 — restoration is a governance concern that
 * belongs to Phase 9. If a future phase wants to support reactivation
 * (archived → active), add the entry here and document the audit trail
 * requirement; no other code will need to change.
 *
 * Same-status transitions (`draft` → `draft`, etc.) are treated as
 * idempotent no-ops at the API layer — the route will still 200 with the
 * current project, but no UPDATE is issued and no audit entry is emitted.
 * Kept here (rather than in the route) so the rule is co-located with
 * the transition graph itself.
 */
export const ALLOWED_PROJECT_STATUS_TRANSITIONS: Readonly<
  Record<ProjectStatus, ReadonlyArray<ProjectStatus>>
> = {
  draft: ['draft', 'active'],
  active: ['active', 'archived'],
  archived: ['archived'],
} as const;

/**
 * Returns true when `fromStatus` → `toStatus` is an allowed project state
 * transition (or a no-op same-status). Use this at the API boundary to
 * reject illegal transitions with 400 before touching the database.
 */
export function isProjectStatusTransitionAllowed(
  fromStatus: ProjectStatus,
  toStatus: ProjectStatus,
): boolean {
  return ALLOWED_PROJECT_STATUS_TRANSITIONS[fromStatus].includes(toStatus);
}

/**
 * Input schema for `PATCH /api/projects/[id]` — currently status-only.
 *
 * We deliberately do NOT accept the full `Project` here. A partial update
 * of arbitrary fields belongs in a separate `UpdateProjectInput` when the
 * product needs it; mixing status FSM with generic updates muddies both
 * validation and audit semantics. A status transition is its own concern
 * with its own audit action (`status-changed`).
 *
 * `reason` is optional. Callers may attach a human-readable note that
 * ends up in the audit log (e.g., "Ready for dev work" when activating).
 */
export const UpdateProjectStatusInput = z.object({
  status: ProjectStatus,
  reason: z.string().max(2000).nullish(),
});

export type UpdateProjectStatusInput = z.infer<typeof UpdateProjectStatusInput>;
