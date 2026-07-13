/**
 * /api/rules — Business Rules Engine API (Phase 8)
 */

import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';
import { eq, and } from 'drizzle-orm';
import { z } from 'zod';

import { db, rules as rdTable } from '@heynxt/persistence';

import { badRequest, errorResponse, parseJsonBody } from '@/lib/api';
import { requireAuth } from '@/lib/session';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const CreateRuleInput = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  domain: z.enum(['quality', 'process', 'equipment', 'production', 'safety', 'custom']),
  conditions: z.record(z.unknown()),
  actions: z.array(z.record(z.unknown())).min(1, 'At least one action is required'),
});

type CreateRuleInput = z.infer<typeof CreateRuleInput>;

const RulesQueryParams = z.object({
  domain: z.enum(['quality', 'process', 'equipment', 'production', 'safety', 'custom']).optional(),
  status: z.enum(['draft', 'active', 'disabled']).optional(),
});

export async function GET(req: NextRequest) {
  try {
    await requireAuth();
    const params = RulesQueryParams.parse({
      domain: req.nextUrl.searchParams.get('domain') ?? undefined,
      status: (req.nextUrl.searchParams.get('status') as 'draft' | 'active' | 'disabled') ?? undefined,
    });

    const conditions: any[] = [];

    if (params.domain) {
      conditions.push(eq(rdTable.domain, params.domain));
    }

    if (params.status) {
      conditions.push(eq(rdTable.status, params.status));
    }

    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const rows = await db.select({
      id: rdTable.id,
      name: rdTable.name,
      description: rdTable.description,
      domain: rdTable.domain,
      status: rdTable.status,
      conditions: rdTable.conditions,
      actions: rdTable.actions,
      createdBy: rdTable.createdBy,
      createdAt: rdTable.createdAt,
      updatedAt: rdTable.updatedAt,
    }).from(rdTable).where(where);

    // Parse JSON fields for response
    const parsedRows = rows.map(row => ({
      ...row,
      conditions: parseJsonField(row.conditions),
      actions: parseJsonField(row.actions),
    }));

    return NextResponse.json({ rules: parsedRows }, { status: 200 });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return errorResponse(badRequest(err.errors[0]?.message ?? 'Invalid request'));
    }
    return errorResponse(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    await requireAuth();
    const userId = (await requireAuth()).user.id;
    const input = CreateRuleInput.parse(await parseJsonBody(req));

    const now = new Date();
    const ruleId = randomUUID();

    const [created] = await db.insert(rdTable).values({
      id: ruleId,
      name: input.name,
      description: input.description ?? null,
      domain: input.domain,
      conditions: JSON.stringify(input.conditions),
      actions: JSON.stringify(input.actions),
      createdBy: userId,
      status: 'draft',
      createdAt: now,
      updatedAt: now,
    }).returning();

    if (!created) {
      throw new Error('INSERT returned zero rows');
    }

    return NextResponse.json({
      rule: {
        id: created.id,
        name: created.name,
        domain: created.domain,
        status: 'draft',
        createdAt: now,
      },
    }, { status: 201 });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return errorResponse(badRequest(err.errors[0]?.message ?? 'Invalid request'));
    }
    return errorResponse(err);
  }
}

/** Helper to safely parse JSON fields from database. */
function parseJsonField(field: unknown): any {
  if (typeof field === 'string') {
    try {
      return JSON.parse(field);
    } catch {
      return null;
    }
  }
  return field ?? null;
}
