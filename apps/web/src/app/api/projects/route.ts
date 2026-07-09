/**
 * /api/projects — project CRUD API (Phase 1.6 — Task 6 slice).
 *
 *   GET  /api/projects?workspaceId=<uuid>
 *     List projects in the given workspace.
 *     Empty array (200) when no projects exist, 400 when workspaceId missing.
 *
 *   POST /api/projects
 *     Create a project. Body: CreateProjectInput (from core-types).
 *       { workspaceId, name, slug, description?, createdBy }
 *     Returns 201 with the created project (200 for the initial slice — see
 *     comments in the POST handler).
 *     400 when body fails validation or (workspaceId, slug) already exists.
 *
 * Conventions:
 *   - JSON request + JSON responses only.
 *   - Errors follow `{ error, code, fields? }` via `errorResponse()`.
 *   - Server generates `id` (UUID v4), `createdAt`, `updatedAt`.
 *   - `status` defaults to `'draft'` server-side if omitted.
 *
 * Auth / RBAC is deferred to a later slice.
 */
import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';

import {
  CreateProjectInput,
  Project,
  WorkspaceId,
} from '@heynxt/core-types';
import { db, projects } from '@heynxt/persistence';

import { badRequest, errorResponse, parseJsonBody } from '@/lib/api';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// ---------------------------------------------------------------------------
// GET /api/projects?workspaceId=<uuid>
// ---------------------------------------------------------------------------

export async function GET(req: NextRequest) {
  try {
    const workspaceIdRaw = req.nextUrl.searchParams.get('workspaceId');

    if (!workspaceIdRaw) {
      throw badRequest(
        '`workspaceId` query parameter is required',
        'MISSING_WORKSPACE_ID',
      );
    }

    const workspaceId = WorkspaceId.parse(workspaceIdRaw);

    const rows = await db
      .select()
      .from(projects)
      .where(eq(projects.workspaceId, workspaceId))
      .orderBy(projects.createdAt);

    return NextResponse.json({ projects: rows }, { status: 200 });
  } catch (err) {
    return errorResponse(err);
  }
}

// ---------------------------------------------------------------------------
// POST /api/projects
// ---------------------------------------------------------------------------

export async function POST(req: NextRequest) {
  try {
    const body = await parseJsonBody(req);

    const input = CreateProjectInput.parse(body);

    const now = new Date();
    const id = randomUUID();

    const [created] = await db
      .insert(projects)
      .values({
        id,
        workspaceId: input.workspaceId,
        name: input.name,
        slug: input.slug,
        description: input.description ?? null,
        createdBy: input.createdBy,
        status: 'draft',
        createdAt: now,
        updatedAt: now,
      })
      .returning();

    if (!created) throw new Error('INSERT returned zero rows');

    const project = Project.parse(created);
    return NextResponse.json({ project }, { status: 201 });
  } catch (err) {
    // Translate (workspaceId, slug) unique violation → friendly error.
    if (
      err instanceof Error &&
      'code' in err &&
      (err as { code: string }).code === '23505'
    ) {
      return errorResponse(
        badRequest(
          'A project with this slug already exists in the workspace',
          'PROJECT_SLUG_CONFLICT',
          { slug: ['must be unique within the workspace'] },
        ),
      );
    }
    if (
      err instanceof Error &&
      'code' in err &&
      (err as { code: string }).code === '23503'
    ) {
      // FK violation — caller passed a workspaceId or createdBy that doesn't exist.
      return errorResponse(
        badRequest(
          'The referenced workspace or user does not exist',
          'FOREIGN_KEY_VIOLATION',
        ),
      );
    }
    return errorResponse(err);
  }
}
