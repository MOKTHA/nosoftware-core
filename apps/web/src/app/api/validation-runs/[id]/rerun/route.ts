/**
 * /api/validation-runs/[id]/rerun — Rerun Request API (Phase 7.6)
 *
 *   POST   /api/validation-runs/[id]/rerun
 *     Submit a rerun request with feedback from failed validation.
 *     Body: CreateRerunRequestInput { feedback, reason? }
 *     Returns 201 with the created rerun request.
 *     401 when not authenticated; 403 when user lacks generation:write permission.
 *
 *   GET    /api/validation-runs/[id]/rerun
 *     Get existing rerun requests for a validation run (for audit trail).
 */

import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';
import { eq, and, inArray } from 'drizzle-orm';
import { z } from 'zod';

import { db, rerunRequests, validationRuns } from '@heynxt/persistence';
import { requireAuth } from '@/lib/session';
import { requirePermission } from '@/lib/rbac';
import { badRequest, errorResponse, parseJsonBody } from '@/lib/api';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/** Zod schema for creating a rerun request. */
const CreateRerunRequestInput = z.object({
  /** Feedback from failed validation (what needs fixing). */
  feedback: z.string().min(1),

  /** Optional reason/context for the rerun. */
  reason: z.string().optional(),
});

type CreateRerunRequestInput = z.infer<typeof CreateRerunRequestInput>;

// ---------------------------------------------------------------------------
// POST /api/validation-runs/[id]/rerun
// ---------------------------------------------------------------------------

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireAuth();
    const userId = session.user.id;

    // Parse route param and body
    const { id: validationRunId } = await params;
    const input = CreateRerunRequestInput.parse(await parseJsonBody(req));

    // Verify user has generation permission for the workspace
    const [validationRun] = await db
      .select({
        workspaceId: validationRuns.workspaceId,
        generationRunId: validationRuns.generationRunId,
      })
      .from(validationRuns)
      .where(eq(validationRuns.id, validationRunId))
      .limit(1);

    if (!validationRun) {
      return errorResponse(badRequest(`Validation run ${validationRunId} not found`));
    }

    const workspaceId = validationRun.workspaceId;
    if (!workspaceId || !validationRun.generationRunId) {
      throw new Error('Validation run missing required fields');
    }

    await requirePermission({ userId, workspaceId, permission: 'generation:write' });

    // Check if user already has a pending rerun request for this validation run
    const existingRequests = await db
      .select({ id: rerunRequests.id })
      .from(rerunRequests)
      .where(
        and(
          eq(rerunRequests.originalGenerationRunId, validationRun.generationRunId),
          eq(rerunRequests.requestedBy, userId),
          inArray(rerunRequests.status, ['pending', 'processing'])
        )
      )
      .limit(1);

    if (existingRequests.length > 0) {
      return errorResponse(badRequest('A pending rerun request already exists for this generation'));
    }

    // Create rerun request
    const now = new Date();
    const [created] = await db
      .insert(rerunRequests)
      .values({
        id: randomUUID(),
        originalGenerationRunId: validationRun.generationRunId,
        feedback: input.feedback,
        requestedBy: userId,
        status: 'pending',
        createdAt: now,
        updatedAt: now,
      })
      .returning();

    if (!created) {
      throw new Error('INSERT returned zero rows');
    }

    return NextResponse.json(
      {
        rerunRequest: {
          id: created.id,
          originalGenerationRunId: created.originalGenerationRunId,
          feedback: created.feedback,
          requestedBy: created.requestedBy,
          status: created.status,
          requestedAt: created.requestedAt,
        },
      },
      { status: 201 }
    );
  } catch (err) {
    if (err instanceof z.ZodError) {
      return errorResponse(badRequest(err.errors[0]?.message ?? 'Invalid request'));
    }
    return errorResponse(err);
  }
}

// ---------------------------------------------------------------------------
// GET /api/validation-runs/[id]/rerun
// ---------------------------------------------------------------------------

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireAuth();
    const userId = session.user.id;

    // Parse route param
    const { id: validationRunId } = await params;

    // Verify user has generation permission for the workspace
    const [validationRun] = await db
      .select({ workspaceId: validationRuns.workspaceId, generationRunId: validationRuns.generationRunId })
      .from(validationRuns)
      .where(eq(validationRuns.id, validationRunId))
      .limit(1);

    if (!validationRun) {
      return errorResponse(badRequest(`Validation run ${validationRunId} not found`));
    }

    const workspaceId = validationRun.workspaceId;
    if (!workspaceId || !validationRun.generationRunId) {
      throw new Error('Validation run missing required fields');
    }

    await requirePermission({ userId, workspaceId, permission: 'generation:read' });

    // Fetch rerun requests for this validation run's generation
    const requests = await db
      .select({
        id: rerunRequests.id,
        status: rerunRequests.status,
        requestedBy: rerunRequests.requestedBy,
        requestedAt: rerunRequests.requestedAt,
        feedback: rerunRequests.feedback,
        newGenerationRunId: rerunRequests.newGenerationRunId,
      })
      .from(rerunRequests)
      .where(eq(rerunRequests.originalGenerationRunId, validationRun.generationRunId))
      .orderBy(rerunRequests.requestedAt);

    return NextResponse.json(
      {
        rerunRequests: requests.map(r => ({
          ...r,
              requesterName: null, // Could be fetched from users table if needed
        })),
      },
      { status: 200 }
    );
  } catch (err) {
    if (err instanceof z.ZodError) {
      return errorResponse(badRequest(err.errors[0]?.message ?? 'Invalid request'));
    }
    return errorResponse(err);
  }
}
