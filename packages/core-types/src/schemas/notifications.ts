/**
 * Notification service schema for Phase 8 — Industrial Runtime Services
 *
 * Defines the structure of notifications sent via email, Slack, webhooks, etc.
 */

import { z } from 'zod';

// ============================================================================
// Notification Core Types
// ============================================================================

/** Unique identifier for a notification record */
export const NotificationId = z.string().uuid();
export type NotificationId = z.infer<typeof NotificationId>;

/** Delivery channel types */
export const NotificationChannelEnum = z.enum([
  'email',       // Email notification
  'slack',       // Slack message (workspace channel or DM)
  'webhook',     // HTTP webhook POST
  'inApp',       // In-app notification (UI badge/alert)
]);

export type NotificationChannel = z.infer<typeof NotificationChannelEnum>;

/** Priority levels for notifications */
export const NotificationPriorityEnum = z.enum(['low', 'normal', 'high', 'urgent']);
export type NotificationPriority = z.infer<typeof NotificationPriorityEnum>;

/** Delivery status of a notification */
export const NotificationStatusEnum = z.enum([
  'pending',     // Queued but not yet sent
  'sending',     // Currently being delivered
  'sent',        // Successfully delivered
  'failed',      // Delivery failed (will retry or be dropped)
  'expired',     // Message expired before delivery attempt
]);

export type NotificationStatus = z.infer<typeof NotificationStatusEnum>;

/** Base notification schema */
export const NotificationBaseSchema = z.object({
  id: NotificationId.optional(), // Generated on insert if not provided
  title: z.string().min(1, 'Title is required'),
  body: z.string().min(1, 'Body content is required'),
  priority: NotificationPriorityEnum.default('normal'),
  channel: NotificationChannelEnum,
  status: NotificationStatusEnum.default('pending'),
});

export const Notification = NotificationBaseSchema.extend({
  id: NotificationId, // Required for persisted notifications
});

export type Notification = z.infer<typeof Notification>;

// ============================================================================
// Email Notification Configuration
// ============================================================================

/** Email recipient schema */
export const EmailRecipientSchema = z.object({
  email: z.string().email('Valid email required'),
  name: z.string().optional(), // Display name
});

export type EmailRecipient = z.infer<typeof EmailRecipientSchema>;

/** Email notification configuration */
export const EmailNotificationConfigSchema = z.object({
  to: z.array(EmailRecipientSchema).min(1, 'At least one recipient required'),
  cc: z.array(z.string().email()).optional(),
  bcc: z.array(z.string().email()).optional(),
  replyTo: z.string().email().optional(),
  subjectTemplate: z.string().optional(), // Template for email subject (defaults to title)
});

export type EmailNotificationConfig = z.infer<typeof EmailNotificationConfigSchema>;

// ============================================================================
// Slack Notification Configuration
// ============================================================================

/** Slack channel ID or name */
export const SlackChannelIdOrNameSchema = z.object({
  id: z.string().min(1, 'Slack channel ID required').optional(), // #C0123456789 format for private channels/groups
  name: z.string().min(1, 'Slack channel name required').optional(), // "general" or "#general" for public channels
});

export type SlackChannelIdOrName = z.infer<typeof SlackChannelIdOrNameSchema>;

/** Slack user ID */
export const SlackUserIdSchema = z.string().regex(/^U[A-Z0-9]+$/, 'Valid Slack user ID (starts with U)');

export type SlackUserId = z.infer<typeof SlackUserIdSchema>;

/** Slack notification configuration */
export const SlackNotificationConfigSchema = z.object({
  channel: SlackChannelIdOrNameSchema.optional(), // Send to specific channel
  userId: SlackUserIdSchema.optional(), // Send as DM to specific user
  threadTs: z.string().optional(), // Reply in existing thread (for follow-up notifications)
  iconEmoji: z.string().optional(), // Custom emoji for bot avatar
});

export type SlackNotificationConfig = z.infer<typeof SlackNotificationConfigSchema>;

// ============================================================================
// Webhook Notification Configuration
// ============================================================================

/** HTTP method for webhook POST */
export const WebhookMethodEnum = z.enum(['POST', 'PUT']);

