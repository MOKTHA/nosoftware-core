/**
 * Rule evaluator - evaluates business rules against runtime events.
 */

import { eq, and } from 'drizzle-orm';
import crypto from 'crypto';
import { db, rules, ruleViolations, ruleEvaluationLog, type RuleDefinition, InsertRuleViolation, type RuleEvaluationLog as DBRuleEvaluationLog, kpiDefinitions, kpiSnapshots, kpiCalculationJobs } from '@heynxt/persistence';
import { withTransaction, getDrizzleClient } from '../database/db';

export interface EvaluationResult {
  ruleId: string;
  ruleName: string;
  evaluatedAt: Date;
  matched: boolean;
  violation?: InsertRuleViolation;
  context?: Record<string, any>;
}

/**
 * Rule evaluator for evaluating business rules against events.
 */
export class RuleEvaluator {
  /**
   * Load a rule definition by ID.
   */
  static async getRule(ruleId: string): Promise<RuleDefinition | null> {
    const [rule] = await db
      .select()
      .from(rules)
      .where(eq(rules.id, ruleId));

    return rule ?? null;
  }

  /**
   * Get all active rules for evaluation.
   */
  static async getActiveRules(): Promise<RuleDefinition[]> {
    const result = await db
      .select()
      .from(rules)
      .where(eq(rules.status, 'active'));

    return Array.isArray(result) ? result : [];
  }

  /**
   * Evaluate a single rule against provided context/events.
   */
  static async evaluateRule(ruleId: string, context?: Record<string, any>): Promise<EvaluationResult> {
    const startTime = Date.now();

    return await withTransaction(async (client) => {
      // Get transaction-scoped Drizzle client
      const txDb = getDrizzleClient(client);

      // Get rule definition
      const [rule] = await txDb
        .select()
        .from(rules)
        .where(eq(rules.id, ruleId));

      if (!rule) {
        throw new Error(`Rule not found: ${ruleId}`);
      }

      // Evaluate the condition (placeholder - replace with actual expression evaluation)
      const matched = await this.evaluateCondition(rule.conditions as any, context);

      let violation: InsertRuleViolation | undefined;

      if (matched) {
        // Create violation record with required fields matching schema
        [violation] = await txDb
          .insert(ruleViolations)
          .values({
            id: crypto.randomUUID(),
            ruleId,
            severity: 'warning' as const,
            contextSnapshot: context ?? {},
            triggerDetails: [],
            actionsTaken: [],
            createdAt: new Date(),
          })
          .returning();

        console.log(`Rule matched: ${rule.name} (severity=warning)`);
      } else {
        console.log(`Rule not matched: ${rule.name}`);
      }

      // Log evaluation result with required fields matching schema
      const [logEntry] = await txDb
        .insert(ruleEvaluationLog)
        .values({
          id: crypto.randomUUID(),
          ruleId,
          allConditionsPassed: !matched ? 'true' : 'false',
          evaluatedAt: new Date(),
          contextSnapshot: context ?? {},
        })
        .returning();

      return {
        ruleId,
        ruleName: rule.name,
        evaluatedAt: new Date(),
        matched,
        violation,
        context,
      };
    });
  }

  /**
   * Evaluate multiple rules in parallel.
   */
  static async evaluateRules(ruleIds: string[], context?: Record<string, any>): Promise<EvaluationResult[]> {
    const results = await Promise.all(
      ruleIds.map((ruleId) => this.evaluateRule(ruleId, context))
    );

    return results;
  }

  /**
   * Evaluate all active rules against provided context.
   */
  static async evaluateAllActiveRules(context?: Record<string, any>): Promise<EvaluationResult[]> {
    const activeRules = await this.getActiveRules();
    const ruleIds = activeRules.map((r) => r.id);

    return await this.evaluateRules(ruleIds, context);
  }

  /**
   * Evaluate a condition expression against provided context.
   * Supports: comparison operators (> < >= <= == !=), compound conditions (AND/OR/NOT)
   */
  private static async evaluateCondition(
    conditionExpression: any,
    context?: Record<string, any>
  ): Promise<boolean> {
    try {
      if (!conditionExpression || typeof conditionExpression !== 'string') {
        return false; // No valid expression to evaluate
      }

      const expr = conditionExpression.trim();
      if (expr === '') {
        return false;
      }

      return this.evaluateExpression(expr, context);
    } catch (error) {
      console.error('Error evaluating condition:', error);
      return false; // Fail safe - don't trigger violations on evaluation errors
    }
  }

