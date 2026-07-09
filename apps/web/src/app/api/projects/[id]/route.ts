/**
 * PATCH /api/projects/[id] — project status transition (Phase 1.7).
 *
 * This is the first route that mutates an existing row; it was chosen as
 * the enabler for the exit criterion:
 *   "Activity log records state transitions per entity"
 * because nothing upstream had ever produced a `status_changed` /
 * `status-changed` audit entry — all five POST routes emit `created` only.
 *
 * Scope (intentionally narrow):
 *   - The PATCH accepts ONLY `{ status, reason? }`.
 *   - `UpdateProjectStatusInput` (core-types) is the body schema.
 *   - Allowed transitions (single source of truth in core-types):
 *       draft  → active
 *       active → archived
 *       *      → <same>   (no-op; 200, no UPDATE, no audit row)
 *     "archived" IS terminal for v1 — Phase 9 governance adds restore.
 *
 * Conventions:
 *   - JSON body / JSON response only.
 *   - Errors follow `{ error, code, fields? }` via `errorResponse()`.
 *   - `updatedAt` is set server-side; `status` is the only mutated column.
 *   - Authentication is required (status change is a write).
 *   - The actor comes from the session (ADR-0006 — createdBy session sweep).
 *   - The status-change audit entry is best-effort: insert failures are
 *     logged but never roll back the UPDATE. Same discipline as the
 *     POST creation audit in Task 20.
 *
 * Why status-only?
 *   A generic "update any project field" PATCH mixes two concerns:
 *   business-field updates (name, slug, description) with FSM transitions
 *   (status). Each deserves its own audit action. Status transitions
 *   carry `action: 'status-changed'`; field updates will later carry
 *   `action: 'updated'` once the product calls for them. Keeping this
 *   route single-purpose also keeps the validation graph legible.
 */
import { NextRequest, NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';

import {
  isProjectStatusTransitionAllowed,
  Project,
  ProjectId,
  type ProjectStatus,
  UpdateProjectStatusInput,
} from '@heynxt/core-types';
import { db, projects } from '@heynxt/persistence';

import { badRequest, errorResponse, notFound, parseJsonBody } from '@/lib/api';
import { insertStatusChangeEntry } from '@/lib/audit';
import { requireAuth } from '@/lib/session';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// ---------------------------------------------------------------------------
// PATCH /api/projects/[id]
// ---------------------------------------------------------------------------

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    // --- auth + body parsing ------------------------------------------------
    const session = await requireAuth();
    const actorId = session.user.id;

    // Validate the id segment up front so a malformed UUID produces a
    // clean 400 before we hit the SELECT.
    let projectId: string;
    try {
      projectId = ProjectId.parse(params.id);
    } catch {
      return errorResponse(
        badRequest(
          'Project id must be a UUID',
          'INVALID_PATH_PARAM',
          { id: ['must be a UUID'] },
        ),
      );
    }

    const body = await parseJsonBody(req);
    const input = UpdateProjectStatusInput.parse(body);
    const newStatus = input.status;

    // --- fetch the existing row ---------------------------------------------
    const rows = await db
      .select()
      .from(projects)
      .where(eq(projects.id, projectId))
      .limit(1);
    const existing = rows[0];

    if (!existing) {
      return errorResponse(
        notFound(`Project ${projectId} not found`, 'PROJECT_NOT_FOUND'),
      );
    }

    // Parse the stored row through the core-types Project schema so we
    // can trust `existing.project.status` as a typed ProjectStatus below.
    const existingProject = Project.parse(existing);
    const previousStatus: ProjectStatus = existingProject.status;

    // --- transition validation ---------------------------------------------
    if (!isProjectStatusTransitionAllowed(previousStatus, newStatus)) {
      return errorResponse(
        badRequest(
          `Transition from ${previousStatus} to ${newStatus} is not allowed`,
          'INVALID_STATUS_TRANSITION',
          {
            status: [
              `cannot move from '${previousStatus}' to '${newStatus}'`,
            ],
          },
        ),
      );
    }

    // --- same-status no-op -------------------------------------------------
    // `draft → draft` is treated as idempotent: the current project is
    // returned as 200 without a DB UPDATE or an audit row. This matches
    // the "allowed transitions" documentation in core-types and avoids
    // spamming the audit log with redundant entries from retries.
    if (previousStatus === newStatus) {
      return NextResponse.json({ project: existingProject }, { status: 200 });
    }

    // --- perform the UPDATE -------------------------------------------------
    const now = new Date();
    const updated = await db
      .update(projects)
      .set({ status: newStatus, updatedAt: now })
      .where(eq(projects.id, projectId))
      .returning();

    if (!updated[0]) {
      // Should be unreachable given the SELECT above, but guard anyway.
      throw new Error('UPDATE returned zero rows');
    }

    const project = Project.parse({ ...updated[0] });

    // --- audit --------------------------------------------------------------
    // Best-effort. If the audit insert fails we console.error and still
    // return 200 — matching the Task 20 convention that audit failures
    // never roll back the caller's success.
    await insertStatusChangeEntry({
      workspaceId: project.workspaceId,
      entityType: 'project',
      entityId: project.id,
      actorId,
      previousStatus,
      newStatus,
      reason: input.reason ?? null,
    });

    return NextResponse.json({ project }, { status: 200 });
  } catch (err) {
    return errorResponse(err);
  }
}