export type WebhookMethod = z.infer<typeof WebhookMethodEnum>;

/** Webhook notification configuration */
export const WebhookNotificationConfigSchema = z.object({
  url: z.string().url('Valid URL required'),
  method: WebhookMethodEnum.default('POST'),
  headers: z.record(z.string()).optional(), // Custom HTTP headers (e.g., Authorization, X-Custom-Header)
  timeoutMs: z.number().int().positive().default(30000), // Timeout in milliseconds
  retryCount: z.number().int().min(0).max(10).default(3), // Number of retries on failure
  secretKey: z.string().optional(), // Key for HMAC signature verification (server-side)
});

export type WebhookNotificationConfig = z.infer<typeof WebhookNotificationConfigSchema>;

// ============================================================================
// In-App Notification Configuration
// ============================================================================

/** In-app notification configuration */
export const InAppNotificationConfigSchema = z.object({
  icon: z.enum(['alert', 'info', 'warning', 'success', 'error']).optional(), // Visual indicator in UI
  actionUrl: z.string().url().optional(), // URL to navigate when clicked
  requiresAction: z.boolean().default(false), // Whether user must acknowledge this notification
  expiresAt: z.date().optional(), // When this notification should disappear from inbox
});

export type InAppNotificationConfig = z.infer<typeof InAppNotificationConfigSchema>;

// ============================================================================
// Notification Templates
// ============================================================================

/** Template for dynamic content substitution */
export const NotificationTemplateFieldSchema = z.object({
  name: z.string().min(1, 'Field name required'),
  description: z.string().optional(), // What this field represents
  type: z.enum(['string', 'number', 'date', 'url']).default('string'),
});

export type NotificationTemplateField = z.infer<typeof NotificationTemplateFieldSchema>;

/** Template definition for reusable notification content */
export const NotificationTemplateSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1, 'Template name required'),
  description: z.string().optional(),
  channel: NotificationChannelEnum, // Which channels this template can be used with
  titleFormat: z.string(), // Template format string (e.g., "Work Order {{workOrderId}} Status Changed")
  bodyFormat: z.string(), // Body content template with substitutions
  fields: z.array(NotificationTemplateFieldSchema).optional(), // List of required substitution fields
});

export type NotificationTemplate = z.infer<typeof NotificationTemplateSchema>;

// ============================================================================
// Predefined Templates (common industrial use cases)
// ============================================================================

/** Template for quality alert notifications */
export const QualityAlertTemplateSchema = NotificationTemplateSchema.extend({
  id: z.literal('quality-alert'),
  name: z.literal('Quality Alert'),
});

/** Template for equipment downtime notifications */
export const EquipmentDowntimeTemplateSchema = NotificationTemplateSchema.extend({
  id: z.literal('equipment-downtime'),
  name: z.literal('Equipment Downtime Alert'),
});

/** Template for approval request notifications */
export const ApprovalRequestTemplateSchema = NotificationTemplateSchema.extend({
  id: z.literal('approval-request'),
  name: z.literal('Approval Required'),
});

// ============================================================================
// Notification Delivery Scheduling
// ============================================================================

/** Schedule type for recurring notifications */
export const ScheduleTypeEnum = z.enum([
  'once',         // Send once at specific time
  'daily',        // Daily recurrence
  'weekly',       // Weekly recurrence on specified days
  'monthly',      // Monthly recurrence on specified day
]);

export type ScheduleType = z.infer<typeof ScheduleTypeEnum>;

/** Notification schedule configuration */
export const NotificationScheduleSchema = z.object({
  enabled: z.boolean().default(false),
  type: ScheduleTypeEnum.default('once'),
  runAt: z.string().optional(), // For 'once': ISO datetime string (e.g., "2024-01-15T10:00:00Z")
  dayOfWeek: z.array(z.enum(['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'])).optional(), // For weekly
  dayOfMonth: z.number().int().min(1).max(31).optional(), // For monthly (1-31)
  timezone: z.string().default('UTC'), // Timezone for schedule evaluation
});

export type NotificationSchedule = z.infer<typeof NotificationScheduleSchema>;

