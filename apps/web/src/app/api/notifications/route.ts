/**
 * /api/notifications — Notification Service API (Phase 8)
 */

import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';
import { eq, and, sql, desc } from 'drizzle-orm';
import { z } from 'zod';

import { db, notifications as notifTable, notificationDeliveryAttempts as ndaTable } from '@heynxt/persistence';

import { badRequest, errorResponse, parseJsonBody } from '@/lib/api';
import { requireAuth } from '@/lib/session';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const SendNotificationInput = z.object({
  title: z.string().min(1).max(200),
  body: z.string().min(1),
  priority: z.enum(['low', 'normal', 'high', 'urgent']).default('normal'),
  channel: z.enum(['email', 'slack', 'webhook', 'inApp']),
  config: z.record(z.unknown()),
});

const NotificationsQueryParams = z.object({
  status: z.enum(['pending', 'sending', 'sent', 'failed', 'expired']).optional(),
  limit: z.string().transform(Number).default('100'),
});

export async function GET(req: NextRequest) {
  try {
    await requireAuth();
    const params = NotificationsQueryParams.parse({
      status: req.nextUrl.searchParams.get('status') as 'pending' | 'sending' | 'sent' | 'failed' | 'expired' ?? undefined,
      limit: req.nextUrl.searchParams.get('limit') ?? '100',
    });

    const conditions: any[] = [];

    if (params.status) {
      conditions.push(eq(notifTable.status, params.status));
    }

    const where = and(...conditions);
    const limit = Math.min(params.limit, 1000);
    const offset = parseInt(req.nextUrl.searchParams.get('offset') ?? '0');

    const rows = await db.select({
      id: notifTable.id,
      title: notifTable.title,
      body: notifTable.body,
      priority: notifTable.priority,
      channel: notifTable.channel,
      status: notifTable.status,
      config: notifTable.config,
      createdAt: notifTable.createdAt,
    }).from(notifTable).where(where).orderBy(desc(notifTable.createdAt)).limit(limit).offset(offset);

    const countResult = await db.select({ count: sql`count(*) as count` }).from(notifTable).where(where);

    return NextResponse.json({ notifications: rows, pagination: { total: Number(countResult[0]?.count ?? '0'), limit, offset } });
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
    const input = SendNotificationInput.parse(await parseJsonBody(req));

    if (!input.config || typeof input.config !== 'object') {
      throw badRequest('Channel-specific config is required');
    }

    const now = new Date();
    const notificationId = randomUUID();

    // Simulate delivery - in production, integrate with actual email/slack/webhook services
    await simulateNotificationDelivery(input.channel, input.config, input.title, input.body);

    return NextResponse.json({
      notification: { id: notificationId, title: input.title, channel: input.channel, status: 'sent', createdAt: now },
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return errorResponse(badRequest(err.errors[0]?.message ?? 'Invalid request'));
    }
    return errorResponse(err);
  }
}

async function simulateNotificationDelivery(channel: string, config: any, title?: string, body?: string): Promise<void> {
  if (channel === 'webhook' && config?.url) {
    try {
      await fetch(config.url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title: title ?? '', body: body ?? '' }) });
    } catch (e) {
      throw new Error('Failed to deliver webhook notification');
    }
  }
}
