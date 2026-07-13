/**
 * Workflow executor worker - processes workflow execution jobs from queue.
 */

import { Worker, type Job } from 'bullmq';
import IORedis from 'ioredis';
import { eq } from 'drizzle-orm';
import { db, workflowInstances } from '@heynxt/persistence';
import { getWorkerConcurrency, loadEnvConfig } from '../config';
import { validateWorkflowJobData } from '../queue/workflowQueue';
import { WorkflowEngine, type TransitionResult } from '../services/WorkflowEngine';

/**
 * Log transition attempt for monitoring.
 */
async function logTransitionAttempt(
  instanceId: string,
  result: TransitionResult
): Promise<void> {
  const [instance] = await db
    .select()
    .from(workflowInstances)
    .where(eq(workflowInstances.id, instanceId));

  if (instance && !result.success) {
    // Log failed attempt in workflow_instances contextData
    const existingAttempts = Array.isArray((instance.contextData as any)?.failedAttempts) ? (instance.contextData as any).failedAttempts : [];
    const attempts = [...existingAttempts, Date.now()];

    await db
      .update(workflowInstances)
      .set({
        contextData: { ...(instance.contextData || {}), failedAttempts: attempts },
      })
      .where(eq(workflowInstances.id, instanceId));
  }
}

/**
 * Process a workflow execution job.
 */
export async function processWorkflowJob(job: Job): Promise<TransitionResult> {
  const data = job.data;

  try {
    // Validate job data
    validateWorkflowJobData(data);

    let instanceId: string | undefined;

    // Determine if this is a new instance or resume of existing
    if (data.instanceId) {
      instanceId = data.instanceId;
    } else if (data.workflowId && typeof data.workflowId === 'string') {
      // Create new instance from definition
      const newInstance = await WorkflowEngine.createInstance(
        data.workflowId,
        data.triggerEvent,
        data.metadata
      );

      if (!newInstance) {
        throw new Error('Failed to create workflow instance');
      }

      instanceId = newInstance.id;
    } else {
      throw new Error('Invalid job: missing workflowId and instanceId');
    }

    // Execute the transition with valid triggerEvent
    const triggerEvent = data.triggerEvent ?? 'default';
    const result = await WorkflowEngine.executeTransition(
      instanceId!,
      triggerEvent,
      data.metadata
    );

    if (!result.success) {
      const errorMsg = result.error || 'Unknown error';
      console.warn(`Workflow transition failed for instance ${instanceId}:`, errorMsg);

      // Check if we should retry (e.g., transient error) or stop
      const retriableErrors = ['Instance not found', 'Definition not found'];
      if (retriableErrors.some((err) => errorMsg.includes(err))) {
        throw new Error(errorMsg);
      }

      // Non-retriable - log and return
      await logTransitionAttempt(instanceId!, result);
    } else {
      console.log(
        `Workflow transition succeeded: instance=${instanceId}, from=${result.fromState} -> to=${result.toState}`
      );
      await logTransitionAttempt(instanceId!, result);

      // Check if workflow completed and log final state
      const [instance] = await db
        .select()
        .from(workflowInstances)
        .where(eq(workflowInstances.id, instanceId!));

      if (instance?.status === 'completed') {
        console.log(`Workflow completed: ${instance.definitionId} - ${(data.triggerEvent ?? 'unknown event')}`);
      }
    }

    return result;
  } catch (error) {
    // Log failed execution attempt
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error('Workflow job processing failed:', errorMsg);

    throw error; // Let BullMQ handle retries
  }
}

/**
 * Create and configure the workflow executor worker.
 */
export function createWorkflowExecutorWorker() {
  const concurrency = getWorkerConcurrency('workflow');
  const queueName = loadEnvConfig().QUEUE_NAME_WORKFLOW;

  console.log(`Creating Workflow Executor Worker for queue "${queueName}" with concurrency=${concurrency}`);

  return new Worker(
    queueName,
    async (job: Job) => {
      return await processWorkflowJob(job);
    },
    {
      connection: loadRedisConnection(),
      concurrency,
      lockDuration: 30000, // Lock expires after 30s
      lockRenewTime: 15000, // Renew every 15s
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
