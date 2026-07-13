/**
 * /api/rollbacks/[id] — Individual Rollback Management API
 */

import { NextRequest, NextResponse } from 'next/server';
import { eq, and, sql } from 'drizzle-orm';
import { z } from 'zod';

import { db, rollbackRequests, rollbackStatusEnum, generationRuns } from '@heynxt/persistence';

import { badRequest, errorResponse, parseJsonBody } from '@/lib/api';
import { requireAuth } from '@/lib/session';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/** Zod schema for approving a rollback */
const ApproveRollbackInput = z.object({
  approvedBy: z.string().uuid(),
  comments: z.string().max(2000).optional(),
});

type ApproveRollbackInput = z.infer<typeof ApproveRollbackInput>;

/** Zod schema for cancelling a rollback */
const CancelRollbackInput = z.object({
  reason: z.string().max(2000),
});

type CancelRollbackInput = z.infer<typeof CancelRollbackInput>;

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const rollbackId = (await params).id;

    // Validate UUID format
    if (!rollbackId.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
      return errorResponse(badRequest('Invalid rollback ID format'));
    }

    // Fetch rollback details with generation run info
    const [rollback] = await db.select({
      id: rollbackRequests.id,
      organizationId: rollbackRequests.organizationId,
      workspaceId: rollbackRequests.workspaceId,
      targetGenerationRunId: rollbackRequests.targetGenerationRunId,
      sourceGenerationRunId: rollbackRequests.sourceGenerationRunId,
      status: rollbackRequests.status,
      requiresApproval: rollbackRequests.requiresApproval,
      approvedBy: rollbackRequests.approvedBy,
      approvedAt: rollbackRequests.approvedAt,
      requestedBy: rollbackRequests.requestedBy,
      reason: rollbackRequests.reason,
      executedAt: rollbackRequests.executedAt,
      createdAt: rollbackRequests.createdAt,
      updatedAt: rollbackRequests.updatedAt,
    }).from(rollbackRequests).where(eq(rollbackRequests.id, rollbackId)).limit(1);

    if (!rollback) {
      return errorResponse(new Error('Rollback request not found'), 404);
    }

    // Fetch generation run details in parallel (generation_runs doesn't have a 'name' column)
    const [targetRun] = await db.select({ id: generationRuns.id, status: generationRuns.status }).from(generationRuns).where(eq(generationRuns.id, rollback.targetGenerationRunId)).limit(1);
    const [sourceRun] = await db.select({ id: generationRuns.id, status: generationRuns.status }).from(generationRuns).where(eq(generationRuns.id, rollback.sourceGenerationRunId)).limit(1);

    return NextResponse.json({
      rollbackRequest: {
        ...rollback,
        targetRun,
        sourceRun,
      },
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return errorResponse(badRequest(err.errors[0]?.message ?? 'Invalid request'));
    }
    return errorResponse(err);
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authUser = await requireAuth();
    const userId = authUser.user.id;
    const rollbackId = (await params).id;

    // Validate UUID format
    if (!rollbackId.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
      return errorResponse(badRequest('Invalid rollback ID format'));
    }

    // First, get the current rollback state
    const [existing] = await db.select({ id: rollbackRequests.id, status: rollbackRequests.status }).from(rollbackRequests).where(eq(rollbackRequests.id, rollbackId)).limit(1);

    if (!existing) {
      return errorResponse(new Error('Rollback request not found'), 404);
    }

    // Only pending rollbacks can be approved or cancelled
    const body = await parseJsonBody(req);

    if (existing.status !== 'pending' && existing.status !== 'in-progress') {
      throw badRequest('Only pending rollback requests can be processed');
    }

    let updateValues: Record<string, any> = {};
    const now = new Date();

    if ((body as any).action === 'approve') {
      const input = ApproveRollbackInput.parse(body);

      // Verify the approver has permission (should check RBAC more thoroughly)
      updateValues.approvedBy = input.approvedBy;
      updateValues.approvedAt = now;
      updateValues.status = 'in-progress';
    } else if ((body as any).action === 'cancel') {
      const input = CancelRollbackInput.parse(body);

      updateValues.status = 'cancelled';
    } else {
      throw badRequest('Invalid action. Use "approve" or "cancel".');
    }

    const [updated] = await db.update(rollbackRequests).set(updateValues).where(eq(rollbackRequests.id, rollbackId)).returning({ id: rollbackRequests.id, status: rollbackRequests.status });

    if (!updated) {
      throw new Error('Failed to update rollback request');
    }

    return NextResponse.json({
      message: `Rollback ${(body as any).action}ed successfully`,
      rollbackRequest: updated,
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return errorResponse(badRequest(err.errors[0]?.message ?? 'Invalid request'));
    }
    return errorResponse(err);
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const rollbackId = (await params).id;

    // Validate UUID format
    if (!rollbackId.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
      return errorResponse(badRequest('Invalid rollback ID format'));
    }

    // Soft delete by cancelling the rollback request
    const now = new Date();
    const [deleted] = await db.update(rollbackRequests).set({
      status: 'cancelled',
      updatedAt: now,
    }).where(eq(rollbackRequests.id, rollbackId)).returning({ id: rollbackRequests.id });

    if (!deleted) {
      throw new Error('Failed to cancel rollback request');
    }

    return NextResponse.json({
      message: 'Rollback request cancelled successfully',
      rollbackRequestId: deleted.id,
    }, { status: 200 });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return errorResponse(badRequest(err.errors[0]?.message ?? 'Invalid request'));
    }
    return errorResponse(err);
  }
}
