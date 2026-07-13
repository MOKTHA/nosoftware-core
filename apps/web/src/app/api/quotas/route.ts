/**
 * /api/quotas — Quotas and Usage Tracking API
 *
 * Provides quota management and usage tracking:
 *   GET    /api/quotas            - List all quotas with current usage
 *   POST   /api/quotas/:id/update - Manually update usage counter (admin)
 */

import { NextRequest, NextResponse } from 'next/server';
import { eq, and, sql, or as drizzleOr } from 'drizzle-orm';
import { z } from 'zod';

import { db, tenantQuotas, usageCounters, quotaTypeEnum, quotaStatusEnum } from '@heynxt/persistence';

import { badRequest, errorResponse, parseJsonBody } from '@/lib/api';
import { requireAuth } from '@/lib/session';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/** Query parameters for listing quotas */
const QuotasQueryParams = z.object({
  quotaType: quotaTypeEnum.optional(),
  workspaceId: z.string().uuid().optional(),
  isActive: z.boolean().optional(),
  limit: z.string().transform(Number).default('50'),
  offset: z.string().transform(Number).default('0'),
});

type QuotasQueryParams = z.infer<typeof QuotasQueryParams>;

/** Helper to calculate quota status based on usage */
function calculateQuotaStatus(currentValue: number, softLimit?: number, hardLimit: number = 1000): { status: 'active' | 'approaching' | 'exceeded'; percentage: number } {
  const percentage = Math.round((currentValue / hardLimit) * 100);

  if (hardLimit > 0 && currentValue >= hardLimit) {
    return { status: 'exceeded', percentage };
  }

  if (softLimit && currentValue >= softLimit) {
    return { status: 'approaching', percentage };
  }

  return { status: 'active', percentage };
}

export async function GET(req: NextRequest) {
  try {
    const authUser = await requireAuth();

    const params = QuotasQueryParams.parse({
      quotaType: req.nextUrl.searchParams.get('quotaType') ?? undefined,
      workspaceId: req.nextUrl.searchParams.get('workspaceId') ?? undefined,
      isActive: req.nextUrl.searchParams.get('isActive') === 'true',
      limit: req.nextUrl.searchParams.get('limit') ?? '50',
      offset: req.nextUrl.searchParams.get('offset') ?? '0',
    });

    const conditions: any[] = [];

    if (params.quotaType) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      conditions.push((tenantQuotas.quotaType as any) === params.quotaType);
    }

    if (params.workspaceId) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      conditions.push(eq(tenantQuotas.workspaceId, params.workspaceId));
    }

    if (params.isActive !== undefined && params.isActive !== null) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      conditions.push((tenantQuotas.isActive as any) === params.isActive);
    }

    const where = conditions.length > 0 ? and(...conditions) : undefined;

    // Fetch quotas with current usage counters
    const rows = await db.select({
      id: tenantQuotas.id,
      organizationId: tenantQuotas.organizationId,
      workspaceId: tenantQuotas.workspaceId,
      quotaType: tenantQuotas.quotaType,
      hardLimit: tenantQuotas.hardLimit,
      softLimit: tenantQuotas.softLimit,
      resetPeriod: tenantQuotas.resetPeriod,
      nextResetAt: tenantQuotas.nextResetAt,
      status: tenantQuotas.status,
    }).from(tenantQuotas).where(where)
      .orderBy(sql`${tenantQuotas.quotaType} DESC`)
      .limit(params.limit as number)
      .offset(params.offset as number);

    // Fetch current usage counters for each quota in parallel
    const quotaIds = rows.map(r => r.id);
    const countersMap = new Map<string, any>();

    if (quotaIds.length > 0) {
      const orConditions = quotaIds.map(id => drizzleOr(eq(usageCounters.quotaId, id)));
      const countersResult = await db.select({
        id: usageCounters.id,
        quotaId: usageCounters.quotaId,
        currentValue: usageCounters.currentValue,
        periodStartAt: usageCounters.periodStartAt,
        status: usageCounters.status,
      }).from(usageCounters).where(drizzleOr(...orConditions));

      for (const counter of countersResult) {
        const row = rows.find(r => r.id === counter.quotaId);
        const status = calculateQuotaStatus(counter.currentValue, undefined, row?.hardLimit ?? 1000);
        countersMap.set(counter.quotaId, { ...counter, quotaStatus: status.status, usagePercentage: status.percentage });
      }
    }

    // Enrich quotas with current usage
    const enrichedRows = rows.map(row => ({
      ...row,
      currentUsage: countersMap.get(row.id)?.currentValue ?? 0,
      usagePercentage: countersMap.get(row.id)?.usagePercentage ?? 0,
      quotaStatus: countersMap.get(row.id)?.quotaStatus ?? 'active',
    }));

    // Fetch total count
    const countResult = await db.select({ count: sql`count(*) as count` }).from(tenantQuotas).where(where);

    return NextResponse.json({
      quotas: enrichedRows,
      pagination: {
        total: Number(countResult[0]?.count ?? '0'),
        limit: params.limit as number,
        offset: params.offset as number,
      },
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return errorResponse(badRequest(err.errors[0]?.message ?? 'Invalid request'));
    }
    return errorResponse(err);
  }
}

/** Update usage counter endpoint */
export async function POST(req: NextRequest) {
  try {
    const authUser = await requireAuth();

    // Check for admin permission (extend RBAC as needed)
    const isAdmin = false; // TODO: Implement proper RBAC checking based on session.user.permissions
    if (!isAdmin) {
      return NextResponse.json({ error: 'Admin permission required' }, { status: 403 });
    }

    const body = await parseJsonBody(req);
    const updateParams = z.object({
      quotaId: z.string().uuid(),
      currentValue: z.number().int().min(0),
    }).parse(body);

    // Verify the quota exists and user has access
    const [quota] = await db.select({ id: tenantQuotas.id, organizationId: tenantQuotas.organizationId })
      .from(tenantQuotas)
      .where(eq(tenantQuotas.id, updateParams.quotaId))
      .limit(1);

    if (!quota) {
      return errorResponse(new Error('Quota not found'), 404);
    }

    // Update or insert usage counter (upsert pattern)
    const now = new Date();
    const [counter] = await db.insert(usageCounters).values({
      quotaId: updateParams.quotaId,
      currentValue: updateParams.currentValue,
      previousValue: 0,
      periodStartAt: now,
      periodEndAt: now,
      status: 'tracking',
      createdAt: now,
      updatedAt: now,
    }).onConflictDoUpdate({
      target: usageCounters.quotaId,
      set: {
        currentValue: updateParams.currentValue,
        previousValue: updateParams.currentValue,
        periodEndAt: now,
        updatedAt: now,
      },
    }).returning();

    if (!counter || !counter.id) {
      throw new Error('Failed to update usage counter');
    }

    return NextResponse.json({
      message: 'Usage counter updated successfully',
      quotaId: updateParams.quotaId,
      currentValue: (counter as any).currentValue,
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return errorResponse(badRequest(err.errors[0]?.message ?? 'Invalid request'));
    }
    return errorResponse(err);
  }
}
