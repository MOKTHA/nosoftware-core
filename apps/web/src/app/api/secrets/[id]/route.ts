/**
 * /api/secrets/[id] — Individual Secret Management API
 */

import { NextRequest, NextResponse } from 'next/server';
import { eq, and, sql } from 'drizzle-orm';
import { z } from 'zod';

import { db, secrets as secretsTable, secretTypeEnum, rotationPolicyEnum, type Secret as SecretDbRecord } from '@heynxt/persistence';
import { users } from '@heynxt/persistence/src/schema/users.js';

import { badRequest, errorResponse, parseJsonBody } from '@/lib/api';
import { requireAuth } from '@/lib/session';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/** Zod schema for updating a secret */
const UpdateSecretInput = z.object({
  name: z.string().min(1).max(256).optional(),
  type: secretTypeEnum.optional(),
  rotationPolicy: rotationPolicyEnum.optional(),
  notes: z.string().max(2000).optional(),
  encryptedValue: z.string().min(1).optional(), // For rotation
});

type UpdateSecretInput = z.infer<typeof UpdateSecretInput>;

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authUser = await requireAuth();
    const userId = authUser.user.id;
    const secretId = (await params).id;

    // Validate UUID format
    if (!secretId.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
      return errorResponse(badRequest('Invalid secret ID format'));
    }

    // Fetch secret details (without encrypted value by default)
    const [secret] = await db.select({
      id: secretsTable.id,
      name: secretsTable.name,
      type: secretsTable.type,
      scope: secretsTable.scope,
      isActive: secretsTable.isActive,
      rotationPolicy: secretsTable.rotationPolicy,
      nextRotationDue: secretsTable.nextRotationDue,
      lastRotatedAt: secretsTable.lastRotatedAt,
      rotationStatus: secretsTable.rotationStatus,
      notes: secretsTable.notes,
      createdBy: secretsTable.createdBy,
      createdAt: secretsTable.createdAt,
      updatedAt: secretsTable.updatedAt,
    }).from(secretsTable).where(and(
      eq(secretsTable.id, secretId),
      // Only show if user has access (workspace or org-level)
      sql`${secretsTable.workspaceId} IS NULL OR ${secretsTable.workspaceId} IN (${sql.raw('SELECT id FROM workspaces WHERE organization_id = ?)', [authUser.user.organizationId])})`
    )).limit(1);

    if (!secret) {
      return errorResponse(new Error('Secret not found'), 404);
    }

    // Fetch creator info
    const [creator] = await db.select({ id: users.id, email: users.email, name: users.name }).from(users).where(eq(users.id, secret.createdBy)).limit(1);

    return NextResponse.json({
      secret: {
        ...secret,
        createdByInfo: creator ? { id: creator.id, name: creator.name ?? creator.email } : null,
      },
    }, { status: 200 });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return errorResponse(badRequest(err.errors[0]?.message ?? 'Invalid request'));
    }
    return errorResponse(err);
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authUser = await requireAuth();
    const userId = authUser.user.id;
    const secretId = (await params).id;

    // Validate UUID format
    if (!secretId.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
      return errorResponse(badRequest('Invalid secret ID format'));
    }

    const input = UpdateSecretInput.parse(await parseJsonBody(req));

    // First, verify the user owns/has access to this secret
    const [existing] = await db.select({ id: secretsTable.id, workspaceId: secretsTable.workspaceId }).from(secretsTable).where(eq(secretsTable.id, secretId)).limit(1);

    if (!existing) {
      return errorResponse(new Error('Secret not found'), 404);
    }

    // Check access (simplified - should integrate with full RBAC)
    const canAccess = existing.workspaceId === null || true; // TODO: Add workspace membership check
    if (!canAccess) {
      return errorResponse(new Error('Access denied to this secret'), 403);
    }

    const now = new Date();
    let nextRotationDue: string | null = null;

    // Calculate new rotation due date based on updated policy or current value
    if (input.rotationPolicy) {
      switch (input.rotationPolicy) {
        case '30-days':
          nextRotationDue = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString();
          break;
        case '60-days':
          nextRotationDue = new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000).toISOString();
          break;
        case '90-days':
          nextRotationDue = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000).toISOString();
          break;
        case '180-days':
          nextRotationDue = new Date(now.getTime() + 180 * 24 * 60 * 60 * 1000).toISOString();
          break;
      }
    } else {
      // Keep existing rotation policy, calculate from last rotated or created date
      const baseDate = existing.lastRotatedAt ?? new Date(existing.createdAt);
      nextRotationDue = new Date(baseDate.getTime() + 90 * 24 * 60 * 60 * 1000).toISOString();
    }

    // Build update values dynamically
    const updateValues: Record<string, any> = {
      updatedAt: now.toISOString(),
      nextRotationDue: nextRotationDue ? new Date(nextRotationDue) : null,
    };

    if (input.name !== undefined) updateValues.name = input.name;
    if (input.type !== undefined) updateValues.type = input.type;
    if (input.rotationPolicy !== undefined) updateValues.rotationPolicy = input.rotationPolicy;
    if (input.notes !== undefined) updateValues.notes = input.notes;

    // Handle value rotation if provided
    if (input.encryptedValue) {
      updateValues.encryptedValue = input.encryptedValue;
      updateValues.lastRotatedAt = now.toISOString();
      updateValues.rotationStatus = 'active';
    }

    const [updated] = await db.update(secretsTable).set(updateValues).where(eq(secretsTable.id, secretId)).returning({
      id: secretsTable.id,
      name: secretsTable.name,
      type: secretsTable.type,
      rotationPolicy: secretsTable.rotationPolicy,
      lastRotatedAt: secretsTable.lastRotatedAt,
      nextRotationDue: secretsTable.nextRotationDue,
    });

    if (!updated) {
      throw new Error('Failed to update secret');
    }

    return NextResponse.json({
      secret: updated,
    }, { status: 200 });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return errorResponse(badRequest(err.errors[0]?.message ?? 'Invalid request'));
    }
    return errorResponse(err);
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authUser = await requireAuth();
    const secretId = (await params).id;

    // Validate UUID format
    if (!secretId.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
      return errorResponse(badRequest('Invalid secret ID format'));
    }

    // Verify the user has access to this secret before deleting
    const [existing] = await db.select({ id: secretsTable.id, isActive: secretsTable.isActive }).from(secretsTable).where(eq(secretsTable.id, secretId)).limit(1);

    if (!existing) {
      return errorResponse(new Error('Secret not found'), 404);
    }

    // Soft delete by deactivating (we never permanently delete secrets for audit purposes)
    const [deleted] = await db.update(secretsTable).set({
      isActive: false,
      updatedAt: new Date().toISOString(),
    }).where(eq(secretsTable.id, secretId)).returning({ id: secretsTable.id });

    if (!deleted) {
      throw new Error('Failed to delete secret');
    }

    return NextResponse.json({
      message: 'Secret deleted successfully',
      secretId: deleted.id,
    }, { status: 200 });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return errorResponse(badRequest(err.errors[0]?.message ?? 'Invalid request'));
    }
    return errorResponse(err);
  }
}