// ============================================================================
// Notification Aggregation/Digest
// ============================================================================

/** Group notifications into a digest to reduce alert fatigue */
export const NotificationDigestConfigSchema = z.object({
  enabled: z.boolean().default(false), // Whether to aggregate instead of send immediately
  maxIntervalMinutes: z.number().int().min(5).max(1440).default(60), // Max time between digests (1h default)
  maxCount: z.number().int().min(1).max(1000).default(50), // Max notifications per digest
  channelOverride: NotificationChannelEnum.optional(), // Override original channel for digest email
});

export type NotificationDigestConfig = z.infer<typeof NotificationDigestConfigSchema>;

// ============================================================================
// Complete Notification with Configuration (discriminated union by channel)
// ============================================================================

/** Full notification definition with all configuration options */
export const NotificationWithConfigSchema = z.object({
  id: NotificationId.optional(), // Generated on insert if not provided
  title: z.string().min(1, 'Title is required'),
  body: z.string().min(1, 'Body content is required'),
  priority: NotificationPriorityEnum.default('normal'),
  channel: NotificationChannelEnum,
  status: NotificationStatusEnum.default('pending'),

  // Config - discriminated by channel (use extend for each specific type)
  config: z.union([
    EmailNotificationConfigSchema.extend({}),
    SlackNotificationConfigSchema.extend({}),
    WebhookNotificationConfigSchema.extend({}),
    InAppNotificationConfigSchema.extend({}),
  ]),

  templateId: z.string().uuid().optional(), // Reference to a notification template
  schedule: NotificationScheduleSchema.optional(), // When to send (if delayed/scheduled)
  digest: NotificationDigestConfigSchema.optional(), // Whether to aggregate with other notifications
});

export type NotificationWithConfig = z.infer<typeof NotificationWithConfigSchema>;

// ============================================================================
// Delivery Attempt Tracking
// ============================================================================

/** Record of a delivery attempt for auditing */
export const DeliveryAttemptSchema = z.object({
  id: z.string().uuid(), // Unique attempt ID
  notificationId: NotificationId, // Which notification this is for
  attemptedAt: z.date(), // When the attempt was made
  status: z.enum(['success', 'failure']),
  statusCode: z.string().optional(), // HTTP status code or provider-specific error code
  errorMessage: z.string().optional(), // Error message if failed
  responsePayload: z.record(z.unknown()).optional(), // Response from delivery service (for debugging)
});

export type DeliveryAttempt = z.infer<typeof DeliveryAttemptSchema>;

// ============================================================================
// Notification API Schema
// ============================================================================

/** Request to send a notification */
export const SendNotificationRequestSchema = z.object({
  title: z.string().min(1),
  body: z.string().min(1),
  channel: NotificationChannelEnum,
  priority: NotificationPriorityEnum.optional(),
  config: z.union([
    EmailNotificationConfigSchema.extend({}),
    SlackNotificationConfigSchema.extend({}),
    WebhookNotificationConfigSchema.extend({}),
    InAppNotificationConfigSchema.extend({}),
  ]),
});

export type SendNotificationRequest = z.infer<typeof SendNotificationRequestSchema>;

/** Response after sending a notification */
export const SendNotificationResponseSchema = z.object({
  id: NotificationId, // ID of the created notification record
  status: NotificationStatusEnum, // Current delivery status
  estimatedDeliveryAt: z.date().optional(), // When delivery is expected (if scheduled)
});

export type SendNotificationResponse = z.infer<typeof SendNotificationResponseSchema>;

/** Request to query notifications */
export const QueryNotificationsRequestSchema = z.object({
  userId: z.string().uuid().optional(), // Filter by recipient user
  status: NotificationStatusEnum.optional(), // Filter by delivery status
  channel: NotificationChannelEnum.optional(), // Filter by delivery channel
  startDate: z.date().optional(), // Include notifications from this date onwards
  endDate: z.date().optional(), // Include notifications up to this date
  limit: z.number().int().min(1).max(500).default(50),
  offset: z.number().int().min(0).default(0),
});

export type QueryNotificationsRequest = z.infer<typeof QueryNotificationsRequestSchema>;
