/**
 * /api/rules/[id] — Business Rule CRUD and Evaluation API (Phase 8)
 */

import { NextRequest, NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { z } from 'zod';

import { db, rules as rdTable } from '@heynxt/persistence';

import { badRequest, errorResponse, parseJsonBody } from '@/lib/api';
import { requireAuth } from '@/lib/session';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const UpdateRuleInput = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  conditions: z.record(z.unknown()).optional(),
  actions: z.array(z.unknown()).min(1, 'At least one action is required').optional(),
});

type UpdateRuleInput = z.infer<typeof UpdateRuleInput>;

const EvaluateRuleInput = z.object({ contextData: z.record(z.unknown()) });

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

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAuth();
    const ruleId = (await params).id;

    if (!ruleId.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
      return errorResponse(badRequest('Invalid rule ID format'));
    }

    const [rule] = await db.select({
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
    }).from(rdTable).where(eq(rdTable.id, ruleId)).limit(1);

    if (!rule) {
      return errorResponse(new Error('Rule not found'));
    }

    const parsedRule = {
      ...rule,
      conditions: parseJsonField(rule.conditions),
      actions: parseJsonField(rule.actions),
    };

    return NextResponse.json({ rule: parsedRule }, { status: 200 });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return errorResponse(badRequest(err.errors[0]?.message ?? 'Invalid request'));
    }
    return errorResponse(err);
  }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAuth();
    const userId = session.user.id;
    const ruleId = (await params).id;

    if (!ruleId.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
      return errorResponse(badRequest('Invalid rule ID format'));
    }

    const input = UpdateRuleInput.parse(await parseJsonBody(req));

    if (Object.keys(input).length === 0) {
      throw badRequest('No update fields provided');
    }

    // Verify ownership and get existing values
    const [existing] = await db.select({ id: rdTable.id, status: rdTable.status })
      .from(rdTable).where(eq(rdTable.id, ruleId)).limit(1);

    if (!existing) {
      return errorResponse(new Error('Rule not found'));
    }

    const now = new Date();

    // Build update object dynamically based on provided fields
    const updateValues: any = {};
    if (input.name !== undefined) updateValues.name = input.name;
    if (input.description !== undefined) updateValues.description = input.description;
    if (input.conditions !== undefined) updateValues.conditions = JSON.stringify(input.conditions);
    if (input.actions !== undefined) updateValues.actions = JSON.stringify(input.actions);

    const [updated] = await db.update(rdTable).set({
      ...updateValues,
      updatedAt: now,
    }).where(eq(rdTable.id, ruleId)).returning();

    if (!updated) {
      throw new Error('UPDATE returned zero rows');
    }

    return NextResponse.json(
      { rule: { id: updated.id, name: updated.name, status: updated.status, updatedAt: now } },
      { status: 200 }
    );
  } catch (err) {
    if (err instanceof z.ZodError) {
      return errorResponse(badRequest(err.errors[0]?.message ?? 'Invalid request'));
    }
    return errorResponse(err);
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ruleId = (await params).id;

    if (!ruleId.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
      return errorResponse(badRequest('Invalid rule ID format'));
    }

    const [existing] = await db.select({ id: rdTable.id, status: rdTable.status })
      .from(rdTable).where(eq(rdTable.id, ruleId)).limit(1);

    if (!existing) {
      return errorResponse(new Error('Rule not found'));
    }

    const now = new Date();
    const [deleted] = await db.update(rdTable).set({ status: 'disabled', updatedAt: now })
      .where(eq(rdTable.id, ruleId)).returning();

    if (!deleted) {
      throw new Error('UPDATE returned zero rows');
    }

    return NextResponse.json(
      { message: `Rule ${ruleId} disabled`, rule: deleted },
      { status: 200 }
    );
  } catch (err) {
    if (err instanceof z.ZodError) {
      return errorResponse(badRequest(err.errors[0]?.message ?? 'Invalid request'));
    }
    return errorResponse(err);
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ruleId = (await params).id;

    if (!ruleId.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
      return errorResponse(badRequest('Invalid rule ID format'));
    }

    const input = EvaluateRuleInput.parse(await parseJsonBody(req));

    const [rule] = await db.select({
      id: rdTable.id,
      name: rdTable.name,
      domain: rdTable.domain,
      status: rdTable.status,
      conditions: rdTable.conditions,
      actions: rdTable.actions,
    }).from(rdTable).where(eq(rdTable.id, ruleId)).limit(1);

    if (!rule) {
      return errorResponse(new Error('Rule not found'));
    }

    const status = parseJsonField(rule.status) as 'draft' | 'active' | 'disabled';
    if (status !== 'active') {
      return NextResponse.json({
        evaluated: false,
        reason: `Rule is ${status}`,
        rule: { id: rule.id, name: rule.name },
      });
    }

    const conditions = parseJsonField(rule.conditions);
    const actions = parseJsonField(rule.actions);
    const evaluated = evaluateCondition(conditions as Record<string, unknown>, input.contextData as Record<string, unknown>);

    return NextResponse.json({
      evaluated,
      triggeredActions: evaluated ? actions : [],
      rule: { id: rule.id, name: rule.name },
      contextData: input.contextData,
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return errorResponse(badRequest(err.errors[0]?.message ?? 'Invalid request'));
    }
    return errorResponse(err);
  }
}

function evaluateCondition(condition: Record<string, unknown>, contextData: Record<string, unknown>): boolean {
  if (typeof condition !== 'object' || condition === null) return false;
  const cond = condition as any;

  // Handle logical operators
  if (cond.AND && Array.isArray(cond.AND)) {
    return cond.AND.every((c: any) => evaluateCondition(c, contextData));
  }

  if (cond.OR && Array.isArray(cond.OR)) {
    return cond.OR.some((c: any) => evaluateCondition(c, contextData));
  }

  // Handle single field conditions
  for (const [field, value] of Object.entries(condition)) {
    if (field === 'AND' || field === 'OR') continue;

    const actualValue = getFieldFromContext(field, contextData);
    let result: boolean = false;

    if (typeof value === 'object' && value !== null) {
      // Explicit operator format: { field: { operator: 'equals', value: 'x' } }
      const opCondition = value as any;
      const operator = opCondition.operator || 'equals';
      const expectedValue = opCondition.value ?? opCondition.equals;

      switch (operator) {
        case 'equals': result = actualValue === expectedValue; break;
        case 'notEquals': result = actualValue !== expectedValue; break;
        case 'greaterThan': result = Number(actualValue) > Number(expectedValue); break;
        case 'lessThan': result = Number(actualValue) < Number(expectedValue); break;
        case 'contains': result = String(actualValue).includes(String(expectedValue)); break;
        default: throw new Error(`Unknown operator: ${operator}`);
      }
    } else {
      // Implicit equals: { field: 'value' }
      result = actualValue === value;
    }

    if (!result) return false;
  }

  return true;
}

function getFieldFromContext(field: string, contextData: Record<string, unknown>): unknown {
  const parts = field.split('.');
  let value: any = contextData;

  for (const part of parts) {
    if (value === undefined || value === null) return undefined;
    value = value[part];
  }

  return value;
}
