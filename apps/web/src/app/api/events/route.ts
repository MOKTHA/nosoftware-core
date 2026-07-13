/**
 * /api/events — Runtime Events Ingestion API (Phase 8)
 */

import { NextRequest, NextResponse } from 'next/server';
import { eq, and, sql, desc } from 'drizzle-orm';
import { z } from 'zod';

import { db, runtimeEvents as reTable, eventProcessingLog } from '@heynxt/persistence';

import { badRequest, errorResponse, parseJsonBody } from '@/lib/api';
import { requireAuth } from '@/lib/session';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const RuntimeEventSchema = z.object({
  eventId: z.string().min(1),
  source: z.enum(['plc', 'barcode_scanner', 'manual_entry', 'external_api', 'sensor', 'system']).optional(),
  priority: z.enum(['low', 'normal', 'high', 'critical']).default('normal'),
  eventType: z.string().min(1),
  data: z.record(z.unknown()),
  timestamp: z.date().optional(),
});

const BulkEventsInput = z.object({ events: z.array(RuntimeEventSchema).max(1000) });

const EventsQueryParams = z.object({
  eventType: z.string().optional(),
  source: z.enum(['plc', 'barcode_scanner', 'manual_entry', 'external_api', 'sensor', 'system']).optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
});

export async function GET(req: NextRequest) {
  try {
    await requireAuth();
    const params = EventsQueryParams.parse({
      eventType: req.nextUrl.searchParams.get('eventType') ?? undefined,
      source: (req.nextUrl.searchParams.get('source') as 'plc' | 'barcode_scanner' | 'manual_entry' | 'external_api' | 'sensor' | 'system') ?? undefined,
      from: req.nextUrl.searchParams.get('from') ?? undefined,
      to: req.nextUrl.searchParams.get('to') ?? undefined,
    });

    const conditions: any[] = [];
    if (params.eventType) {
      conditions.push(eq(reTable.eventType, params.eventType));
    }
    if (params.source) {
      conditions.push(eq(reTable.source, params.source));
    }
    if (params.from) {
      conditions.push(sql`${reTable.timestamp} >= ${new Date(params.from).toISOString()}`);
    }
    if (params.to) {
      conditions.push(sql`${reTable.timestamp} <= ${new Date(params.to).toISOString()}`);
    }

    const where = conditions.length > 0 ? and(...conditions) : undefined;
    const limit = Math.min(parseInt(req.nextUrl.searchParams.get('limit') ?? '100'), 1000);
    const offset = parseInt(req.nextUrl.searchParams.get('offset') ?? '0');

    const rows = await db.select({
      id: reTable.id,
      eventId: reTable.eventId,
      source: reTable.source,
      priority: reTable.priority,
      eventType: reTable.eventType,
      timestamp: reTable.timestamp,
      receivedAt: reTable.receivedAt,
      data: reTable.data,
    }).from(reTable).where(where).orderBy(desc(reTable.timestamp)).limit(limit).offset(offset);

    const countResult = await db.select({ count: sql`count(*) as count` }).from(reTable).where(where);

    return NextResponse.json({ events: rows, pagination: { total: Number(countResult[0]?.count ?? '0'), limit, offset } });
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
    const input = BulkEventsInput.parse(await parseJsonBody(req));

    if (input.events.length === 0) throw badRequest('At least one event must be provided');

    const now = new Date();
    let acceptedCount = 0;
    let rejectedCount = 0;
    const errors: Array<{ eventType?: string; error: string }> = [];

    await db.transaction(async (tx) => {
      for (const eventInput of input.events) {
        try {
          const validatedEvent = RuntimeEventSchema.parse(eventInput);
          const [inserted] = await tx.insert(reTable).values({
            id: crypto.randomUUID(),
            eventId: String(validatedEvent.eventId),
            source: validatedEvent.source ?? 'system',
            priority: validatedEvent.priority,
            eventType: validatedEvent.eventType,
            data: validatedEvent.data,
            timestamp: validatedEvent.timestamp ?? now,
          }).returning();

          if (inserted) {
            acceptedCount++;
          } else {
            rejectedCount++;
            errors.push({ eventType: validatedEvent.eventType, error: 'Insert returned no rows' });
          }
        } catch (eventErr) {
          rejectedCount++;
          const errorMessage = eventErr instanceof z.ZodError ? eventErr.errors.map(e => e.message).join(', ') : String(eventErr);
          errors.push({ eventType: eventInput.eventType, error: errorMessage });
        }
      }
    });

    return NextResponse.json({ result: { acceptedCount, rejectedCount, totalProcessed: input.events.length, errors } }, { status: 201 });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return errorResponse(badRequest(err.errors[0]?.message ?? 'Invalid request'));
    }
    return errorResponse(err);
  }
}
