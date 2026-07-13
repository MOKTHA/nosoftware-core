/**
 * /api/secrets — Secrets Management API
 *
 * Provides secure storage and retrieval of sensitive credentials:
 *   GET    /api/secrets         - List all secrets with metadata (never returns encrypted values)
 *   POST   /api/secrets         - Create a new secret (encrypted value in request body)
 *   GET    /api/secrets/:id     - Get secret details and optionally decrypt value
 *   PUT    /api/secrets/:id     - Update secret metadata or rotate value
 *   DELETE /api/secrets/:id     - Delete a secret
 */

import { NextRequest, NextResponse } from 'next/server';
import { eq, and, or, gte, sql } from 'drizzle-orm';
import { z } from 'zod';

import { db, secrets, secretTypeEnum, rotationPolicyEnum, secretScopeEnum, users } from '@heynxt/persistence';

import { badRequest, errorResponse, parseJsonBody } from '@/lib/api';
import { requireAuth } from '@/lib/session';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/** Zod schema for creating a secret */
const CreateSecretInput = z.object({
  name: z.string().min(1).max(256),
  type: z.enum(['api-key', 'database-credential', 'webhook-secret', 'oauth-credential', 'encryption-key', 'custom']).optional(),
  scope: z.enum(['workspace', 'organization']).default('workspace'),
  workspaceId: z.string().uuid().optional(),
  organizationId: z.string().uuid(), // Required for org-level scoping
  encryptedValue: z.string().min(1), // Base64 encoded, already encrypted client-side or by KMS
  encryptionMetadata: z.record(z.unknown()).optional(),
  rotationPolicy: z.enum(['never', '30-days', '60-days', '90-days', '180-days', 'custom']).optional(),
  notes: z.string().max(2000).optional(),
});

type CreateSecretInput = z.infer<typeof CreateSecretInput>;

/** Zod schema for updating a secret */
const UpdateSecretInput = z.object({
  name: z.string().min(1).max(256).optional(),
  type: z.enum(['api-key', 'database-credential', 'webhook-secret', 'oauth-credential', 'encryption-key', 'custom']).optional(),
  rotationPolicy: z.enum(['never', '30-days', '60-days', '90-days', '180-days', 'custom']).optional(),
  notes: z.string().max(2000).optional(),
  encryptedValue: z.string().min(1).optional(), // For rotation
});

type UpdateSecretInput = z.infer<typeof UpdateSecretInput>;

/** Query parameters for listing secrets */
const SecretsQueryParams = z.object({
  type: z.enum(['api-key', 'database-credential', 'webhook-secret', 'oauth-credential', 'encryption-key', 'custom']).optional(),
  scope: z.enum(['workspace', 'organization']).optional(),
  workspaceId: z.string().uuid().optional(),
  isActive: z.boolean().optional(),
  limit: z.string().transform(Number).default('50'),
  offset: z.string().transform(Number).default('0'),
});

type SecretsQueryParams = z.infer<typeof SecretsQueryParams>;

/** Helper to check if user has permission for a secret */
async function canAccessSecret(userId: string, workspaceId: string | null): Promise<boolean> {
  // This should integrate with the RBAC system more thoroughly
  // For now, we assume authenticated users can access their own workspaces' secrets
  return true;
}

/** Helper to check if user has permission for organization-level operations */
async function canManageOrganizationSecrets(): Promise<boolean> {
  const authUser = await requireAuth();
  // For now, allow all authenticated users (extend with RBAC later)
  return true;
}

