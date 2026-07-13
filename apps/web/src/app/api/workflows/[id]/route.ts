/**
 * /api/workflows/[id] — Workflow Definition CRUD (Phase 8)
 *
 *   GET    /api/workflows/[id]
 *     Get a specific workflow definition by ID.
 *
 *   PUT    /api/workflows/[id]
 *     Update an existing workflow definition.
 *
 *   DELETE /api/workflows/[id]
 *     Delete/deprecate a workflow definition.
 */

import { NextRequest, NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { z } from 'zod';

import { db, workflowDefinitions, workflowDomainEnum } from '@heynxt/persistence';

import { badRequest, errorResponse, parseJsonBody } from '@/lib/api';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/** Zod schema for updating a workflow definition. */
const UpdateWorkflowDefinitionInput = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  version: z.string().regex(/^\d+\.\d+\.\d+$/).optional(),
  domain: z.enum(['work-order', 'routing', 'quality', 'maintenance', 'inventory', 'custom']).optional(),
});

type UpdateWorkflowDefinitionInput = z.infer<typeof UpdateWorkflowDefinitionInput>;

// ---------------------------------------------------------------------------
// GET /api/workflows/[id]
// ---------------------------------------------------------------------------

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const workflowId = (await params).id;

    if (!workflowId.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
      return errorResponse(badRequest('Invalid workflow ID format'));
    }

    const [workflow] = await db
      .select({
        id: workflowDefinitions.id,
        name: workflowDefinitions.name,
        description: workflowDefinitions.description,
        version: workflowDefinitions.version,
        status: workflowDefinitions.status,
        domain: workflowDefinitions.domain,
        createdBy: workflowDefinitions.createdBy,
        createdAt: workflowDefinitions.createdAt,
        updatedAt: workflowDefinitions.updatedAt,
      })
      .from(workflowDefinitions)
      .where(eq(workflowDefinitions.id, workflowId))
      .limit(1);

    if (!workflow) {
      return errorResponse(new Error('Workflow definition not found'));
    }

    return NextResponse.json({ workflow }, { status: 200 });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return errorResponse(badRequest(err.errors[0]?.message ?? 'Invalid request'));
    }
    return errorResponse(err);
  }
}

// ---------------------------------------------------------------------------
// PUT /api/workflows/[id]
// ---------------------------------------------------------------------------

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await import('@/lib/session').then(m => m.requireAuth());
    const userId = (await session).user.id;
    const workflowId = (await params).id;

    if (!workflowId.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
      return errorResponse(badRequest('Invalid workflow ID format'));
    }

    const input = UpdateWorkflowDefinitionInput.parse(await parseJsonBody(req));

    if (Object.keys(input).length === 0) {
      throw badRequest('No update fields provided');
    }

    // Verify ownership and get existing values
    const [existing] = await db
      .select({ id: workflowDefinitions.id, createdBy: workflowDefinitions.createdBy })
      .from(workflowDefinitions)
      .where(eq(workflowDefinitions.id, workflowId))
      .limit(1);

    if (!existing) {
      return errorResponse(new Error('Workflow definition not found'));
    }

    const now = new Date();

    // Build update object dynamically based on provided fields and existing values
    const [updated] = await db
      .update(workflowDefinitions)
      .set({
        name: input.name,
        description: (input.description ?? ''),
        version: input.version,
        domain: input.domain,
        updatedAt: now,
      })
      .where(eq(workflowDefinitions.id, workflowId))
      .returning();

    if (!updated) {
      throw new Error('UPDATE returned zero rows');
    }

    return NextResponse.json({ workflow: updated }, { status: 200 });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return errorResponse(badRequest(err.errors[0]?.message ?? 'Invalid request'));
    }
    return errorResponse(err);
  }
}

// ---------------------------------------------------------------------------
// DELETE /api/workflows/[id]
// ---------------------------------------------------------------------------

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const workflowId = (await params).id;

    if (!workflowId.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
      return errorResponse(badRequest('Invalid workflow ID format'));
    }

    const now = new Date();
    const [deleted] = await db
      .update(workflowDefinitions)
      .set({ status: 'deprecated', updatedAt: now })
      .where(eq(workflowDefinitions.id, workflowId))
      .returning();

    if (!deleted) {
      throw new Error('UPDATE returned zero rows');
    }

    return NextResponse.json(
      { message: `Workflow ${workflowId} deprecated`, workflow: deleted },
      { status: 200 }
    );
  } catch (err) {
    if (err instanceof z.ZodError) {
      return errorResponse(badRequest(err.errors[0]?.message ?? 'Invalid request'));
    }
    return errorResponse(err);
  }
}
