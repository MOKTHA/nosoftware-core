/**
 * /api/notifications — Notification Service API (Phase 8)
 */

import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';
import { eq, and, sql } from 'drizzle-orm';
import { z } from 'zod';

import { db, notifications as notifTable, notificationDeliveryAttempts as ndaTable } from '@heynxt/persistence';

import { badRequest, errorResponse, parseJsonBody } from '@/lib/api';
import { requireAuth } from '@/lib/session';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const SendNotificationInput = z.object({
  type: z.string().min(1),
  recipientId: z.string().uuid().optional(),
  subject: z.string().min(1).max(200),
  message: z.string().min(1),
  channel: z.enum(['email', 'slack', 'webhook']).default('email'),
  webhookUrl: z.string().url().optional(),
  metadata: z.record(z.unknown()).optional(),
});

const NotificationsQueryParams = z.object({
  status: z.enum(['sent', 'pending', 'failed']).optional(),
  limit: z.string().transform(Number).default('100'),
});

export async function GET(req: NextRequest) {
  try {
    await requireAuth();
    const params = NotificationsQueryParams.parse({
      status: req.nextUrl.searchParams.get('status') as 'sent' | 'pending' | 'failed' ?? undefined,
      limit: req.nextUrl.searchParams.get('limit') ?? '100',
    });

    const conditions: any[] = [eq(notifTable.recipientId, (await requireAuth()).user.id)];
    if (params.status) {
      conditions.push(eq(notifTable.status, params.status));
    }

    const where = and(...conditions);
    const limit = Math.min(params.limit, 1000);
    const offset = parseInt(req.nextUrl.searchParams.get('offset') ?? '0');

    const rows = await db.select({
      id: notifTable.id, type: notifTable.type, recipientId: notifTable.recipientId, subject: notifTable.subject, message: notifTable.message, channel: notifTable.channel, status: notifTable.status, metadata: notifTable.metadata, createdAt: notifTable.createdAt,
    }).from(notifTable).where(where).orderBy(desc(notifTable.createdAt)).limit(limit).offset(offset);

    const countResult = await db.select({ count: sql`count(*) as count` }).from(notifTable).where(where);

    return NextResponse.json({ notifications: rows, pagination: { total: parseInt(countResult[0]?.count ?? '0'), limit, offset } }, { status: 200 });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return errorResponse(badRequest(err.errors[0]?.message ?? 'Invalid request'));
    }
    return errorResponse(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    await requireAuth();
    const userId = (await requireAuth()).user.id;
    const input = SendNotificationInput.parse(await parseJsonBody(req));

    if (input.channel === 'webhook' && !input.webhookUrl) throw badRequest('Webhook URL is required for webhook channel');

    const now = new Date();
    const notificationId = randomUUID();
    const recipientId = input.recipientId ?? userId;

    // Simulate delivery - in production, integrate with actual email/slack/webhook services
    await simulateNotificationDelivery(input.channel, input.webhookUrl ?? '', input);

    return NextResponse.json({
      notification: { id: notificationId, type: input.type, recipientId, subject: input.subject, channel: input.channel, status: 'sent', createdAt: now },
    }, { status: 201 });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return errorResponse(badRequest(err.errors[0]?.message ?? 'Invalid request'));
    }
    return errorResponse(err);
  }
}

async function simulateNotificationDelivery(channel: string, webhookUrl: string, input: any): Promise<void> {
  if (channel === 'webhook' && webhookUrl) {
    try {
      await fetch(webhookUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type: input.type, subject: input.subject, message: input.message }) });
    } catch (e) {
      throw new Error('Failed to deliver webhook notification');
    }
  }
}

import { desc } from 'drizzle-orm';
