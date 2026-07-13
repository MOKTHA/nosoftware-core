/**
 * Queue exports - centralized export for all queue modules.
 */

export { QueueManager } from './QueueManager';
export type { WorkflowJobData } from './workflowQueue';
export {
  enqueueWorkflowExecution,
  startWorkflowInstance,
  resumeWorkflowInstance,
  pauseWorkflowInstance,
  cancelWorkflowInstance,
  getPendingWorkflowJobs,
  validateWorkflowJobData,
} from './workflowQueue';

export type { EventJobData } from './eventQueue';
export {
  enqueueEvent,
  enqueueEventBatch,
  enqueueBulkEvents,
  getPendingEventsBySource,
  isDuplicateEvent,
  validateEventJobData,
} from './eventQueue';

export type { RuleEvaluationJobData } from './rulesQueue';
export {
  enqueueRuleEvaluation,
  enqueueRuleEvaluations,
  scheduleRuleEvaluation,
  getPendingEvaluations,
  validateRuleEvaluationData,
  calculateRulePriority,
} from './rulesQueue';

export type { NotificationJobData } from './notificationQueue';
export {
  enqueueNotification,
  enqueueEmailNotification,
  enqueueSlackNotification,
  enqueueWebhookNotification,
  enqueueBatchNotifications,
  getPendingNotificationsByChannel,
  validateNotificationData,
  formatEmailSubject,
} from './notificationQueue';
