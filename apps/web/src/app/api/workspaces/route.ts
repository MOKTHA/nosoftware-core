/**
 * /api/workspaces — workspace CRUD API.
 *
 *   GET  /api/workspaces
 *     List all workspaces. Optional `organizationId` query parameter
 *     filters to workspaces belonging to the given organization.
 *     Empty array (200) when no workspaces match.
 *     400 when `organizationId` is present but invalid.
 *
 *   POST /api/workspaces
 *     Create a workspace. Body: CreateWorkspaceInput (from core-types).
 *       { organizationId, name, slug, description?, status? }
 *     Returns 201 with the created workspace.
 *     400 when body fails validation or (organizationId, slug) already exists.
 *
 * Conventions:
 *   - JSON request + JSON responses only.
 *   - Errors follow `{ error, code, fields? }` via `errorResponse()`.
 *   - Server generates `id` (UUID v4), `createdAt`, `updatedAt`.
 *   - `status` defaults to `'active'` server-side if omitted.
 *
 * Auth / RBAC is deferred to a later slice; these routes accept any caller.
 */

import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';

import {
  CreateWorkspaceInput,
  Workspace,
  WorkspaceId,
} from '@heynxt/core-types';
import { db, workspaces } from '@heynxt/persistence';

import {
  badRequest,
  errorResponse,
  parseJsonBody,
} from '@/lib/api';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// ---------------------------------------------------------------------------
// GET /api/workspaces[?organizationId=<uuid>]
// ---------------------------------------------------------------------------

export async function GET(req: NextRequest) {
  try {
    const orgIdRaw = req.nextUrl.searchParams.get('organizationId');

    let rows;
    if (orgIdRaw) {
      // Validate the UUID via Zod before sending it to the DB.
      const organizationId = WorkspaceId.parse(orgIdRaw);
      rows = await db
        .select()
        .from(workspaces)
        .where(eq(workspaces.organizationId, organizationId))
        .orderBy(workspaces.createdAt);
    } else {
      // No filter — return all workspaces. This is how forms populate
      // the workspace selector without needing to know an org ID.
      rows = await db
        .select()
        .from(workspaces)
        .orderBy(workspaces.createdAt);
    }

    return NextResponse.json({ workspaces: rows }, { status: 200 });
  } catch (err) {
    return errorResponse(err);
  }
}

// ---------------------------------------------------------------------------
// POST /api/workspaces
// ---------------------------------------------------------------------------

export async function POST(req: NextRequest) {
  try {
    const body = await parseJsonBody(req);

    // Parse + validate against CreateWorkspaceInput. Throws ZodError on fail.
    const input = CreateWorkspaceInput.parse(body);

    // Compose the full row — server-generated fields.
    const now = new Date();
    const id = randomUUID();
    const status = input.status ?? 'active';

    const [created] = await db
      .insert(workspaces)
      .values({
        id,
        organizationId: input.organizationId,
        name: input.name,
        slug: input.slug,
        description: input.description ?? null,
        status,
        createdAt: now,
        updatedAt: now,
      })
      .returning();

    if (!created) {
      // `returning()` returns [] if insert matched no rows — but with
      // `.values({ ... })` and no conflict guard, this path is unreachable
      // in normal operation. Surface it as an internal error to aid
      // debugging if the driver behaviour changes.
      throw new Error('INSERT returned zero rows');
    }

    // Round-trip through the Workspace schema to guarantee the response
    // shape matches the documented contract (defence in depth against
    // driver/DB surprises).
    const workspace = Workspace.parse(created);

    return NextResponse.json({ workspace }, { status: 201 });
  } catch (err) {
    // Translate the Postgres unique-constraint violation into a friendly
    // 400 with a `fields` payload that UIs can render inline.
    if (
      err instanceof Error &&
      'code' in err &&
      (err as { code: string }).code === '23505'
    ) {
      return errorResponse(
        badRequest(
          'A workspace with this slug already exists in the organization',
          'WORKSPACE_SLUG_CONFLICT',
          { slug: ['must be unique within the organization'] },
        ),
      );
    }
    return errorResponse(err);
  }
}

