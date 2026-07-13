/**
 * /api/rollbacks — Rollback Management API
 *
 * Provides rollback functionality for generation runs:
 *   GET    /api/rollbacks       - List pending/completed rollback requests
 *   POST   /api/rollbacks       - Request a new rollback
 */

import { NextRequest, NextResponse } from 'next/server';
import { eq, and, sql, desc } from 'drizzle-orm';
import { z } from 'zod';

import { db, rollbackRequests, rollbackStatusEnum, snapshotTypeEnum, generationRuns, workspaces } from '@heynxt/persistence';

import { badRequest, errorResponse, parseJsonBody } from '@/lib/api';
import { requireAuth } from '@/lib/session';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/** Zod schema for requesting a rollback */
const CreateRollbackInput = z.object({
  targetGenerationRunId: z.string().uuid(),
  sourceGenerationRunId: z.string().uuid(),
  reason: z.string().max(2000),
  requiresApproval: z.boolean().optional(),
});

type CreateRollbackInput = z.infer<typeof CreateRollbackInput>;

/** Query parameters for listing rollbacks */
const RollbacksQueryParams = z.object({
  status: z.enum(['pending', 'in-progress', 'completed', 'failed', 'cancelled']).optional(),
  workspaceId: z.string().uuid().optional(),
  limit: z.string().transform(Number).default('50'),
  offset: z.string().transform(Number).default('0'),
});

type RollbacksQueryParams = z.infer<typeof RollbacksQueryParams>;

export async function GET(req: NextRequest) {
  try {
    const authUser = await requireAuth();

    const params = RollbacksQueryParams.parse({
      status: (req.nextUrl.searchParams.get('status') as 'pending' | 'in-progress' | 'completed' | 'failed' | 'cancelled') ?? undefined,
      workspaceId: req.nextUrl.searchParams.get('workspaceId') ?? undefined,
      limit: req.nextUrl.searchParams.get('limit') ?? '50',
      offset: req.nextUrl.searchParams.get('offset') ?? '0',
    });

    const conditions: any[] = [];

    if (params.status) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      conditions.push((rollbackRequests.status as any) === params.status);
    }

    if (params.workspaceId) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      conditions.push(eq(rollbackRequests.workspaceId, params.workspaceId));
    }

    const where = conditions.length > 0 ? and(...conditions) : undefined;

    // Fetch rollback requests with details
    const rows = await db.select({
      id: rollbackRequests.id,
      organizationId: rollbackRequests.organizationId,
      workspaceId: rollbackRequests.workspaceId,
      targetGenerationRunId: rollbackRequests.targetGenerationRunId,
      sourceGenerationRunId: rollbackRequests.sourceGenerationRunId,
      status: rollbackRequests.status,
      requiresApproval: rollbackRequests.requiresApproval,
      approvedBy: rollbackRequests.approvedBy,
      requestedBy: rollbackRequests.requestedBy,
      reason: rollbackRequests.reason,
      executedAt: rollbackRequests.executedAt,
      createdAt: rollbackRequests.createdAt,
      updatedAt: rollbackRequests.updatedAt,
    }).from(rollbackRequests).where(where)
      .orderBy(sql`${rollbackRequests.createdAt} DESC`)
      .limit(params.limit as number)
      .offset(params.offset as number);

    // Fetch generation run details in parallel (batched for both target and source)
    const genRunIds = [...new Set(rows.flatMap(r => [r.targetGenerationRunId, r.sourceGenerationRunId]))];
    const genRunsMap = new Map<string, any>();

    if (genRunIds.length > 0) {
      const inValues = genRunIds.map(id => sql`'${id}'`).join(', ');
      const inCondition = sql`${generationRuns.id} IN (${sql.raw(inValues)})`;
      // generation_runs table doesn't have a 'name' column - only status and id
      const runsResult = await db.select({ id: generationRuns.id, status: generationRuns.status }).from(generationRuns).where(inCondition);
      for (const run of runsResult) {
        genRunsMap.set(run.id, run);
      }
    }

    // Enrich results with generation run info
    const enrichedRows = rows.map(row => ({
      ...row,
      targetRun: genRunsMap.get(row.targetGenerationRunId),
      sourceRun: genRunsMap.get(row.sourceGenerationRunId),
    }));

    // Fetch total count
    const countResult = await db.select({ count: sql`count(*) as count` }).from(rollbackRequests).where(where);

    return NextResponse.json({
      rollbacks: enrichedRows,
      pagination: {
        total: parseInt(countResult[0]?.count ?? '0'),
        limit: params.limit as number,
        offset: params.offset as number,
      },
    }, { status: 200 });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return errorResponse(badRequest(err.errors[0]?.message ?? 'Invalid request'));
    }
    return errorResponse(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const authUser = await requireAuth();
    const userId = authUser.user.id;

    const input = CreateRollbackInput.parse(await parseJsonBody(req));

    // Verify source generation run exists and is accessible
    const [sourceRun] = await db.select({ id: generationRuns.id, workspaceId: generationRuns.workspaceId, status: generationRuns.status }).from(generationRuns).where(eq(generationRuns.id, input.sourceGenerationRunId)).limit(1);

    if (!sourceRun) {
      return errorResponse(new Error('Source generation run not found'), 404);
    }

    // Verify target generation run exists and is accessible
    const [targetRun] = await db.select({ id: generationRuns.id, workspaceId: generationRuns.workspaceId }).from(generationRuns).where(eq(generationRuns.id, input.targetGenerationRunId)).limit(1);

    if (!targetRun) {
      return errorResponse(new Error('Target generation run not found'), 404);
    }

    // Verify both runs belong to the same workspace (and thus organization)
    if (sourceRun.workspaceId !== targetRun.workspaceId) {
      throw badRequest('Source and target generation runs must belong to the same workspace');
    }

    const now = new Date();

    // Determine if approval is required based on source run status
    let requiresApproval = input.requiresApproval ?? true;
    if (sourceRun.status === 'failed' || sourceRun.status === 'cancelled') {
      requiresApproval = false; // No approval needed for failed/cancelled runs
    }

    // Get organization ID from workspace for the rollback request
    const [workspace] = await db.select({ id: workspaces.id, organizationId: workspaces.organizationId }).from(workspaces).where(eq(workspaces.id, sourceRun.workspaceId)).limit(1);

    if (!workspace) {
      throw new Error('Workspace not found');
    }

    const [created] = await db.insert(rollbackRequests).values({
      organizationId: workspace.organizationId,
      workspaceId: sourceRun.workspaceId ?? undefined,
      targetGenerationRunId: input.targetGenerationRunId,
      sourceGenerationRunId: input.sourceGenerationRunId,
      requestedBy: userId,
      requiresApproval,
      reason: input.reason ?? '',
      status: 'pending',
      createdAt: now,
      updatedAt: now,
    }).returning();

    if (!created) {
      throw new Error('Failed to create rollback request');
    }

    return NextResponse.json({
      rollbackRequest: {
        id: created.id,
        organizationId: created.organizationId,
        targetGenerationRunId: created.targetGenerationRunId,
        sourceGenerationRunId: created.sourceGenerationRunId,
        status: 'pending',
        requiresApproval: created.requiresApproval,
        requestedBy: created.requestedBy,
        createdAt: created.createdAt.toISOString(),
      },
    }, { status: 201 });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return errorResponse(badRequest(err.errors[0]?.message ?? 'Invalid request'));
    }
    return errorResponse(err);
  }
}
