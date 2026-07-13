/**
 * Rules evaluator worker - evaluates business rules against runtime events.
 */

import { Worker, type Job } from 'bullmq';
import IORedis from 'ioredis';
import { getWorkerConcurrency, loadEnvConfig } from '../config';
import { validateRuleEvaluationData, calculateRulePriority } from '../queue/rulesQueue';
import { RuleEvaluator, type EvaluationResult } from '../services/RuleEvaluator';

/**
 * Process a rule evaluation job.
 */
export async function processRuleJob(job: Job): Promise<EvaluationResult> {
  const data = job.data;

  try {
    // Validate job data
    validateRuleEvaluationData(data);

    // Evaluate the rule (with or without cached definition)
    const result = await RuleEvaluator.evaluateRule(data.ruleId, data.context);

    return result;
  } catch (error) {
    console.error('Rule evaluation failed:', error instanceof Error ? error.message : String(error));
    throw error; // Let BullMQ handle retries
  }
}

/**
 * Create and configure the rules evaluator worker.
 */
export function createRulesEvaluatorWorker() {
  const concurrency = getWorkerConcurrency('rules');
  const queueName = loadEnvConfig().QUEUE_NAME_RULES;

  console.log(`Creating Rules Evaluator Worker for queue "${queueName}" with concurrency=${concurrency}`);

  return new Worker(
    queueName,
    async (job: Job) => {
      return await processRuleJob(job);
    },
    {
      connection: loadRedisConnection(),
      concurrency,
      lockDuration: 30000, // Lock expires after 30s
      lockRenewTime: 15000, // Renew every 15s
      keepJobs: {
        count: 1000, // Keep last 1000 completed jobs
      },
    }
  );
}

/**
 * Get Redis connection from config.
 */
function loadRedisConnection() {
  const redisUrl = loadEnvConfig().REDIS_URL;
  return new IORedis(redisUrl);
}
