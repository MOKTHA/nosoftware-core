/**
 * Rules evaluation queue definitions and utilities.
 */

import { Queue } from 'bullmq';
import type { RuleDefinition, ruleDomainEnum } from '@heynxt/persistence';
import { QueueManager } from './QueueManager';
import { getQueueName } from '../config';

export interface RuleEvaluationJobData {
  ruleId: string;
  rule?: Partial<RuleDefinition>; // Cached definition for evaluation
  triggerEvent?: string; // Event that triggered this evaluation
  context?: Record<string, any>; // Evaluation context (latest events, etc.)
}

/**
 * Get the rules evaluation queue.
 */
function getRulesQueue(): Queue {
  return QueueManager.getQueue(getQueueName('rules'));
}

/**
 * Enqueue a rule evaluation job.
 */
export async function enqueueRuleEvaluation(
  data: RuleEvaluationJobData,
  priority?: number
): Promise<string> {
  const queue = getRulesQueue();

  const jobId = `rule:${data.ruleId}:${Date.now()}`;

  await queue.add('evaluate', data, {
    jobId,
    attempts: 3,
    backoff: { type: 'exponential', delay: 1000 },
    priority: priority ?? 5,
  });

  return jobId;
}

/**
 * Enqueue batch rule evaluations.
 */
export async function enqueueRuleEvaluations(
  ruleIds: string[],
  context?: Record<string, any>
): Promise<void> {
  const queue = getRulesQueue();

  await queue.addBulk(
    ruleIds.map((ruleId) => ({
      name: 'evaluate',
      data: { ruleId, context },
      jobId: `batch-rule:${ruleId}:${Date.now()}`,
      priority: 5,
    }))
  );
}

/**
 * Enqueue scheduled rule evaluation.
 */
export async function scheduleRuleEvaluation(
  ruleId: string,
  delayMs: number,
  context?: Record<string, any>
): Promise<void> {
  const queue = getRulesQueue();

  await queue.addDelayed('evaluate', { ruleId, context }, {
    jobId: `scheduled:${ruleId}:${Date.now()}`,
    delay: delayMs,
    priority: 5,
  });
}

/**
 * Get pending evaluations for a specific rule.
 */
export async function getPendingEvaluations(ruleId: string) {
  const queue = getRulesQueue();
  return await queue.getWaiting((job) => job.data.ruleId === ruleId);
}

/**
 * Validate rule evaluation data.
 */
export function validateRuleEvaluationData(data: RuleEvaluationJobData): void {
  if (!data.ruleId || typeof data.ruleId !== 'string') {
    throw new Error('ruleId is required and must be a string');
  }

  // If providing cached definition, validate it
  if (data.rule) {
    if (!data.rule.conditionExpression || !data.rule.domain) {
      throw new Error(
        'Cached rule definition must include conditionExpression and domain'
      );
    }

    if (!['work-order', 'routing', 'quality', 'maintenance', 'inventory', 'custom'].includes(data.rule.domain)) {
      throw new Error('Invalid rule domain');
    }
  }
}

/**
 * Prioritize rules based on severity and status.
 */
export function calculateRulePriority(
  rule: RuleDefinition,
  eventType?: string
): number {
  let priority = 5; // Default priority

  // Higher priority for critical violations
  if (rule.severity === 'critical') {
    priority = 1;
  } else if (rule.severity === 'high') {
    priority = 2;
  } else if (rule.severity === 'medium') {
    priority = 5;
  }

  // Boost priority for specific event types that indicate urgency
  const urgentEvents = ['alert', 'failure', 'error'];
  if (eventType && urgentEvents.includes(eventType.toLowerCase())) {
    priority = Math.max(1, priority - 2);
  }

  return priority;
}
