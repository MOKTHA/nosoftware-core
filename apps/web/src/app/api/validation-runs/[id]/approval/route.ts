/**
 * /api/validation-runs/[id]/approval — Approval Decision API (Phase 7.5)
 *
 *   POST   /api/validation-runs/[id]/approval
 *     Submit an approval/rejection decision on a validation run.
 *     Body: CreateApprovalDecisionInput { decision, reason, comments?, requiresSecondApproval? }
 *     Returns 201 with the created approval decision.
 *     401 when not authenticated; 403 when user lacks approver permission.
 *
 *   GET    /api/validation-runs/[id]/approval
 *     Get existing approval decisions for a validation run (for audit trail).
 */

import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';
import { eq, and } from 'drizzle-orm';
import { z } from 'zod';

import { db, approvalDecisions, validationRuns } from '@heynxt/persistence';
import { requireAuth } from '@/lib/session';
import { requirePermission } from '@/lib/rbac';
import { badRequest, errorResponse, parseJsonBody } from '@/lib/api';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/** Zod schema for creating an approval decision. */
const CreateApprovalDecisionInput = z.object({
  /** Decision: approved or rejected. */
  decision: z.enum(['approved', 'rejected']),

  /** Reason for the decision (required when rejected). */
  reason: z.string().min(1),

  /** Optional comments from the approver. */
  comments: z.string().optional(),

  /** Whether this approval requires a second reviewer (for production promotions). */
  requiresSecondApproval: z.boolean().default(false),
});

type CreateApprovalDecisionInput = z.infer<typeof CreateApprovalDecisionInput>;

/** Zod schema for query parameters. */
const ApprovalQueryParams = z.object({
  includeHistory: z.enum(['true', 'false']).optional(),
});

// ---------------------------------------------------------------------------
// POST /api/validation-runs/[id]/approval
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
    const input = CreateApprovalDecisionInput.parse(await parseJsonBody(req));

    // Verify user has approver permission for the workspace
    const validationRun = await db
      .select({ workspaceId: validationRuns.workspaceId })
      .from(validationRuns)
      .where(eq(validationRuns.id, validationRunId))
      .limit(1);

    if (validationRun.length === 0) {
      return errorResponse(badRequest(`Validation run ${validationRunId} not found`));
    }

    const workspaceId = validationRun[0].workspaceId;
    await requirePermission('approval:write', userId, workspaceId);

    // Check if user already made a decision on this validation run
    const existingDecisions = await db
      .select({ id: approvalDecisions.id })
      .from(approvalDecisions)
      .where(
        and(
          eq(approvalDecisions.validationRunId, validationRunId),
          eq(approvalDecisions.approvedBy, userId)
        )
      )
      .limit(1);

    if (existingDecisions.length > 0) {
      return errorResponse(badRequest('User has already made a decision on this validation run'));
    }

    // Create approval decision
    const now = new Date();
    const [created] = await db
      .insert(approvalDecisions)
      .values({
        id: randomUUID(),
        generationRunId: validationRun[0].generationRunId,
        validationRunId,
        decision: input.decision,
        approvedBy: userId,
        reason: input.reason,
        comments: input.comments ?? null,
        requiresSecondApproval: input.requiresSecondApproval,
        createdAt: now,
        updatedAt: now,
      })
      .returning();

    if (!created) {
      throw new Error('INSERT returned zero rows');
    }

    return NextResponse.json(
      {
        approvalDecision: {
          id: created.id,
          generationRunId: created.generationRunId,
          validationRunId: created.validationRunId,
          decision: created.decision,
          approvedBy: created.approvedBy,
          decidedAt: created.decidedAt,
          reason: created.reason,
          comments: created.comments,
          requiresSecondApproval: created.requiresSecondApproval,
        },
      },
      { status: 201 }
    );
  } catch (err) {
    if (err instanceof z.ZodError) {
      return errorResponse(badRequest(err.errors[0].message));
    }
    return errorResponse(err);
  }
}

// ---------------------------------------------------------------------------
// GET /api/validation-runs/[id]/approval
// ---------------------------------------------------------------------------

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireAuth();
    const userId = session.user.id;

    // Parse route param and query params
    const { id: validationRunId } = await params;
    const queryParams = ApprovalQueryParams.parse({
      includeHistory: req.nextUrl.searchParams.get('includeHistory') ?? undefined,
    });

    // Verify user has approver permission for the workspace
    const validationRun = await db
      .select({ workspaceId: validationRuns.workspaceId })
      .from(validationRuns)
      .where(eq(validationRuns.id, validationRunId))
      .limit(1);

    if (validationRun.length === 0) {
      return errorResponse(badRequest(`Validation run ${validationRunId} not found`));
    }

    const workspaceId = validationRun[0].workspaceId;
    await requirePermission('approval:read', userId, workspaceId);

    // Fetch approval decisions for this validation run
    const decisions = await db
      .select({
        id: approvalDecisions.id,
        decision: approvalDecisions.decision,
        approvedBy: approvalDecisions.approvedBy,
        decidedAt: approvalDecisions.decidedAt,
        reason: approvalDecisions.reason,
        comments: approvalDecisions.comments,
        requiresSecondApproval: approvalDecisions.requiresSecondApproval,
        secondApproverId: approvalDecisions.secondApproverId,
        secondApprovedAt: approvalDecisions.secondApprovedAt,
      })
      .from(approvalDecisions)
      .where(eq(approvalDecisions.validationRunId, validationRunId))
      .orderBy(approvalDecisions.decidedAt);

    return NextResponse.json(
      {
        decisions: decisions.map(d => ({
          ...d,
          approverName: null, // Could be fetched from users table if needed
        })),
      },
      { status: 200 }
    );
  } catch (err) {
    if (err instanceof z.ZodError) {
      return errorResponse(badRequest(err.errors[0].message));
    }
    return errorResponse(err);
  }
}
