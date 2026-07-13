/**
 * Notification service - sends notifications via multiple channels (email, Slack, webhooks).
 */

import nodemailer from 'nodemailer';
import { getSmtpConfig, getSlackWebhookUrl } from '../config';

export interface NotificationResult {
  success: boolean;
  channel: string;
  messageId?: string;
  error?: string;
}

/**
 * Notification service for sending emails, Slack messages, and webhook notifications.
 */
export class NotificationService {
  private static smtpTransport: nodemailer.Transporter | null = null;

  /**
   * Get SMTP transporter (lazy initialization).
   */
  private static getSmtpTransporter(): nodemailer.Transporter | null {
    if (!this.smtpTransport) {
      const config = getSmtpConfig();
      if (!config) {
        return null;
      }

      this.smtpTransport = nodemailer.createTransport({
        host: config.host,
        port: config.port ?? 587,
        secure: config.port === 465,
        auth: config.user && config.pass
          ? {
              user: config.user,
              pass: config.pass,
            }
          : undefined,
      });

      // Test connection on init
      this.smtpTransport.verify((err) => {
        if (err) {
          console.warn('SMTP transporter verification failed:', err.message);
        } else {
          console.log('SMTP transporter connected successfully');
        }
      });
    }

    return this.smtpTransport;
  }

  /**
   * Send an email notification.
   */
  static async sendEmail(
    recipient: string,
    subject: string,
    body: string,
    from?: string
  ): Promise<NotificationResult> {
    const transporter = this.getSmtpTransporter();

    if (!transporter) {
      return { success: false, channel: 'email', error: 'SMTP not configured' };
    }

    try {
      const info = await transporter.sendMail({
        from: from ?? getSmtpConfig()?.from ?? 'noreply@heynxt.local',
        to: recipient,
        subject,
        text: body,
        html: `<pre>${body}</pre>`, // Basic HTML formatting
      });

      console.log(`Email sent to ${recipient}: messageId=${info.messageId}`);

      return { success: true, channel: 'email', messageId: info.messageId };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error('Failed to send email:', errorMsg);
      return { success: false, channel: 'email', error: errorMsg };
    }
  }

  /**
   * Send a Slack notification via webhook.
   */
  static async sendSlack(
    webhookUrl: string,
    message: string,
    priority?: 'high' | 'medium' | 'low'
  ): Promise<NotificationResult> {
    try {
      // Format Slack message based on priority
      const blocks = this.formatSlackMessage(message, priority);

      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ blocks }),
      });

      if (!response.ok) {
        throw new Error(`Slack webhook returned ${response.status}: ${response.statusText}`);
      }

      console.log('Slack notification sent successfully');

      return { success: true, channel: 'slack' };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error('Failed to send Slack notification:', errorMsg);
      return { success: false, channel: 'slack', error: errorMsg };
    }
  }

  /**
   * Send a generic webhook notification.
   */
  static async sendWebhook(
    endpoint: string,
    payload: Record<string, any>,
    headers?: Record<string, string>
  ): Promise<NotificationResult> {
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...headers,
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error(`Webhook returned ${response.status}: ${response.statusText}`);
      }

      console.log('Webhook notification sent successfully');

      return { success: true, channel: 'webhook' };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error('Failed to send webhook notification:', errorMsg);
      return { success: false, channel: 'webhook', error: errorMsg };
    }
  }

  /**
   * Send a notification based on channel type.
   */
  static async send(
    channel: 'email' | 'slack' | 'webhook',
    recipient: string,
    subject?: string,
    body?: string,
    metadata?: Record<string, any>
  ): Promise<NotificationResult> {
    switch (channel) {
      case 'email':
        if (!subject || !body) {
          return { success: false, channel: 'email', error: 'Email requires subject and body' };
        }
        return await this.sendEmail(recipient, subject, body);

      case 'slack':
        if (!body) {
          return { success: false, channel: 'slack', error: 'Slack notification requires message body' };
        }
        // Use configured webhook URL or the recipient as webhook URL
        const slackUrl = getSlackWebhookUrl() ?? recipient;
        return await this.sendSlack(slackUrl, body);

      case 'webhook':
        if (!body) {
          return { success: false, channel: 'webhook', error: 'Webhook notification requires payload' };
        }
        try {
          const payload = JSON.parse(body);
          return await this.sendWebhook(recipient, payload, metadata?.headers);
        } catch {
          return { success: false, channel: 'webhook', error: 'Invalid JSON in webhook body' };
        }

      default:
        return { success: false, channel, error: `Unknown notification channel: ${channel}` };
    }
  }

  /**
   * Format message for Slack with priority indicators.
   */
  private static formatSlackMessage(message: string, priority?: 'high' | 'medium' | 'low'): Array<{
    type: string;
    text?: { type: string; text: string };
    accessory?: any;
  }> {
    const color =
      priority === 'high' ? '#ff0000' : priority === 'medium' ? '#ff9500' : '#36a64f';

    return [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: `Notification ${priority ? `[${priority.toUpperCase()}]` : ''}`,
        },
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: message,
        },
      },
    ];
  }

  /**
   * Test SMTP connection.
   */
  static async testSmtpConnection(): Promise<{ success: boolean; error?: string }> {
    const transporter = this.getSmtpTransporter();

    if (!transporter) {
      return { success: false, error: 'SMTP not configured' };
    }

    try {
      await transporter.verify();
      return { success: true };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      return { success: false, error: errorMsg };
    }
  }

  /**
   * Clear SMTP transport (for testing).
   */
  static clearSmtpTransporter(): void {
    this.smtpTransport?.close();
    this.smtpTransport = null;
  }
}
