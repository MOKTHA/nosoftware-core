/**
 * /api/invitations — organization member invitation API (Phase 1.8 — Task 23).
 *
 * Invitation lifecycle:
 *   1. POST /api/invitations — create a pending invitation for an email.
 *      Auth-gated, requires `org:manage-members` permission (only `owner`
 *      role has this by default). Produces an `invitations` row with a
 *      URL-safe token and returns the accept URL that should be delivered
 *      to the invitee out-of-band (email delivery is deferred; this slice
 *      surfaces the token in the response so tests/manual flows work).
 *
 *   2. GET /api/invitations/accept?token=... — exchanges the token for
 *      membership. No auth required (the invitee has no active account
 *      yet — chicken-and-egg). On success: the invitation transitions
 *      to 'accepted', the invitee's user row (if status='invited')
 *      transitions to 'active', and a role_assignment is granted.
 *      Implemented in ./accept/route.ts (Next.js path).
 *
 * Gate ordering (POST):
 *   401 → 400 (body parse) → 403 (permission) → 201 / 400
 *
 * Design decisions:
 *   - A dedicated `invitations` table is used rather than `verification_tokens`
 *     because verification_tokens' 3-column Auth.js adapter shape provides
 *     no room for invitation metadata (organizationId, roleName, workspaceId,
 *     invitedBy). See docstring on packages/persistence/src/schema/invitations.ts.
 *   - The invite-creation side also upserts a `users` row with status='invited'
 *     so `invitations.invitedBy` can reference a concrete inviter user id.
 *   - Email delivery out of scope in Phase 1; the route returns the raw
 *     acceptUrl so callers (or a future email adapter) know what to send.
 */
import { NextRequest, NextResponse } from 'next/server';
import { randomBytes, randomUUID } from 'node:crypto';
import { eq, and } from 'drizzle-orm';

import { InviteUserInput, Invitation } from '@heynxt/core-types';
import { db, invitations, users } from '@heynxt/persistence';

import { badRequest, errorResponse, parseJsonBody } from '@/lib/api';
import { insertAuditEntry } from '@/lib/audit';
import { requireAuth } from '@/lib/session';
import { requirePermission } from '@/lib/rbac';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/** Default invitation lifetime. */
const DEFAULT_EXPIRES_IN_DAYS = 7;

/**
 * Build the acceptance URL for a given token. The base comes from
 * NEXT_PUBLIC_APP_URL when configured so previews / stage environments
 * can point the invitee at the right frontend. Falls back to the
 * request's own origin (works in development where both API and UI
 * share a host).
 */
function buildAcceptUrl(token: string, req: NextRequest): string {
  const base = process.env.NEXT_PUBLIC_APP_URL || req.nextUrl.origin;
  return `${base.replace(/\/$/, '')}/api/invitations/accept?token=${token}`;
}

/** Generate a URL-safe random token (32 bytes = 43 chars base64url). */
function generateToken(): string {
  return randomBytes(32).toString('base64url');
}

// ---------------------------------------------------------------------------
// POST /api/invitations — create a new invitation
// ---------------------------------------------------------------------------

export async function POST(req: NextRequest) {
  try {
    const session = await requireAuth();
    const actorId = session.user.id;

    const body = await parseJsonBody(req);
    const input = InviteUserInput.parse(body);

    // RBAC gate: invitations are organization-scoped, gated on
    // `org:manage-members` — only the `owner` role has this by default.
    await requirePermission({
      userId: actorId,
      organizationId: input.organizationId,
      permission: 'org:manage-members',
    });

    const normalizedEmail = input.email.trim().toLowerCase();
    const now = new Date();
    const expiresAt = new Date(
      now.getTime() + (input.expiresInDays ?? DEFAULT_EXPIRES_IN_DAYS) * 86_400_000,
    );

    // ---- Idempotency checks -------------------------------------------------
    // 1. If an active user already exists at this email, refuse. They are
    //    already a member — the caller should manage that account directly.
    const existingUser = await findUserByEmail(normalizedEmail);
    if (existingUser && existingUser.status === 'active') {
      return errorResponse(
        badRequest(
          'A user with this email already exists in the organization',
          'INVITEE_ALREADY_ACTIVE',
          { email: ['already an active user'] },
        ),
      );
    }

    // 2. If a pending invitation already exists for this email in this org,
    //    refuse. Idempotency is safer than stacking invites the owner can't
    //    track.
    const existingPending = await findPendingInvitation(
      normalizedEmail,
      input.organizationId,
    );
    if (existingPending) {
      return errorResponse(
        badRequest(
          'An invitation for this email is already pending in this organization',
          'INVITATION_ALREADY_PENDING',
          { email: ['invitation already pending'] },
        ),
      );
    }

    // ---- Create the invitee user row if absent ------------------------------
    // A `users` row must exist so `invitations.invitedBy` references a concrete
    // inviter id, and so the future role_assignment has a target user id.
    // Status defaults to 'invited' at the DB layer; we're explicit for clarity.
    let inviteeId: string;
    if (existingUser) {
      inviteeId = existingUser.id;
    } else {
      inviteeId = randomUUID();
      await db.insert(users).values({
        id: inviteeId,
        email: normalizedEmail,
        status: 'invited',
        createdAt: now,
        updatedAt: now,
      });
    }

    // ---- Create the invitation row ------------------------------------------
    const token = generateToken();
    const invitationId = randomUUID();

    const [created] = await db
      .insert(invitations)
      .values({
        id: invitationId,
        organizationId: input.organizationId,
        email: normalizedEmail,
        roleName: input.roleName,
        workspaceId: input.workspaceId ?? null,
        token,
        invitedBy: actorId,
        status: 'pending',
        expiresAt,
        acceptedAt: null,
        createdAt: now,
      })
      .returning();

    if (!created) throw new Error('INSERT returned zero rows');

    const invitation = Invitation.parse(created);
    const acceptUrl = buildAcceptUrl(token, req);

    // ---- Best-effort audit --------------------------------------------------
    await insertAuditEntry({
      organizationId: input.organizationId,
      entityType: 'invitation',
      entityId: invitation.id,
      action: 'created',
      actorId,
      after: {
        id: invitation.id,
        email: invitation.email,
        roleName: invitation.roleName,
        workspaceId: invitation.workspaceId,
        status: invitation.status,
        expiresAt: invitation.expiresAt.toISOString(),
      },
    });

    return NextResponse.json(
      { invitation, acceptUrl },
      { status: 201 },
    );
  } catch (err) {
    // FK violation: org or workspace id doesn't exist.
    if (
      err instanceof Error &&
      'code' in err &&
      (err as { code: string }).code === '23503'
    ) {
      return errorResponse(
        badRequest(
          'The referenced organization or workspace does not exist',
          'FOREIGN_KEY_VIOLATION',
        ),
      );
    }
    return errorResponse(err);
  }
}

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

async function findUserByEmail(
  email: string,
): Promise<typeof users.$inferSelect | null> {
  const rows = await db
    .select()
    .from(users)
    .where(eq(users.email, email))
    .limit(1);
  return rows[0] ?? null;
}

async function findPendingInvitation(
  email: string,
  organizationId: string,
): Promise<typeof invitations.$inferSelect | null> {
  const rows = await db
    .select()
    .from(invitations)
    .where(
      and(
        eq(invitations.email, email),
        eq(invitations.organizationId, organizationId),
        eq(invitations.status, 'pending'),
      ),
    )
    .limit(1);
  return rows[0] ?? null;
}
