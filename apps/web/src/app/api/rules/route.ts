/**
 * /api/rules — Business Rules Engine API (Phase 8)
 */

import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';
import { eq, and, sql } from 'drizzle-orm';
import { z } from 'zod';

import { db, rules, ruleDefinitions as rdTable } from '@heynxt/persistence';

import { badRequest, errorResponse, parseJsonBody } from '@/lib/api';
import { requireAuth } from '@/lib/session';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const CreateRuleInput = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  domain: z.enum(['quality', 'maintenance', 'inventory', 'production', 'safety', 'custom']),
  condition: z.record(z.unknown()),
  actions: z.array(z.record(z.unknown())).min(1),
  priority: z.number().int().min(1).max(10).default(5),
});

const RulesQueryParams = z.object({
  domain: z.enum(['quality', 'maintenance', 'inventory', 'production', 'safety', 'custom']).optional(),
  status: z.enum(['active', 'inactive']).optional(),
});

export async function GET(req: NextRequest) {
  try {
    await requireAuth();
    const params = RulesQueryParams.parse({
      domain: req.nextUrl.searchParams.get('domain') ?? undefined,
      status: req.nextUrl.searchParams.get('status') as 'active' | 'inactive' ?? undefined,
    });

    const conditions: any[] = [];
    if (params.domain) {
      conditions.push(eq(rdTable.domain, params.domain));
    }
    if (params.status) {
      conditions.push(sql`${rdTable.isActive} = ${params.status === 'active'}`);
    }

    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const rows = await db.select({
      id: rdTable.id, name: rdTable.name, description: rdTable.description,
      domain: rdTable.domain, condition: rdTable.condition, actions: rdTable.actions,
      priority: rdTable.priority, isActive: rdTable.isActive, createdBy: rdTable.createdBy,
      createdAt: rdTable.createdAt, updatedAt: rdTable.updatedAt,
    }).from(rdTable).where(where);

    return NextResponse.json({ rules: rows }, { status: 200 });
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
    const userId = (await import('@/lib/session').then(m => m.requireAuth())).user.id;
    const input = CreateRuleInput.parse(await parseJsonBody(req));

    const now = new Date();
    const ruleId = randomUUID();

    const [created] = await db.insert(rdTable).values({
      id: ruleId, name: input.name, description: input.description ?? null, domain: input.domain,
      condition: JSON.stringify(input.condition), actions: JSON.stringify(input.actions),
      priority: input.priority, createdBy: userId, isActive: true, createdAt: now, updatedAt: now,
    }).returning();

    if (!created) throw new Error('INSERT returned zero rows');

    return NextResponse.json({
      rule: { id: created.id, name: created.name, domain: created.domain, priority: created.priority, isActive: true, createdAt: now },
    }, { status: 201 });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return errorResponse(badRequest(err.errors[0]?.message ?? 'Invalid request'));
    }
    return errorResponse(err);
  }
}
