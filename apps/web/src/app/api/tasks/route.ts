/**
 * /api/tasks — task CRUD API (Phase 1.6 — Task 6 slice).
 *
 *   GET  /api/tasks?workspaceId=<uuid>[&projectId=<uuid>]
 *     List tasks in the given workspace, optionally filtered by project.
 *     Empty array (200) when no tasks exist.
 *
 *   POST /api/tasks
 *     Create a task. Body: CreateTaskInput.
 *       { workspaceId, projectId, type, title,
 *         description?, inputPrompt?, createdBy }
 *     Returns 201 with the created task.
 *
 * Auth / RBAC is deferred to a later slice.
 */
import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';
import { eq, and } from 'drizzle-orm';

import {
  CreateTaskInput,
  ProjectId,
  Task,
  WorkspaceId,
} from '@heynxt/core-types';
import { db, tasks } from '@heynxt/persistence';

import { badRequest, errorResponse, parseJsonBody } from '@/lib/api';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// ---------------------------------------------------------------------------
// GET /api/tasks?workspaceId=<uuid>[&projectId=<uuid>]
// ---------------------------------------------------------------------------

export async function GET(req: NextRequest) {
  try {
    const workspaceIdRaw = req.nextUrl.searchParams.get('workspaceId');
    const projectIdRaw = req.nextUrl.searchParams.get('projectId');

    if (!workspaceIdRaw) {
      throw badRequest(
        '`workspaceId` query parameter is required',
        'MISSING_WORKSPACE_ID',
      );
    }

    const workspaceId = WorkspaceId.parse(workspaceIdRaw);

    // Build a where clause — optionally filtered by projectId.
    const where = projectIdRaw
      ? and(
          eq(tasks.workspaceId, workspaceId),
          eq(tasks.projectId, ProjectId.parse(projectIdRaw)),
        )
      : eq(tasks.workspaceId, workspaceId);

    const rows = await db
      .select()
      .from(tasks)
      .where(where)
      .orderBy(tasks.createdAt);

    return NextResponse.json({ tasks: rows }, { status: 200 });
  } catch (err) {
    return errorResponse(err);
  }
}

// ---------------------------------------------------------------------------
// POST /api/tasks
// ---------------------------------------------------------------------------

export async function POST(req: NextRequest) {
  try {
    const body = await parseJsonBody(req);

    const input = CreateTaskInput.parse(body);

    const now = new Date();
    const id = randomUUID();

    const [created] = await db
      .insert(tasks)
      .values({
        id,
        workspaceId: input.workspaceId,
        projectId: input.projectId,
        type: input.type,
        title: input.title,
        description: input.description ?? null,
        inputPrompt: input.inputPrompt ?? null,
        createdBy: input.createdBy,
        status: 'draft',
        completedAt: null,
        createdAt: now,
        updatedAt: now,
      })
      .returning();

    if (!created) throw new Error('INSERT returned zero rows');

    const task = Task.parse(created);
    return NextResponse.json({ task }, { status: 201 });
  } catch (err) {
    if (
      err instanceof Error &&
      'code' in err &&
      (err as { code: string }).code === '23503'
    ) {
      return errorResponse(
        badRequest(
          'The referenced workspace, project, or user does not exist',
          'FOREIGN_KEY_VIOLATION',
        ),
      );
    }
    return errorResponse(err);
  }
}
