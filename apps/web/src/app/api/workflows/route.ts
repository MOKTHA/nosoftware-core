/**
 * /api/workflows — Workflow Definitions API (Phase 8)
 *
 *   GET    /api/workflows?domain=[work-order|routing|quality|maintenance|inventory|custom]&[status=draft|published|deprecated]
 *     List workflow definitions, optionally filtered by domain or status.
 *
 *   POST   /api/workflows
 *     Create a new workflow definition record.
 */

import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';
import { eq, and, sql } from 'drizzle-orm';
import { z } from 'zod';

import { db, workflowDefinitions } from '@heynxt/persistence';

import { badRequest, errorResponse, parseJsonBody } from '@/lib/api';
import { insertAuditEntry } from '@/lib/audit';
import { requireAuth } from '@/lib/session';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/** Zod schema for creating a workflow definition. */
const CreateWorkflowDefinitionInput = z.object({
  name: z.string().min(1, 'Name is required'),
  description: z.string().optional(),
  version: z.string().regex(/^[\d]+\.[\d]+\.[\d]+$/, 'Semver format (x.y.z)'),
  domain: z.enum(['work-order', 'routing', 'quality', 'maintenance', 'inventory', 'custom']),
  createdBy: z.string().min(1, 'Created by is required'),
});

type CreateWorkflowDefinitionInput = z.infer<typeof CreateWorkflowDefinitionInput>;

/** Zod schema for query parameters. */
const WorkflowDefinitionsQueryParams = z.object({
  domain: z.enum(['work-order', 'routing', 'quality', 'maintenance', 'inventory', 'custom']).optional(),
  status: z.enum(['draft', 'published', 'deprecated']).optional(),
});

// ---------------------------------------------------------------------------
// GET /api/workflows?domain=[...]&[status=...]
// ---------------------------------------------------------------------------

export async function GET(req: NextRequest) {
  try {
    const session = await requireAuth();
    const userId = session.user.id;

    // Parse query parameters
    const params = WorkflowDefinitionsQueryParams.parse({
      domain: req.nextUrl.searchParams.get('domain') ?? undefined,
      status: req.nextUrl.searchParams.get('status') as 'draft' | 'published' | 'deprecated' ?? undefined,
    });

    // Build where conditions
    const conditions: any[] = [];

    if (params.domain) {
      conditions.push(eq(workflowDefinitions.domain, params.domain));
    }

    if (params.status) {
      conditions.push(eq(workflowDefinitions.status, params.status));
    }

    const where = conditions.length > 0 ? and(...conditions) : undefined;

    // Fetch workflow definitions
    const rows = await db
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
      .where(where);

    return NextResponse.json(
      { workflows: rows },
      { status: 200 }
    );
  } catch (err) {
    if (err instanceof z.ZodError) {
      return errorResponse(badRequest(err.errors[0]?.message ?? 'Invalid request'));
    }
    return errorResponse(err);
  }
}

// ---------------------------------------------------------------------------
// POST /api/workflows
// ---------------------------------------------------------------------------

export async function POST(req: NextRequest) {
  try {
    const session = await requireAuth();
    const userId = session.user.id;

    // Parse request body
    const input = CreateWorkflowDefinitionInput.parse(await parseJsonBody(req));

    const now = new Date();
    const workflowId = randomUUID();

    // Insert workflow definition (no workspace scoping in v1)
    const [created] = await db
      .insert(workflowDefinitions)
      .values({
        id: workflowId,
        name: input.name,
        description: input.description ?? null,
        version: input.version,
        domain: input.domain,
        createdBy: userId,
        states: '[]', // Default empty array - actual state machine defined later
        transitions: '[]', // Default empty array
        status: 'draft',
        createdAt: now,
      })
      .returning();

    if (!created) {
      throw new Error('INSERT returned zero rows');
    }

    return NextResponse.json(
      {
        workflow: {
          id: created.id,
          name: created.name,
          version: created.version,
          domain: created.domain,
          status: 'draft',
          createdAt: now,
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
