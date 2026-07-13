/**
 * /api/rules/[id]/evaluate — Rule Evaluation API (Phase 8)
 *
 *   POST   /api/rules/[id]/evaluate
 *     Evaluate a specific rule against provided context data.
 *     Body: { contextData }
 *     Returns { evaluated, result?, triggeredActions[] }.
 */

import { NextRequest, NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { z } from 'zod';

import { db, ruleDefinitions as rdTable } from '@heynxt/persistence';

import { badRequest, errorResponse, parseJsonBody } from '@/lib/api';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/** Zod schema for rule evaluation. */
const EvaluateRuleInput = z.object({
  contextData: z.record(z.unknown()).min(1, 'Context data is required'),
});

type EvaluateRuleInput = z.infer<typeof EvaluateRuleInput>;

// ---------------------------------------------------------------------------
// POST /api/rules/[id]/evaluate
// ---------------------------------------------------------------------------

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ruleId = (await params).id;

    // Validate UUID format
    if (!ruleId.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
      return errorResponse(badRequest('Invalid rule ID format'));
    }

    // Parse request body
    const input = EvaluateRuleInput.parse(await parseJsonBody(req));

    // Fetch the specific rule definition
    const [rule] = await db
      .select({
        id: rdTable.id,
        name: rdTable.name,
        domain: rdTable.domain,
        condition: rdTable.condition,
        actions: rdTable.actions,
        priority: rdTable.priority,
        isActive: rdTable.isActive,
      })
      .from(rdTable)
      .where(eq(rdTable.id, ruleId))
      .limit(1);

    if (!rule) {
      return errorResponse(new Error('Rule not found'), 404);
    }

    // Check if rule is active (deactivated rules cannot be evaluated)
    if (!rule.isActive) {
      return NextResponse.json({
        evaluated: false,
        reason: 'Rule is deactivated',
        rule: { id: rule.id, name: rule.name },
      });
    }

    // Parse JSON fields
    const condition = JSON.parse(rule.condition);
    const actions = JSON.parse(rule.actions);

    // Simple evaluation logic - in production this would use a proper rules engine
    // For now, we implement basic comparison operators
    let evaluated = false;
    let errorMessage: string | undefined;

    try {
      evaluated = evaluateCondition(condition, input.contextData);
    } catch (evalErr) {
      errorMessage = evalErr instanceof Error ? evalErr.message : 'Evaluation error';
    }

    // Record evaluation result in audit log (best-effort)
    const db = await import('@heynxt/persistence').then(m => m.db);
    if (db && evaluated) {
      try {
        const ruleViolationsTable = await import('@heynxt/persistence')
          .then(m => m.ruleViolations);
        if (ruleViolationsTable) {
          // Note: This requires the violations table to exist from Phase 8 migration
          await db.insert(ruleViolationsTable).values({
            ruleId,
            evaluatedAt: new Date(),
            contextSnapshot: JSON.stringify(input.contextData),
            result: 'triggered',
          });
        }
      } catch (logErr) {
        console.warn('Failed to record rule evaluation:', logErr);
      }
    }

    return NextResponse.json({
      evaluated,
      reason: errorMessage,
      triggeredActions: evaluated ? actions : [],
      rule: {
        id: rule.id,
        name: rule.name,
        domain: rule.domain,
        priority: rule.priority,
      },
      contextData: input.contextData,
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return errorResponse(badRequest(err.errors[0]?.message ?? 'Invalid request'));
    }
    return errorResponse(err);
  }
}

/**
 * Simple condition evaluator for basic comparison operators.
 * Supports: equals, notEquals, greaterThan, lessThan, contains, exists
 */
function evaluateCondition(condition: Record<string, unknown>, contextData: Record<string, unknown>): boolean {
  // Expected format: { field: 'value', operator: 'equals' } or nested conditions with AND/OR

  if (typeof condition !== 'object' || condition === null) {
    return false;
  }

  const cond = condition as any;

  // Handle logical operators
  if (cond.AND && Array.isArray(cond.AND)) {
    return cond.ARED.every((c: any) => evaluateCondition(c, contextData));
  }

  if (cond.OR && Array.isArray(cond.OR)) {
    return cond.OR.some((c: any) => evaluateCondition(c, contextData));
  }

  // Handle single field conditions
  for (const [field, value] of Object.entries(condition)) {
    if (field === 'AND' || field === 'OR') continue;

    const actualValue = getFieldFromContext(field, contextData);

    // Determine operator based on value type or explicit operator field
    let result: boolean = false;

    if (typeof value === 'object' && value !== null) {
      // Explicit operator format: { field: { operator: 'equals', value: 'x' } }
      const opCondition = value as any;
      const operator = opCondition.operator || 'equals';
      const expectedValue = opCondition.value ?? opCondition.equals;

      switch (operator) {
        case 'equals':
          result = actualValue === expectedValue;
          break;
        case 'notEquals':
          result = actualValue !== expectedValue;
          break;
        case 'greaterThan':
          result = Number(actualValue) > Number(expectedValue);
          break;
        case 'lessThan':
          result = Number(actualValue) < Number(expectedValue);
          break;
        case 'contains':
          result = String(actualValue).includes(String(expectedValue));
          break;
        default:
          throw new Error(`Unknown operator: ${operator}`);
      }
    } else {
      // Implicit equals: { field: 'value' }
      result = actualValue === value;
    }

    if (!result) {
      return false;
    }
  }

  return true;
}

/** Extract a nested field value from context data using dot notation. */
function getFieldFromContext(field: string, contextData: Record<string, unknown>): unknown {
  const parts = field.split('.');
  let value: any = contextData;

  for (const part of parts) {
    if (value === undefined || value === null) {
      return undefined;
    }
    value = value[part];
  }

  return value;
}
