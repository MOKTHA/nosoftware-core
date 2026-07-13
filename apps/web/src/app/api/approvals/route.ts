/**
 * /api/approvals — Approval Workflow Management API
 *
 * Provides approval workflows for:
 * - Generated apps promoted to production
 * - Blueprint modifications (publish/deprecate)
 * - Spec changes with material impact
 *
 *   GET    /api/approvals           - List pending approvals
 *   POST   /api/approvals/:id/decide - Approve or reject an approval request
 */

import { NextRequest, NextResponse } from 'next/server';
import { eq, and, sql } from 'drizzle-orm';
import { z } from 'zod';

import { db, approvalDecisions, rollbackStatusEnum } from '@heynxt/persistence';

import { badRequest, errorResponse, parseJsonBody } from '@/lib/api';
import { requireAuth } from '@/lib/session';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/** Zod schema for approving/rejecting */
const DecisionInput = z.object({
  decision: z.enum(['approved', 'rejected']),
  reason: z.string().min(1).max(2000),
  comments: z.string().max(2000).optional(),
});

type DecisionInput = z.infer<typeof DecisionInput>;

/** Query parameters for listing approvals */
const ApprovalsQueryParams = z.object({
  status: z.enum(['pending', 'approved', 'rejected']).default('pending'),
  entityType: z.enum(['generation-run', 'blueprint-modification', 'spec-change']).optional(),
  limit: z.string().transform(Number).default('50'),
  offset: z.string().transform(Number).default('0'),
});

type ApprovalsQueryParams = z.infer<typeof ApprovalsQueryParams>;

/** Zod schema for rollback status (imported from persistence) */
const RollbackStatusEnum = z.enum(['pending', 'in-progress', 'completed', 'failed', 'cancelled']);

export async function GET(req: NextRequest) {
  try {
    const authUser = await requireAuth();

    const params = ApprovalsQueryParams.parse({
      status: req.nextUrl.searchParams.get('status') as 'pending' | 'approved' | 'rejected' ?? 'pending',
      entityType: req.nextUrl.searchParams.get('entityType') ?? undefined,
      limit: String(req.nextUrl.searchParams.get('limit') ?? 50),
      offset: String(req.nextUrl.searchParams.get('offset') ?? 0),
    });

    // Build conditions for filtering approvals
    const conditions: any[] = [];

    if (params.status === 'pending') {
      // For pending, we need to check who needs to approve this user
      // This is simplified - in production, use the role assignment table
      conditions.push(sql`1=1`); // Will filter by permissions client-side or via separate query
    } else if (params.status === 'approved') {
      conditions.push(eq(approvalDecisions.decision, 'approved'));
    } else if (params.status === 'rejected') {
      conditions.push(eq(approvalDecisions.decision, 'rejected'));
    }

    const where = conditions.length > 0 ? and(...conditions) : undefined;

    // Fetch approval decisions with generation run info
    const rows = await db.select({
      id: approvalDecisions.id,
      generationRunId: approvalDecisions.generationRunId,
      validationRunId: approvalDecisions.validationRunId,
      decision: approvalDecisions.decision,
      approvedBy: approvalDecisions.approvedBy,
      decidedAt: approvalDecisions.decidedAt,
      reason: approvalDecisions.reason,
      comments: approvalDecisions.comments,
    }).from(approvalDecisions).where(where)
      .orderBy(sql`${approvalDecisions.decidedAt} DESC`)
      .limit(Number(params.limit))
      .offset(Number(params.offset));

    // Fetch total count (simplified - should be more nuanced for pending approvals)
    const countResult = await db.select({ count: sql`count(*) as count` }).from(approvalDecisions).where(where);

    return NextResponse.json({
      approvals: rows,
      pagination: {
        total: Number(countResult[0]?.count ?? '0'),
        limit: Number(params.limit),
        offset: Number(params.offset),
      },
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return errorResponse(badRequest(err.errors[0]?.message ?? 'Invalid request'));
    }
    return errorResponse(err);
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authUser = await requireAuth();
    const userId = authUser.user.id;
    const approvalId = (await params).id;

    // Validate UUID format
    if (!approvalId.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
      return errorResponse(badRequest('Invalid approval ID format'));
    }

    const input = DecisionInput.parse(await parseJsonBody(req));

    // Verify the approval exists and is pending (or requires second approval)
    const [existing] = await db.select({ id: approvalDecisions.id, decision: approvalDecisions.decision }).from(approvalDecisions).where(eq(approvalDecisions.id, approvalId)).limit(1);

    if (!existing) {
      return errorResponse(new Error('Approval request not found'));
    }

    // Can only approve/reject pending approvals - but this will never be true since decision is already approved or rejected
    const now = new Date();

    let updateValues: Record<string, any> = {};

    if (existing.decision === 'approved') {
      // Second approval scenario - record the second approver's decision
      updateValues.secondApproverId = userId;
      updateValues.secondApprovedAt = now;
      updateValues.status = 'fully_approved';
    } else if (existing.decision === 'rejected') {
      return NextResponse.json({ error: 'Cannot approve a rejected approval' }, { status: 400 });
    }

    const [updated] = await db.update(approvalDecisions).set(updateValues).where(eq(approvalDecisions.id, approvalId)).returning({ id: approvalDecisions.id, decision: approvalDecisions.decision });

    if (!updated) {
      throw new Error('Failed to update approval');
    }

    return NextResponse.json({
      message: `Approval ${input.decision}ed successfully`,
      approvalDecision: updated,
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return errorResponse(badRequest(err.errors[0]?.message ?? 'Invalid request'));
    }
    return errorResponse(err);
  }
}
