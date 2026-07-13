/**
 * /api/workflows/[definitionId]/instances — Workflow Instances API (Phase 8)
 *
 *   GET    /api/workflows/[definitionId]/instances?status=[pending|running|completed|failed|cancelled]
 *     List workflow instances for a specific definition.
 *
 *   POST   /api/workflows/[id]/instances
 *     Start a new workflow instance from this definition.
 */

import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';
import { eq, and, desc } from 'drizzle-orm';
import { z } from 'zod';

import { db, workflowDefinitions, workflowInstances as wiTable } from '@heynxt/persistence';

import { badRequest, errorResponse, parseJsonBody } from '@/lib/api';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/** Zod schema for starting a workflow instance. */
const StartWorkflowInstanceInput = z.object({
  createdBy: z.string().min(1),
  correlationId: z.string().uuid().optional(),
  initialState: z.string().optional(),
  contextData: z.record(z.unknown()).optional(),
});

type StartWorkflowInstanceInput = z.infer<typeof StartWorkflowInstanceInput>;

/** Zod schema for query parameters. */
const WorkflowInstancesQueryParams = z.object({
  status: z.enum(['pending', 'running', 'completed', 'failed', 'cancelled']).optional(),
});

// ---------------------------------------------------------------------------
// GET /api/workflows/[definitionId]/instances
// ---------------------------------------------------------------------------

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const definitionId = (await params).id;

    if (!definitionId.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
      return errorResponse(badRequest('Invalid workflow definition ID format'));
    }

    const paramsQuery = WorkflowInstancesQueryParams.parse({
      status: req.nextUrl.searchParams.get('status') as 'pending' | 'running' | 'completed' | 'failed' | 'cancelled' ?? undefined,
    });

    // Verify the workflow definition exists
    const [definition] = await db
      .select({ id: workflowDefinitions.id })
      .from(workflowDefinitions)
      .where(eq(workflowDefinitions.id, definitionId))
      .limit(1);

    if (!definition) {
      return errorResponse(new Error('Workflow definition not found'));
    }

    const conditions: any[] = [eq(wiTable.definitionId, definitionId)];

    if (paramsQuery.status) {
      conditions.push(eq(wiTable.status, paramsQuery.status));
    }

    const where = and(...conditions);

    const rows = await db
      .select({
        id: wiTable.id,
        definitionId: wiTable.definitionId,
        status: wiTable.status,
        currentState: wiTable.currentState,
        contextData: wiTable.contextData,
        createdAt: wiTable.createdAt,
        updatedAt: wiTable.updatedAt,
        completedAt: wiTable.completedAt,
      })
      .from(wiTable)
      .where(where)
      .orderBy(desc(wiTable.createdAt));

    return NextResponse.json({ instances: rows }, { status: 200 });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return errorResponse(badRequest(err.errors[0]?.message ?? 'Invalid request'));
    }
    return errorResponse(err);
  }
}

// ---------------------------------------------------------------------------
// POST /api/workflows/[id]/instances
// ---------------------------------------------------------------------------

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await import('@/lib/session').then(m => m.requireAuth());
    const userId = (await session).user.id;
    const definitionId = (await params).id;

    if (!definitionId.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
      return errorResponse(badRequest('Invalid workflow definition ID format'));
    }

    const input = StartWorkflowInstanceInput.parse(await parseJsonBody(req));

    // Verify the workflow definition exists and is not deprecated
    const [definition] = await db
      .select({ id: workflowDefinitions.id, status: workflowDefinitions.status, version: workflowDefinitions.version })
      .from(workflowDefinitions)
      .where(eq(workflowDefinitions.id, definitionId))
      .limit(1);

    if (!definition) {
      return errorResponse(new Error('Workflow definition not found'));
    }

    if (definition.status === 'deprecated') {
      throw badRequest('Cannot start instance from a deprecated workflow definition');
    }

    const now = new Date();
    const instanceId = randomUUID();

    const [created] = await db
      .insert(wiTable)
      .values({
        id: instanceId,
        definitionId,
        definitionVersion: definition.version, // Required field - snapshot version at start
        status: 'pending',
        currentState: input.initialState || '',
        contextData: input.contextData ?? {},
        createdAt: now,
        updatedAt: now,
      })
      .returning();

    if (!created) {
      throw new Error('INSERT returned zero rows');
    }

    return NextResponse.json(
      { instance: { id: created.id, definitionId: created.definitionId, status: 'pending', createdAt: now } },
      { status: 201 }
    );
  } catch (err) {
    if (err instanceof z.ZodError) {
      return errorResponse(badRequest(err.errors[0]?.message ?? 'Invalid request'));
    }
    return errorResponse(err);
  }
}
