/**
 * Rule evaluator - evaluates business rules against runtime events.
 */

import { eq, and } from 'drizzle-orm';
import crypto from 'crypto';
import { db, rules, ruleViolations, ruleEvaluationLog, type RuleDefinition, InsertRuleViolation, type RuleEvaluationLog as DBRuleEvaluationLog, kpiDefinitions, kpiSnapshots, kpiCalculationJobs } from '@heynxt/persistence';
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
      // Get rule definition
      const [rule] = await db
        .select()
        .from(rules)
        .where(eq(rules.id, ruleId))
        .execute(client);

      if (!rule) {
        throw new Error(`Rule not found: ${ruleId}`);
      }

      // Evaluate the condition (placeholder - replace with actual expression evaluation)
      const matched = await this.evaluateCondition(rule.conditions as any, context);

      let violation: InsertRuleViolation | undefined;

      if (matched) {
        // Create violation record with required fields matching schema
        [violation] = await db
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
          .returning()
          .execute(client);

        console.log(`Rule matched: ${rule.name} (severity=warning)`);
      } else {
        console.log(`Rule not matched: ${rule.name}`);
      }

      // Log evaluation result with required fields matching schema
      const [logEntry] = await db
        .insert(ruleEvaluationLog)
        .values({
          id: crypto.randomUUID(),
          ruleId,
          allConditionsPassed: !matched ? 'true' : 'false',
          evaluatedAt: new Date(),
          contextSnapshot: context ?? {},
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
    conditionExpression: any,
    context?: Record<string, any>
  ): Promise<boolean> {
    // Placeholder implementation - replace with actual expression evaluator

    // Example patterns to support:
    // "temperature > 1200" -> check if temperature in context exceeds threshold
    // "status == 'error'" -> check status field
    // "duration > 3600 AND temperature < 800" -> compound conditions

    try {
      // Parse simple comparison expressions (placeholder logic)
      const match = typeof conditionExpression === 'string' ?
        conditionExpression.match(/(\w+)\s*(>|<|>=|<=|==|!=)\s*([\d.]+)/) : null;

      if (!match || !conditionExpression) {
        // For complex expressions, log and return false as default
        console.warn(`Unparseable condition expression: ${conditionExpression}`);
        return false;
      }

      const [, field, operator, value] = match;
      if (!field || !value) {
        console.warn(`Invalid match pattern: ${conditionExpression}`);
        return false;
      }

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
