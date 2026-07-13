/**
 * /api/kpis — KPI Aggregation API (Phase 8)
 */

import { NextRequest, NextResponse } from 'next/server';
import { eq, and, sql } from 'drizzle-orm';
import { z } from 'zod';

import { db, kpiSnapshots as ksTable } from '@heynxt/persistence';

import { badRequest, errorResponse } from '@/lib/api';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const KPIsQueryParams = z.object({
  definitionId: z.string().uuid().optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
});

export async function GET(req: NextRequest) {
  try {
    const params = KPIsQueryParams.parse({
      definitionId: req.nextUrl.searchParams.get('definitionId') ?? undefined,
      from: req.nextUrl.searchParams.get('from') ?? undefined,
      to: req.nextUrl.searchParams.get('to') ?? undefined,
    });

    const conditions: any[] = [];
    if (params.definitionId) {
      conditions.push(eq(ksTable.definitionId, params.definitionId));
    }
    if (params.from) {
      conditions.push(sql`${ksTable.timestamp} >= ${new Date(params.from).toISOString()}`);
    }
    if (params.to) {
      conditions.push(sql`${ksTable.timestamp} <= ${new Date(params.to).toISOString()}`);
    }

    const where = conditions.length > 0 ? and(...conditions) : undefined;
    const limit = Math.min(parseInt(req.nextUrl.searchParams.get('limit') ?? '100'), 1000);
    const offset = parseInt(req.nextUrl.searchParams.get('offset') ?? '0');

    const rows = await db.select({
      id: ksTable.id, definitionId: ksTable.definitionId, timestamp: ksTable.timestamp, value: ksTable.value, metadata: ksTable.metadata, createdAt: ksTable.createdAt,
    }).from(ksTable).where(where).orderBy(desc(ksTable.timestamp)).limit(limit).offset(offset);

    const countResult = await db.select({ count: sql`count(*) }).from(ksTable).where(where);

    return NextResponse.json({ kpis: rows, pagination: { total: parseInt(countResult[0]?.count ?? '0'), limit, offset } }, { status: 200 });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return errorResponse(badRequest(err.errors[0]?.message ?? 'Invalid request'));
    }
    return errorResponse(err);
  }
}

import { desc } from 'drizzle-orm';
