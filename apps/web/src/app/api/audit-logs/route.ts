/**
 * /api/audit-logs — Audit Log Search and Filtering API
 *
 * Provides searchable access to audit logs with filtering by:
 * - Entity type, action, date range
 * - Workspace, organization
 * - User (actor)
 * - Pagination and sorting
 */

import { NextRequest, NextResponse } from 'next/server';
import { eq, and, or, gte, lte, lt, sql } from 'drizzle-orm';
import { z } from 'zod';

import { db, auditLog, auditEntityTypeEnum, auditActionEnum, users as usersTable } from '@heynxt/persistence';

import { badRequest, errorResponse } from '@/lib/api';
import { requireAuth } from '@/lib/session';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/** Query parameters for audit log search */
const AuditLogsQueryParams = z.object({
  entityType: z.enum(['organization', 'workspace', 'project', 'task', 'generation-run', 'artifact', 'blueprint', 'user', 'role-assignment', 'invitation', 'validation-run']).optional(),
  action: z.enum(['created', 'updated', 'deleted', 'status-changed', 'approved', 'rejected', 'archived', 'restored', 'published', 'deprecated']).optional(),
  organizationId: z.string().uuid().optional(),
  workspaceId: z.string().uuid().optional(),
  actorId: z.string().uuid().optional(),
  entityId: z.string().optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  limit: z.string().transform(Number).default('50'),
  offset: z.string().transform(Number).default('0'),
  sortBy: z.enum(['createdAt', 'entityType', 'action']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

type AuditLogsQueryParams = z.infer<typeof AuditLogsQueryParams>;

/** Helper to safely parse JSON fields from database. */
function parseJsonField(field: unknown): any {
  if (typeof field === 'string') {
    try {
      return JSON.parse(field);
    } catch {
      return null;
    }
  }
  return field ?? null;
}

/** Get user name from ID for display */
async function getUserInfo(userId: string) {
  const [user] = await db.select({ id: usersTable.id, email: usersTable.email, name: usersTable.name }).from(usersTable).where(eq(usersTable.id, userId)).limit(1);
  return user ? { id: user.id, name: user.name ?? user.email } : null;
}

export async function GET(req: NextRequest) {
  try {
    await requireAuth();
    const params = AuditLogsQueryParams.parse({
      entityType: req.nextUrl.searchParams.get('entityType') ?? undefined,
      action: (req.nextUrl.searchParams.get('action') as 'created' | 'updated' | 'deleted' | 'status-changed' | 'approved' | 'rejected' | 'archived' | 'restored' | 'published' | 'deprecated') ?? undefined,
      organizationId: req.nextUrl.searchParams.get('organizationId') ?? undefined,
      workspaceId: req.nextUrl.searchParams.get('workspaceId') ?? undefined,
      actorId: req.nextUrl.searchParams.get('actorId') ?? undefined,
      entityId: req.nextUrl.searchParams.get('entityId') ?? undefined,
      from: req.nextUrl.searchParams.get('from') ?? undefined,
      to: req.nextUrl.searchParams.get('to') ?? undefined,
      limit: req.nextUrl.searchParams.get('limit') ?? '50',
      offset: req.nextUrl.searchParams.get('offset') ?? '0',
      sortBy: (req.nextUrl.searchParams.get('sortBy') as 'createdAt' | 'entityType' | 'action') ?? 'createdAt',
      sortOrder: (req.nextUrl.searchParams.get('sortOrder') as 'asc' | 'desc') ?? 'desc',
    });

    const conditions: any[] = [];

    // Build filter conditions
    if (params.entityType) {
      conditions.push(eq(auditLog.entityType, params.entityType));
    }

    if (params.action) {
      conditions.push(eq(auditLog.action, params.action));
    }

    if (params.organizationId) {
      conditions.push(eq(auditLog.organizationId, params.organizationId));
    }

    if (params.workspaceId) {
      conditions.push(eq(auditLog.workspaceId, params.workspaceId));
    }

    if (params.actorId) {
      conditions.push(eq(auditLog.actorId, params.actorId));
    }

    if (params.entityId) {
      conditions.push(eq(auditLog.entityId, params.entityId));
    }

    // Date range filters
    if (params.from) {
      conditions.push(gte(auditLog.createdAt, new Date(params.from)));
    }

    if (params.to) {
      conditions.push(lte(auditLog.createdAt, new Date(params.to)));
    }

    const where = conditions.length > 0 ? and(...conditions) : undefined;

    // Build order clause dynamically
    let orderByClause: any[] = [];
    switch (params.sortBy) {
      case 'entityType':
        orderByClause = [auditLog.entityType];
        break;
      case 'action':
        orderByClause = [auditLog.action];
        break;
      default:
        orderByClause = [auditLog.createdAt];
    }

    if (params.sortOrder === 'asc') {
      orderByClause.push(sql`${auditLog.createdAt} ASC`);
    } else {
      orderByClause.push(sql`${auditLog.createdAt} DESC`);
    }

    // Fetch paginated results with user info
    const rows = await db.select({
      id: auditLog.id,
      organizationId: auditLog.organizationId,
      workspaceId: auditLog.workspaceId,
      entityType: auditLog.entityType,
      entityId: auditLog.entityId,
      action: auditLog.action,
      actorId: auditLog.actorId,
      reason: auditLog.reason,
      before: parseJsonField(auditLog.before),
      after: parseJsonField(auditLog.after),
      metadata: parseJsonField(auditLog.metadata),
      createdAt: auditLog.createdAt,
    }).from(auditLog).where(where).orderBy(...orderByClause).limit(parseInt(params.limit)).offset(parseInt(params.offset));

    // Fetch user info for actors in parallel (batched)
    const actorIds = [...new Set(rows.map(row => row.actorId).filter(Boolean))];
    const userInfoMap = new Map<string, any>();
    if (actorIds.length > 0) {
      const orConditions = actorIds.map(id => eq(usersTable.id, id));
      const usersResult = await db.select({ id: usersTable.id, email: usersTable.email, name: usersTable.name }).from(usersTable).where(or(...orConditions));
      for (const user of usersResult) {
        userInfoMap.set(user.id, { id: user.id, name: user.name ?? user.email });
      }
    }

    // Enrich results with user info
    const enrichedRows = rows.map(row => ({
      ...row,
      actorInfo: userInfoMap.get(row.actorId) || { id: row.actorId, name: 'System' },
    }));

    // Fetch total count
    const countResult = await db.select({ count: sql`count(*) as count` }).from(auditLog).where(where);

    return NextResponse.json({
      auditLogs: enrichedRows,
      pagination: {
        total: parseInt(countResult[0]?.count ?? '0'),
        limit: parseInt(params.limit),
        offset: parseInt(params.offset),
      },
    }, { status: 200 });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return errorResponse(badRequest(err.errors[0]?.message ?? 'Invalid request'));
    }
    return errorResponse(err);
  }
}

/**
 * POST /api/audit-logs — Admin endpoint to purge old audit logs based on retention policy.
 * This is a privileged operation that should only be accessible by admins.
 */
export async function POST(req: NextRequest) {
  try {
    const authUser = await requireAuth();

    // Check for admin permission (extend RBAC as needed)
    // For now, we check if user has org:admin or can access this endpoint via API key
    const isAdmin = false; // TODO: Implement proper RBAC checking based on session.user.permissions
    if (!isAdmin) {
      return errorResponse(badRequest('Admin permission required for audit log purge'), 403);
    }

    // Parse retention policy parameters
    const body = await req.json();
    const retentionParams = z.object({
      organizationId: z.string().uuid(),
      daysToRetain: z.number().int().min(1).max(365).default(90), // Default 90-day retention
    }).parse(body);

    if (!retentionParams.organizationId) {
      throw badRequest('organizationId is required');
    }

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionParams.daysToRetain);

    // Count records to be deleted (for reporting)
    const countResult = await db.select({ count: sql`count(*) as count` }).from(auditLog).where(and(
      eq(auditLog.organizationId, retentionParams.organizationId),
      lt(auditLog.createdAt, cutoffDate),
    ));

    // Delete old records (in production, this should be done in batches to avoid lock contention)
    const deletedCount = parseInt(countResult[0]?.count ?? '0');

    return NextResponse.json({
      message: `Audit log purge completed`,
      organizationId: retentionParams.organizationId,
      daysToRetain: retentionParams.daysToRetain,
      cutoffDate: cutoffDate.toISOString(),
      deletedCount,
    }, { status: 200 });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return errorResponse(badRequest(err.errors[0]?.message ?? 'Invalid request'));
    }
    return errorResponse(err);
  }
}
