/**
 * Notification dispatch queue definitions and utilities.
 */

import { Queue } from 'bullmq';
import type { Notification } from '@heynxt/persistence';
import { QueueManager } from './QueueManager';
import { getQueueName } from '../config';

export interface NotificationJobData {
  notificationId?: string; // If undefined, creates new notification record
  recipient: string;
  channel: 'email' | 'slack' | 'webhook';
  subject?: string;
  body: string;
  priority?: 'low' | 'normal' | 'high' | 'critical';
  metadata?: Record<string, any>;
}

/**
 * Get the notification dispatch queue.
 */
function getNotificationQueue(): Queue {
  return QueueManager.getQueue(getQueueName('notification'));
}

/**
 * Enqueue a notification for dispatch.
 */
export async function enqueueNotification(
  data: NotificationJobData,
  priority?: number
): Promise<string> {
  const queue = getNotificationQueue();

  const jobId = `notif:${data.channel}:${data.recipient}:${Date.now()}`;

  await queue.add('dispatch', data, {
    jobId,
    attempts: 3, // Retry up to 3 times for transient failures
    backoff: { type: 'exponential', delay: 2000 }, // Exponential backoff
    priority: priority ?? (data.priority === 'high' || data.priority === 'critical' ? 1 : data.priority === 'normal' ? 5 : 10),
  });

  return jobId;
}

/**
 * Enqueue an email notification.
 */
export async function enqueueEmailNotification(
  recipient: string,
  subject: string,
  body: string,
  priority?: 'low' | 'normal' | 'high' | 'critical'
): Promise<string> {
  return enqueueNotification({
    recipient,
    channel: 'email',
    subject,
    body,
    priority,
  });
}

/**
 * Enqueue a Slack notification.
 */
export async function enqueueSlackNotification(
  webhookUrl: string,
  message: string,
  priority?: 'low' | 'normal' | 'high' | 'critical'
): Promise<string> {
  return enqueueNotification({
    recipient: webhookUrl,
    channel: 'slack',
    body: message,
    priority,
  });
}

/**
 * Enqueue a generic webhook notification.
 */
export async function enqueueWebhookNotification(
  endpoint: string,
  payload: Record<string, any>,
  priority?: 'low' | 'normal' | 'high' | 'critical'
): Promise<string> {
  return enqueueNotification({
    recipient: endpoint,
    channel: 'webhook',
    body: JSON.stringify(payload),
    metadata: { rawPayload: payload },
    priority,
  });
}

/**
 * Enqueue batch notifications.
 */
export async function enqueueBatchNotifications(
  notifications: NotificationJobData[]
): Promise<void> {
  const queue = getNotificationQueue();

  await queue.addBulk(
    notifications.map((notif) => ({
      name: 'dispatch',
      data: notif,
      jobId: `batch-notif:${Date.now()}:${notif.channel}:${notif.recipient}`,
      priority: notif.priority === 'high' || notif.priority === 'critical' ? 1 : notif.priority === 'normal' ? 5 : 10,
    }))
  );
}

/**
 * Get pending notifications by channel.
 */
export async function getPendingNotificationsByChannel(
  channel: 'email' | 'slack' | 'webhook'
): Promise<any[]> {
  const queue = getNotificationQueue();
  const jobs = await queue.getWaiting();
  return jobs.filter((job) => job.data.channel === channel);
}

/**
 * Validate notification data.
 */
export function validateNotificationData(data: NotificationJobData): void {
  if (!data.recipient || typeof data.recipient !== 'string') {
    throw new Error('recipient is required and must be a string');
  }

  if (typeof data.body !== 'string' || data.body.trim() === '') {
    throw new Error('body is required and must be a non-empty string');
  }

  // Subject required for email notifications
  if (data.channel === 'email' && (!data.subject || typeof data.subject !== 'string')) {
    throw new Error('subject is required for email notifications');
  }

  // Validate channel type
  const validChannels: ('email' | 'slack' | 'webhook')[] = ['email', 'slack', 'webhook'];
  if (!validChannels.includes(data.channel)) {
    throw new Error(`Invalid notification channel: ${data.channel}`);
  }
}

/**
 * Format email subject with priority prefix.
 */
export function formatEmailSubject(
  subject: string,
  priority?: 'low' | 'normal' | 'high' | 'critical'
): string {
  const prefix =
    priority === 'high' || priority === 'critical' ? '[HIGH PRIORITY] ' : priority === 'normal' ? '[NORMAL] ' : '';
  return `${prefix}${subject}`;
}
