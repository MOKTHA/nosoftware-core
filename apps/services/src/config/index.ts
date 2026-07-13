/**
 * Configuration loader for service workers.
 * Reads environment variables and provides typed configuration.
 */

import { z } from 'zod';

const envSchema = z.object({
  // Database
  DATABASE_URL: z.string().url(),

  // Redis connection
  REDIS_URL: z.string().url().default('redis://localhost:6379'),

  // Node environment
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),

  // Worker configuration
  WORKER_CONCURRENCY_WORKFLOW: z.string().regex(/^\d+$/).default('5'),
  WORKER_CONCURRENCY_EVENT: z.string().regex(/^\d+$/).default('10'),
  WORKER_CONCURRENCY_RULES: z.string().regex(/^\d+$/).default('5'),
  WORKER_CONCURRENCY_NOTIFICATION: z.string().regex(/^\d+$/).default('3'),

  // Queue names (can be customized per environment)
  QUEUE_NAME_WORKFLOW: z.string().default('workflow_queue'),
  QUEUE_NAME_EVENT: z.string().default('event_queue'),
  QUEUE_NAME_RULES: z.string().default('rules_queue'),
  QUEUE_NAME_NOTIFICATION: z.string().default('notification_queue'),

  // Notification settings (SMTP)
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.string().regex(/^\d+$/).optional(),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  SMTP_FROM: z.string().email().optional(),

  // Slack webhook (for notifications)
  SLACK_WEBHOOK_URL: z.string().url().optional(),
});

export type EnvConfig = z.infer<typeof envSchema>;

/**
 * Load and validate environment configuration.
 * Throws on invalid config to fail fast at startup.
 */
export function loadEnvConfig(): EnvConfig {
  const result = envSchema.safeParse(process.env);

  if (!result.success) {
    console.error('Invalid environment configuration:');
    console.error(result.error.format());
    process.exit(1);
  }

  return result.data;
}

/**
 * Get worker concurrency for a specific queue type.
 */
export function getWorkerConcurrency(queueType: 'workflow' | 'event' | 'rules' | 'notification'): number {
  const key = `WORKER_CONCURRENCY_${queueType.toUpperCase()}` as keyof EnvConfig;
  return parseInt(loadEnvConfig()[key], 10);
}

/**
 * Get queue name for a specific type.
 */
export function getQueueName(queueType: 'workflow' | 'event' | 'rules' | 'notification'): string {
  const key = `QUEUE_NAME_${queueType.toUpperCase()}` as keyof EnvConfig;
  return loadEnvConfig()[key];
}

/**
 * Get SMTP configuration for email notifications.
 */
export function getSmtpConfig(): { host: string; port?: number; user?: string; pass?: string; from?: string } | null {
  const config = loadEnvConfig();
  if (!config.SMTP_HOST) {
    return null;
  }

  return {
    host: config.SMTP_HOST,
    port: config.SMTP_PORT ? parseInt(config.SMTP_PORT, 10) : undefined,
    user: config.SMTP_USER,
    pass: config.SMTP_PASS,
    from: config.SMTP_FROM,
  };
}

/**
 * Get Slack webhook URL.
 */
export function getSlackWebhookUrl(): string | undefined {
  return loadEnvConfig().SLACK_WEBHOOK_URL;
}
