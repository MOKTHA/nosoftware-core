/**
 * Rule evaluator - evaluates business rules against runtime events.
 */

import { db, rules, ruleViolations, ruleEvaluationLog } from '@heynxt/persistence';
import type { RuleDefinition, InsertRuleViolation, RuleEvaluationLog as DBRuleEvaluationLog } from '@heynxt/persistence';
import { withTransaction } from '../database/db';

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
      .where(db.eq(rules.id, ruleId));

    return rule ?? null;
  }

  /**
   * Get all active rules for evaluation.
   */
  static async getActiveRules(): Promise<RuleDefinition[]> {
    return await db
      .select()
      .from(rules)
      .where(db.eq(rules.status, 'active'));
  }

  /**
   * Evaluate a single rule against provided context/events.
   */
  static async evaluateRule(ruleId: string, context?: Record<string, any>): Promise<EvaluationResult> {
    const startTime = Date.now();

    return await withTransaction(async (client) => {
      // Get rule definition
      const [rule] = await db
        .select()
        .from(rules)
        .where(db.eq(rules.id, ruleId))
        .execute(client);

      if (!rule) {
        throw new Error(`Rule not found: ${ruleId}`);
      }

      // Evaluate the condition (placeholder - replace with actual expression evaluation)
      const matched = await this.evaluateCondition(rule.conditionExpression, context);

      let violation: InsertRuleViolation | undefined;

      if (matched) {
        // Create violation record
        [violation] = await db
          .insert(ruleViolations)
          .values({
            ruleId,
            severity: rule.severity,
            status: 'active',
            detectedAt: new Date(),
            context: context ?? {},
          })
          .returning()
          .execute(client);

        console.log(`Rule matched: ${rule.name} (severity=${rule.severity})`);
      } else {
        console.log(`Rule not matched: ${rule.name}`);
      }

      // Log evaluation result
      const [logEntry] = await db
        .insert(ruleEvaluationLog)
        .values({
          ruleId,
          status: matched ? 'matched' : 'not_matched',
          violationCount: matched ? 1 : 0,
          evaluationTimeMs: Date.now() - startTime,
          context: JSON.stringify(context ?? {}),
        })
        .returning()
        .execute(client);

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
   * Evaluate a condition expression (placeholder).
   * In production, implement proper expression parsing and evaluation.
   */
  private static async evaluateCondition(
    conditionExpression: string,
    context?: Record<string, any>
  ): Promise<boolean> {
    // Placeholder implementation - replace with actual expression evaluator

    // Example patterns to support:
    // "temperature > 1200" -> check if temperature in context exceeds threshold
    // "status == 'error'" -> check status field
    // "duration > 3600 AND temperature < 800" -> compound conditions

    try {
      // Parse simple comparison expressions (placeholder logic)
      const match = conditionExpression.match(/(\w+)\s*(>|<|>=|<=|==|!=)\s*([\d.]+)/);

      if (!match) {
        // For complex expressions, log and return false as default
        console.warn(`Unparseable condition expression: ${conditionExpression}`);
        return false;
      }

      const [, field, operator, value] = match;
      const fieldValue = context?.[field];

      if (fieldValue === undefined) {
        // Field not in context - rule doesn't apply
        return false;
      }

      const numericValue = parseFloat(String(value));

      switch (operator) {
        case '>':
          return fieldValue > numericValue;
        case '<':
          return fieldValue < numericValue;
        case '>=':
          return fieldValue >= numericValue;
        case '<=':
          return fieldValue <= numericValue;
        case '==':
          return fieldValue == numericValue;
        case '!=':
          return fieldValue != numericValue;
        default:
          console.warn(`Unknown operator: ${operator}`);
          return false;
      }
    } catch (error) {
      console.error('Error evaluating condition:', error);
      return false; // Fail safe - don't trigger violations on evaluation errors
    }
  }

  /**
   * Get rule violation statistics.
   */
  static async getViolationStats(sinceMs?: number): Promise<{
    totalActive: number;
    bySeverity: Record<string, number>;
  }> {
    const where = sinceMs
      ? db.gte(ruleViolations.detectedAt, new Date(Date.now() - sinceMs))
      : undefined;

    const stats = await db
      .select({
        totalActive: db.sql`COUNT(*)`,
        criticalCount: db.sql`SUM(CASE WHEN severity = 'critical' THEN 1 ELSE 0 END)`,
        highCount: db.sql`SUM(CASE WHEN severity = 'high' THEN 1 ELSE 0 END)`,
        mediumCount: db.sql`SUM(CASE WHEN severity = 'medium' THEN 1 ELSE 0 END)`,
      })
      .from(ruleViolations)
      .where(db.and(where ?? undefined, db.eq(ruleViolations.status, 'active')))
      .execute();

    return {
      totalActive: Number(stats[0].totalActive),
      bySeverity: {
        critical: Number(stats[0].criticalCount ?? 0),
        high: Number(stats[0].highCount ?? 0),
        medium: Number(stats[0].mediumCount ?? 0),
      },
    };
  }

  /**
   * Acknowledge/resolve a violation.
   */
  static async resolveViolation(violationId: string, notes?: string): Promise<boolean> {
    const [updated] = await db
      .update(ruleViolations)
      .set({ status: 'resolved', resolvedAt: new Date(), resolutionNotes: notes })
      .where(db.eq(ruleViolations.id, violationId))
      .returning();

    return !!updated;
  }
}
