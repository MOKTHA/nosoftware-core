/**
 * /api/artifacts — artifact CRUD API (Phase 1.7 — Task 7 slice).
 *
 *   GET  /api/artifacts?workspaceId=<uuid>[&generationRunId=<uuid>][&taskId=<uuid>]
 *     List artifacts in the given workspace, optionally filtered.
 *     Empty array (200) when no artifacts exist.
 *
 *   POST /api/artifacts
 *     Create an artifact. Body: CreateArtifactInput.
 *       { workspaceId, projectId, taskId, generationRunId, kind, storageKind,
 *         name, mimeType?, textContent?, storageUrl?, storageRef?,
 *         contentHash?, byteSize? }
 *     `createdBy` is derived from the authenticated session.
 *     Returns 201 with the created artifact.
 *     401 when the request is not authenticated.
 */
import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';
import { eq, and } from 'drizzle-orm';

import {
  CreateArtifactInput,
  GenerationRunId,
  TaskId,
  Artifact,
  WorkspaceId,
} from '@heynxt/core-types';
import { db, artifacts } from '@heynxt/persistence';

import { badRequest, errorResponse, parseJsonBody } from '@/lib/api';
import { requireAuth } from '@/lib/session';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// ---------------------------------------------------------------------------
// GET /api/artifacts?workspaceId=<uuid>[&generationRunId=<uuid>][&taskId=<uuid>]
// ---------------------------------------------------------------------------

export async function GET(req: NextRequest) {
  try {
    const workspaceIdRaw = req.nextUrl.searchParams.get('workspaceId');
    const generationRunIdRaw = req.nextUrl.searchParams.get('generationRunId');
    const taskIdRaw = req.nextUrl.searchParams.get('taskId');

    if (!workspaceIdRaw) {
      throw badRequest(
        '`workspaceId` query parameter is required',
        'MISSING_WORKSPACE_ID',
      );
    }

    const workspaceId = WorkspaceId.parse(workspaceIdRaw);

    // Build a where clause — optionally filtered by generationRunId and/or taskId.
    const conditions = [eq(artifacts.workspaceId, workspaceId)];

    if (generationRunIdRaw) {
      conditions.push(eq(artifacts.generationRunId, GenerationRunId.parse(generationRunIdRaw)));
    }

    if (taskIdRaw) {
      conditions.push(eq(artifacts.taskId, TaskId.parse(taskIdRaw)));
    }

    const where = conditions.length === 1 ? conditions[0] : and(...conditions);

    const rows = await db
      .select()
      .from(artifacts)
      .where(where)
      .orderBy(artifacts.createdAt);

    return NextResponse.json({ artifacts: rows }, { status: 200 });
  } catch (err) {
    return errorResponse(err);
  }
}

// ---------------------------------------------------------------------------
// POST /api/artifacts
// ---------------------------------------------------------------------------

export async function POST(req: NextRequest) {
  try {
    const session = await requireAuth();
    const createdBy = session.user.id;

    const body = await parseJsonBody(req);

    const input = CreateArtifactInput.parse(body);

    const now = new Date();
    const id = randomUUID();

    const [created] = await db
      .insert(artifacts)
      .values({
        id,
        workspaceId: input.workspaceId,
        projectId: input.projectId,
        taskId: input.taskId,
        generationRunId: input.generationRunId,
        kind: input.kind,
        storageKind: input.storageKind,
        name: input.name,
        mimeType: input.mimeType ?? null,
        textContent: input.textContent ?? null,
        storageUrl: input.storageUrl ?? null,
        storageRef: input.storageRef ?? null,
        contentHash: input.contentHash ?? null,
        byteSize: input.byteSize ?? null,
        createdBy,
        createdAt: now,
      })
      .returning();

    if (!created) throw new Error('INSERT returned zero rows');

    const artifact = Artifact.parse(created);
    return NextResponse.json({ artifact }, { status: 201 });
  } catch (err) {
    if (
      err instanceof Error &&
      'code' in err &&
      (err as { code: string }).code === '23503'
    ) {
      return errorResponse(
        badRequest(
          'The referenced workspace, project, task, generation run, or user does not exist',
          'FOREIGN_KEY_VIOLATION',
        ),
      );
    }
    return errorResponse(err);
  }
}