  /**
   * Evaluate a parsed expression against context.
   */
  private static evaluateExpression(expr: string, context?: Record<string, any>): boolean {
    // Handle NOT operator (highest precedence)
    if (expr.startsWith('NOT ')) {
      return !this.evaluateExpression(expr.substring(4).trim(), context);
    }

    // Handle OR operators (lowest precedence among binary ops)
    const orParts = this.splitByOperator(expr, /\s+OR\s+/i);
    if (orParts.length > 1) {
      return orParts.some(part => this.evaluateExpression(part.trim(), context));
    }

    // Handle AND operators (higher precedence than OR)
    const andParts = this.splitByOperator(expr, /\s+AND\s+/i);
    if (andParts.length > 1) {
      return andParts.every(part => this.evaluateExpression(part.trim(), context));
    }

    // Handle parenthesized expressions
    if (expr.startsWith('(') && expr.endsWith(')')) {
      return this.evaluateExpression(expr.substring(1, expr.length - 1), context);
    }

    // Evaluate comparison expression
    return this.evaluateComparison(expr, context);
  }

  /**
   * Split expression by operator while respecting parentheses.
   */
  private static splitByOperator(expr: string, regex: RegExp): string[] {
    const parts: string[] = [];
    let current = '';
    let parenDepth = 0;

    for (let i = 0; i < expr.length; i++) {
      const char = expr[i];

      if (char === '(') {
        parenDepth++;
        current += char;
      } else if (char === ')') {
        parenDepth--;
        current += char;
      } else if (parenDepth === 0 && regex.test(expr.substring(i))) {
        // Check for operator match at this position
        const match = expr.substring(i).match(regex);
        if (match) {
          parts.push(current.trim());
          current = '';
          i += match[0].length - 1;
          continue;
        }
      }

      current += char;
    }

    if (current.trim()) {
      parts.push(current.trim());
    }

    return parts;
  }

  /**
   * Evaluate a single comparison expression.
   */
  private static evaluateComparison(expr: string, context?: Record<string, any>): boolean {
    // Match patterns like: field > value, field == 'string', field != null
    const match = expr.match(/^(\w+)\s*(>|<|>=|<=|==|!=)\s*([\d.]+|'[^']*'|"[^"]*"|\bnull\b)$/i);

    if (!match || !match[1] || !match[2] || !match[3]) {
      console.warn(`Unparseable comparison expression: ${expr}`);
      return false;
    }

    const [, field, operator, valueStr] = match;

    // Get field value from context
    const fieldValue = this.getFieldValue(field, context);

    if (fieldValue === undefined) {
      // Field not in context - rule doesn't apply
      return false;
    }

    // Parse the comparison value
    let compareValue: string | number | null;
    if (valueStr === 'null') {
      compareValue = null;
    } else if (valueStr.startsWith("'") || valueStr.startsWith('"')) {
      compareValue = valueStr.slice(1, -1); // Remove quotes
    } else {
      compareValue = parseFloat(valueStr);
    }

    // Perform comparison
    switch (operator) {
      case '>':
        return compareValue !== null && fieldValue > compareValue;
      case '<':
        return compareValue !== null && fieldValue < compareValue;
      case '>=':
        return compareValue !== null && fieldValue >= compareValue;
      case '<=':
        return compareValue !== null && fieldValue <= compareValue;
      case '==':
        // Loose equality for type flexibility
        if (compareValue === null) {
          return fieldValue == null;
        }
        if (typeof compareValue === 'number' && typeof fieldValue === 'string') {
          return parseFloat(fieldValue) == compareValue;
        }
        return fieldValue == compareValue;
      case '!=':
        // Loose equality for type flexibility
        if (compareValue === null) {
          return fieldValue != null;
        }
        if (typeof compareValue === 'number' && typeof fieldValue === 'string') {
          return parseFloat(fieldValue) != compareValue;
        }
        return fieldValue != compareValue;
      default:
        console.warn(`Unknown operator: ${operator}`);
        return false;
    }
  }

  /**
   * Get field value from context, supporting nested paths like 'process.temperature'.
   */
  private static getFieldValue(field: string, context?: Record<string, any>): any {
    const keys = field.split('.');
    let value: any = context;

    for (const key of keys) {
      if (value === undefined || value === null) {
        return undefined;
      }
      value = value[key];
    }

    return value;
  }

  /**
   * Get rule violation statistics.
   */
  static async getViolationStats(sinceMs?: number): Promise<{
    totalActive: number;
    bySeverity: Record<string, number>;
  }> {
    const stats = await db
      .select({
        totalActive: kpiDefinitions.id,
      })
      .from(kpiDefinitions)
      .execute();

    return {
      totalActive: stats.length || 0,
      bySeverity: {},
    };
  }

  /**
   * Acknowledge/resolve a violation.
   */
  static async resolveViolation(violationId: string, notes?: string): Promise<boolean> {
    const [updated] = await db
      .update(ruleViolations)
      .set({ resolutionNotes: notes })
      .where(eq(ruleViolations.id, violationId))
      .returning();

    return !!updated;
  }
}
