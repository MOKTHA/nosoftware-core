/**
 * /api/kpis — KPI Aggregation API (Phase 8)
 */

import { NextRequest, NextResponse } from 'next/server';
import { eq, and, sql, desc } from 'drizzle-orm';
import { z } from 'zod';

import { db, kpiSnapshots as ksTable, kpiDefinitions as kdTable } from '@heynxt/persistence';

import { badRequest, errorResponse } from '@/lib/api';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const KPIsQueryParams = z.object({
  kpiType: z.enum(['oee', 'throughput', 'quality', 'downtime']).optional(),
  lineId: z.string().optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
});

export async function GET(req: NextRequest) {
  try {
    const params = KPIsQueryParams.parse({
      kpiType: req.nextUrl.searchParams.get('kpiType') ?? undefined,
      lineId: req.nextUrl.searchParams.get('lineId') ?? undefined,
      from: req.nextUrl.searchParams.get('from') ?? undefined,
      to: req.nextUrl.searchParams.get('to') ?? undefined,
    });

    const conditions: any[] = [];

    if (params.kpiType) {
      conditions.push(eq(ksTable.kpiType, params.kpiType));
    }

    if (params.lineId) {
      conditions.push(eq(ksTable.lineId, params.lineId));
    }

    if (params.from) {
      conditions.push(sql`${ksTable.periodStart} >= ${new Date(params.from).toISOString()}`);
    }

    if (params.to) {
      conditions.push(sql`${ksTable.periodEnd} <= ${new Date(params.to).toISOString()}`);
    }

    const where = conditions.length > 0 ? and(...conditions) : undefined;
    const limit = Math.min(parseInt(req.nextUrl.searchParams.get('limit') ?? '100'), 1000);
    const offset = parseInt(req.nextUrl.searchParams.get('offset') ?? '0');

    const rows = await db.select({
      id: ksTable.id,
      kpiType: ksTable.kpiType,
      lineId: ksTable.lineId,
      periodStart: ksTable.periodStart,
      periodEnd: ksTable.periodEnd,
      availability: ksTable.availability,
      performance: ksTable.performance,
      quality: ksTable.quality,
      oeeScore: ksTable.oeeScore,
      metrics: ksTable.metrics,
      createdAt: ksTable.createdAt,
    }).from(ksTable).where(where).orderBy(desc(ksTable.periodStart)).limit(limit).offset(offset);

    const countResult = await db.select({ count: sql`count(*) as count` }).from(ksTable).where(where);

    return NextResponse.json({ kpis: rows, pagination: { total: Number(countResult[0]?.count ?? '0'), limit, offset } });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return errorResponse(badRequest(err.errors[0]?.message ?? 'Invalid request'));
    }
    return errorResponse(err);
  }
}
