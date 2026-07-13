/**
 * Drizzle table definition for `notifications` and `notification_delivery_attempts`.
 *
 * Phase 8 — Industrial Runtime Services: Notification service tables.
 * Handles email, Slack, webhook, and in-app notifications.
 */
import {
  pgTable,
  text,
  timestamp,
  jsonb,
  index,
} from 'drizzle-orm/pg-core';

// ---------------------------------------------------------------------------
// Enums for notification types
// ---------------------------------------------------------------------------

export const notificationChannelEnum = text('channel', {
  enum: ['email', 'slack', 'webhook', 'inApp'],
});

export const notificationPriorityEnum = text('priority', {
  enum: ['low', 'normal', 'high', 'urgent'],
});

export const notificationStatusEnum = text('status', {
  enum: ['pending', 'sending', 'sent', 'failed', 'expired'],
});

// ---------------------------------------------------------------------------
// Table: notifications (notification records)
// ---------------------------------------------------------------------------

/**
 * Stores notification records. The `config` field contains channel-specific
 * configuration as JSON (recipients for email, channel ID for Slack, etc.).
 */
export const notifications = pgTable(
  'notifications',
  {
    /** UUID string (server-generated if not provided). */
    id: text('id').primaryKey(),

    /** Notification title. */
    title: text('title').notNull(),

    /** Notification body content. */
    body: text('body').notNull(),

    /** Priority level. */
    priority: notificationPriorityEnum.notNull().default('normal'),

    /** Delivery channel. */
    channel: notificationChannelEnum.notNull(),

    /** Current delivery status. */
    status: notificationStatusEnum.notNull().default('pending'),

    /** Channel-specific configuration (JSON object). */
    config: jsonb('config').$type<unknown>().notNull(),

    /** FK to a notification template (optional, for reusable templates). */
    templateId: text('templateId'),

    /** Schedule configuration (for delayed/scheduled notifications). */
    schedule: jsonb('schedule').$type<unknown>(),

    /** Digest/aggregation configuration. */
    digest: jsonb('digest').$type<unknown>(),

    createdAt: timestamp('createdAt', { mode: 'date' }).notNull(),
  },
  (table) => ({
    statusIdx: index('notifications_status_idx').on(table.status),
    channelIdx: index('notifications_channel_idx').on(table.channel),
    priorityIdx: index(
      'notifications_priority_idx',
    ).on(table.priority),
  }),
);

// ---------------------------------------------------------------------------
// Table: notification_delivery_attempts (delivery audit trail)
// ---------------------------------------------------------------------------

/**
 * Records each delivery attempt for a notification. This provides an audit
 * trail and helps with debugging delivery failures.
 */
export const notificationDeliveryAttempts = pgTable(
  'notification_delivery_attempts',
  {
    /** UUID string. */
    id: text('id').primaryKey(),

    /** FK to the notification being delivered. */
    notificationId: text('notificationId')
      .notNull()
      .references(() => notifications.id, { onDelete: 'cascade' }),

    /** When the attempt was made. */
    attemptedAt: timestamp('attemptedAt', { mode: 'date' })
      .notNull()
      .$defaultFn(() => new Date()),

    /** Delivery status for this attempt. */
    status: text('status', {
      enum: ['success', 'failure'],
    }).notNull(),

    /** Status code from the delivery service (HTTP status, provider error code). */
    statusCode: text('statusCode'),

    /** Error message if delivery failed. */
    errorMessage: text('errorMessage'),

    /** Response payload from the delivery service (for debugging). */
    responsePayload: jsonb('responsePayload').$type<unknown>(),
  },
  (table) => ({
    notificationIdx: index(
      'notification_delivery_attempts_notificationId_idx',
    ).on(table.notificationId),
    statusIdx: index(
      'notification_delivery_attempts_status_idx',
    ).on(table.status),
    attemptedAtIdx: index(
      'notification_delivery_attempts_attemptedAt_idx',
    ).on(table.attemptedAt),
  }),
);

// ---------------------------------------------------------------------------
// Table: notification_templates (reusable templates)
// ---------------------------------------------------------------------------

/**
 * Stores reusable notification templates that can be referenced by ID.
 */
export const notificationTemplates = pgTable(
  'notification_templates',
  {
    /** UUID string. */
    id: text('id').primaryKey(),

    /** Template name (human-readable). */
    name: text('name').notNull(),

    /** Optional description. */
    description: text('description'),

    /** Which channel this template can be used with. */
    channel: notificationChannelEnum.notNull(),

    /** Title format string (with substitution placeholders like {{workOrderId}}). */
    titleFormat: text('titleFormat').notNull(),

    /** Body format string (with substitution placeholders). */
    bodyFormat: text('bodyFormat').notNull(),

    /** List of required fields for this template. */
    fields: jsonb('fields').$type<unknown>(),

    createdAt: timestamp('createdAt', { mode: 'date' })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => ({
    channelIdx: index(
      'notification_templates_channel_idx',
    ).on(table.channel),
  }),
);

// ---------------------------------------------------------------------------
// Type Exports
// ---------------------------------------------------------------------------

/** Notification record type. */
export type Notification = typeof notifications.$inferSelect;

/** Insertable notification (without id). */
export type InsertNotification = Omit<
  typeof notifications.$inferInsert,
  'id' | 'createdAt'
>;

/** Notification delivery attempt record type. */
export type NotificationDeliveryAttempt = typeof notificationDeliveryAttempts.$inferSelect;

/** Insertable notification delivery attempt (without id, attemptedAt). */
export type InsertNotificationDeliveryAttempt = Omit<
  typeof notificationDeliveryAttempts.$inferInsert,
  'id' | 'attemptedAt'
>;

/** Notification template record type. */
export type NotificationTemplate = typeof notificationTemplates.$inferSelect;

/** Insertable notification template (without id). */
export type InsertNotificationTemplate = Omit<
  typeof notificationTemplates.$inferInsert,
  'id' | 'createdAt'
>;