export async function GET(req: NextRequest) {
  try {
    const authUser = await requireAuth();
    const userId = authUser.user.id;

    const params = SecretsQueryParams.parse({
      type: req.nextUrl.searchParams.get('type') ?? undefined,
      scope: (req.nextUrl.searchParams.get('scope') as 'workspace' | 'organization') ?? undefined,
      workspaceId: req.nextUrl.searchParams.get('workspaceId') ?? undefined,
      isActive: req.nextUrl.searchParams.get('isActive') === 'true',
      limit: req.nextUrl.searchParams.get('limit') ?? '50',
      offset: req.nextUrl.searchParams.get('offset') ?? '0',
    });

    const conditions: any[] = [];

    if (params.type) {
      conditions.push(sql`${secrets.type} = ${params.type}`);
    }

    if (params.scope) {
      conditions.push(sql`${secrets.scope} = ${params.scope}`);
    }

    if (params.workspaceId) {
      // For workspace-scoped secrets, we need to include org-wide ones too for convenience
      conditions.push(
        sql`(${secrets.workspaceId} = ${params.workspaceId} OR (${secrets.workspaceId} IS NULL AND ${secrets.scope} = 'organization'))`
      );
    }

    if (params.isActive !== undefined) {
      conditions.push(sql`${secrets.isActive} = ${params.isActive}`);
    }

    const where = conditions.length > 0 ? and(...conditions) : undefined;

    // Fetch secrets with metadata only (never encrypted value in list response)
    const rows = await db.select({
      id: secrets.id,
      name: secrets.name,
      type: secrets.type,
      scope: secrets.scope,
      isActive: secrets.isActive,
      rotationPolicy: secrets.rotationPolicy,
      nextRotationDue: secrets.nextRotationDue,
      rotationStatus: secrets.rotationStatus,
      notes: secrets.notes,
      createdBy: secrets.createdBy,
      createdAt: secrets.createdAt,
      updatedAt: secrets.updatedAt,
    }).from(secrets).where(where)
      .orderBy(sql`${secrets.createdAt} DESC`)
      .limit(params.limit)
      .offset(params.offset);

    // Fetch user info for creators in parallel (batched)
    const creatorIds = [...new Set(rows.map(row => row.createdBy).filter(Boolean))];
    const userInfoMap = new Map<string, any>();
    if (creatorIds.length > 0) {
      const orConditions = creatorIds.map(id => eq(users.id, id));
      const usersResult = await db.select({ id: users.id, email: users.email, name: users.name }).from(users).where(or(...orConditions));
      for (const user of usersResult) {
        userInfoMap.set(user.id, { id: user.id, name: user.name ?? user.email });
      }
    }

    // Enrich results with creator info
    const enrichedRows = rows.map(row => ({
      ...row,
      createdByInfo: userInfoMap.get(row.createdBy) || null,
    }));

    // Fetch total count
    const countResult = await db.select({ count: sql`count(*) as count` }).from(secrets).where(where);

    return NextResponse.json({
      secrets: enrichedRows,
      pagination: {
        total: parseInt(countResult[0]?.count ?? '0'),
        limit: params.limit,
        offset: params.offset,
      },
    }, { status: 200 });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return errorResponse(badRequest(err.errors[0]?.message ?? 'Invalid request'));
    }
    return errorResponse(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const authUser = await requireAuth();
    const userId = authUser.user.id;

    const input = CreateSecretInput.parse(await parseJsonBody(req));

    if (!input.encryptedValue || typeof input.encryptedValue !== 'string') {
      throw badRequest('Encrypted value is required');
    }

    // Calculate next rotation due date based on policy
    let nextRotationDue: Date | null = null;
    const now = new Date();

    switch (input.rotationPolicy ?? '90-days') {
      case '30-days':
        nextRotationDue = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
        break;
      case '60-days':
        nextRotationDue = new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000);
        break;
      case '90-days':
        nextRotationDue = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);
        break;
      case '180-days':
        nextRotationDue = new Date(now.getTime() + 180 * 24 * 60 * 60 * 1000);
        break;
      default:
        // No automatic rotation
        break;
    }

    const [created] = await db.insert(secrets).values({
      name: input.name,
      type: input.type ?? 'custom',
      scope: input.scope ?? 'workspace',
      workspaceId: input.workspaceId || null,
      organizationId: input.organizationId,
      encryptedValue: input.encryptedValue,
      encryptionMetadata: input.encryptionMetadata ?? {},
      rotationPolicy: input.rotationPolicy ?? '90-days' as any,
      nextRotationDue,
      isActive: true,
      createdBy: userId,
      createdAt: now,
      updatedAt: now,
    }).returning();

    if (!created) {
      throw new Error('Failed to create secret');
    }

    return NextResponse.json({
      secret: {
        id: created.id,
        name: created.name,
        type: created.type,
        scope: created.scope,
        isActive: true,
        rotationPolicy: created.rotationPolicy,
        nextRotationDue: created.nextRotationDue?.toISOString(),
        createdAt: created.createdAt.toISOString(),
      },
    }, { status: 201 });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return errorResponse(badRequest(err.errors[0]?.message ?? 'Invalid request'));
    }
    return errorResponse(err);
  }
}

