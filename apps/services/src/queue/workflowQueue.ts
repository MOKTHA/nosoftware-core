/**
 * Workflow execution queue definitions and utilities.
 */

import { Queue } from 'bullmq';
import type { WorkflowDefinition, WorkflowInstance } from '@heynxt/persistence';
import { QueueManager } from './QueueManager';
import { getQueueName } from '../config';

export interface WorkflowJobData {
  workflowId: string;
  instanceId?: string; // If undefined, create new instance
  triggerEvent: string;
  metadata?: Record<string, any>;
}

/**
 * Get the workflow execution queue.
 */
function getWorkflowQueue(): Queue {
  return QueueManager.getQueue(getQueueName('workflow'));
}

/**
 * Enqueue a workflow execution job.
 * If instanceId is provided, resumes/pauses an existing instance.
 * Otherwise creates a new instance from definition.
 */
export async function enqueueWorkflowExecution(
  data: WorkflowJobData
): Promise<string> {
  const queue = getWorkflowQueue();

  // Generate unique jobId based on workflow + trigger combination
  const jobId = `${data.workflowId}:${data.triggerEvent}:${Date.now()}`;

  await queue.add(data.triggerEvent, data, {
    jobId,
    attempts: 3,
    backoff: { type: 'exponential', delay: 1000 },
  });

  return jobId;
}

/**
 * Enqueue a workflow start job (creates new instance).
 */
export async function startWorkflowInstance(
  definitionId: string,
  triggerEvent: string,
  metadata?: Record<string, any>
): Promise<string> {
  return enqueueWorkflowExecution({
    workflowId: definitionId,
    triggerEvent,
    metadata,
  });
}

/**
 * Enqueue a workflow resume job (resumes paused instance).
 */
export async function resumeWorkflowInstance(
  instanceId: string,
  triggerEvent: string,
  metadata?: Record<string, any>
): Promise<string> {
  return enqueueWorkflowExecution({
    workflowId: '', // Empty = use existing instance
    instanceId,
    triggerEvent,
    metadata,
  });
}

/**
 * Enqueue a workflow pause job.
 */
export async function pauseWorkflowInstance(
  instanceId: string,
  reason?: string
): Promise<string> {
  return enqueueWorkflowExecution({
    workflowId: '',
    instanceId,
    triggerEvent: 'pause',
    metadata: { reason },
  });
}

/**
 * Enqueue a workflow cancel job.
 */
export async function cancelWorkflowInstance(
  instanceId: string,
  reason?: string
): Promise<string> {
  return enqueueWorkflowExecution({
    workflowId: '',
    instanceId,
    triggerEvent: 'cancel',
    metadata: { reason },
  });
}

/**
 * Get pending workflow jobs for a specific definition.
 */
export async function getPendingWorkflowJobs(definitionId: string) {
  const queue = getWorkflowQueue();
  return await queue.getWaiting();
}

/**
 * Validate workflow execution data.
 */
export function validateWorkflowJobData(data: WorkflowJobData): void {
  if (!data.triggerEvent || typeof data.triggerEvent !== 'string') {
    throw new Error('triggerEvent is required and must be a string');
  }

  // If creating new instance, need workflowId from definition
  if (!data.instanceId && !data.workflowId) {
    throw new Error(
      'Either workflowId (for new instance) or instanceId (for existing) is required'
    );
  }
}
