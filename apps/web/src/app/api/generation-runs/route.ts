/**
 * /api/generation-runs — generation run CRUD API (Phase 1.7 — Task 7 slice).
 *
 *   GET  /api/generation-runs?workspaceId=<uuid>[&projectId=<uuid>][&taskId=<uuid>]
 *     List generation runs in the given workspace, optionally filtered.
 *     Empty array (200) when no runs exist.
 *
 *   POST /api/generation-runs
 *     Create a generation run. Body: CreateGenerationRunInput.
 *       { workspaceId, projectId, taskId, snapshot? }
 *     `createdBy` is derived from the authenticated session.
 *     Server auto-computes `runNumber` as MAX(runNumber)+1 within the task.
 *     Returns 201 with the created run.
 *     401 when the request is not authenticated.
 */
import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';
import { eq, and, sql } from 'drizzle-orm';

import {
  CreateGenerationRunInput,
  TaskId,
  ProjectId,
  GenerationRun,
  WorkspaceId,
} from '@heynxt/core-types';
import { db, generationRuns } from '@heynxt/persistence';

import { badRequest, errorResponse, parseJsonBody } from '@/lib/api';
import { insertAuditEntry } from '@/lib/audit';
import { requireAuth } from '@/lib/session';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// ---------------------------------------------------------------------------
// GET /api/generation-runs?workspaceId=<uuid>[&projectId=<uuid>][&taskId=<uuid>]
// ---------------------------------------------------------------------------

export async function GET(req: NextRequest) {
  try {
    const workspaceIdRaw = req.nextUrl.searchParams.get('workspaceId');
    const projectIdRaw = req.nextUrl.searchParams.get('projectId');
    const taskIdRaw = req.nextUrl.searchParams.get('taskId');

    if (!workspaceIdRaw) {
      throw badRequest(
        '`workspaceId` query parameter is required',
        'MISSING_WORKSPACE_ID',
      );
    }

    const workspaceId = WorkspaceId.parse(workspaceIdRaw);

    // Build a where clause — optionally filtered by projectId and/or taskId.
    const conditions = [eq(generationRuns.workspaceId, workspaceId)];

    if (projectIdRaw) {
      conditions.push(eq(generationRuns.projectId, ProjectId.parse(projectIdRaw)));
    }

    if (taskIdRaw) {
      conditions.push(eq(generationRuns.taskId, TaskId.parse(taskIdRaw)));
    }

    const where = conditions.length === 1 ? conditions[0] : and(...conditions);

    const rows = await db
      .select()
      .from(generationRuns)
      .where(where)
      .orderBy(generationRuns.createdAt);

    return NextResponse.json({ generationRuns: rows }, { status: 200 });
  } catch (err) {
    return errorResponse(err);
  }
}

// ---------------------------------------------------------------------------
// POST /api/generation-runs
// ---------------------------------------------------------------------------

export async function POST(req: NextRequest) {
  try {
    const session = await requireAuth();
    const createdBy = session.user.id;

    const body = await parseJsonBody(req);

    const input = CreateGenerationRunInput.parse(body);

    const now = new Date();
    const id = randomUUID();

    // Compute next runNumber for this task: MAX(runNumber) + 1, or 1 if none exist.
    const maxRunResult = await db
      .select({ maxRun: sql<number>`max(${generationRuns.runNumber})` })
      .from(generationRuns)
      .where(eq(generationRuns.taskId, input.taskId));

    const maxRun = maxRunResult[0]?.maxRun ?? 0;
    const runNumber = maxRun + 1;

    const [created] = await db
      .insert(generationRuns)
      .values({
        id,
        workspaceId: input.workspaceId,
        projectId: input.projectId,
        taskId: input.taskId,
        runNumber,
        status: 'pending',
        snapshot: input.snapshot ?? {
          specId: null,
          specHash: null,
          blueprintPlanId: null,
          blueprintPlanHash: null,
        },
        agentSessionId: null,
        createdBy,
        startedAt: null,
        completedAt: null,
        createdAt: now,
        updatedAt: now,
      })
      .returning();

    if (!created) throw new Error('INSERT returned zero rows');

    const run = GenerationRun.parse(created);

    // Record the creation in the audit log. Best-effort.
    await insertAuditEntry({
      workspaceId: input.workspaceId,
      entityType: 'generation-run',
      entityId: run.id,
      action: 'created',
      actorId: createdBy,
      after: {
        id: run.id,
        runNumber: run.runNumber,
        status: run.status,
      },
    });

    return NextResponse.json({ generationRun: run }, { status: 201 });
  } catch (err) {
    if (
      err instanceof Error &&
      'code' in err &&
      (err as { code: string }).code === '23503'
    ) {
      return errorResponse(
        badRequest(
          'The referenced workspace, project, task, or user does not exist',
          'FOREIGN_KEY_VIOLATION',
        ),
      );
    }
    return errorResponse(err);
  }
}
