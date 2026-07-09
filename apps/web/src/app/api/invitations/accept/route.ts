/**
 * /api/invitations/accept — exchanges a token for membership (Phase 1.8).
 *
 *   GET /api/invitations/accept?token=<token>
 *     Exchanges a valid invitation token for:
 *       1. The `invitations` row transitioning to status='accepted'.
 *       2. The invitee's `users` row (if status='invited') transitioning
 *          to status='active'.
 *       3. A `role_assignments` row granting the invitation's roleName
 *          to the invitee in the invitation's organization (optionally
 *          scoped to a specific workspace).
 *
 *     No auth is required on this endpoint — the invitee does not yet
 *     have an active account when they click the link. Security comes
 *     from the URL-safe random token (32 bytes, crypto.randomBytes).
 *
 *     Response shape:
 *       200 { accepted: { invitation, user, roleAssignment } }
 *         — all three objects included so the UI can prompt the user
 *           to sign in (the user is activated but has no Auth.js account;
 *           signing in via GitHub with the invited email will link).
 *
 *     Failure shapes:
 *       400 TOKEN_REQUIRED          — missing `token` query parameter
 *       404 INVITATION_NOT_FOUND    — no pending invitation for this token
 *       400 INVITATION_ALREADY_ACCEPTED — already accepted
 *       400 INVITATION_REVOKED      — revoked by an admin
 *       410 INVITATION_EXPIRED      — expiresAt has passed
 *
 * Design:
 *   Runs inside `db.transaction(...)` so the three state transitions
 *   all succeed together or none apply. If the transaction throws the
 *   route surfaces a 500; the DB rolls back.
 *
 *   The `role_assignments` unique constraint on
 *   (userId, organizationId, workspaceId, roleName) already prevents
 *   duplicate grants. If the invitee already holds the role (edge case
 *   — e.g. admin accepted the invitation twice via the token), the
 *   constraint surfaces as Postgres 23505 and the transaction rolls
 *   back; the route returns 409 ROLE_ALREADY_GRANTED.
 */
import { NextRequest, NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';

import { RoleAssignment, User } from '@heynxt/core-types';
import { db, invitations, roleAssignments, users } from '@heynxt/persistence';

import { badRequest, errorResponse, notFound } from '@/lib/api';
import { insertAuditEntry, insertStatusChangeEntry } from '@/lib/audit';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// ---------------------------------------------------------------------------
// GET /api/invitations/accept?token=...
// ---------------------------------------------------------------------------

export async function GET(req: NextRequest) {
  try {
    const token = req.nextUrl.searchParams.get('token');
    if (!token) {
      return errorResponse(
        badRequest('Missing `token` query parameter', 'TOKEN_REQUIRED'),
      );
    }

    // Look up the invitation by token — must be single row because the
    // `token` column has a unique index.
    const [invitation] = await db
      .select()
      .from(invitations)
      .where(eq(invitations.token, token))
      .limit(1);

    if (!invitation) {
      return errorResponse(notFound('Invitation not found', 'INVITATION_NOT_FOUND'));
    }

    // Gate on status before expiry check — expired check only applies to
    // still-pending invitations, because accepted/revoked rows retain
    // their historical expiresAt for audit.
    if (invitation.status === 'accepted') {
      return errorResponse(
        badRequest(
          'This invitation has already been accepted',
          'INVITATION_ALREADY_ACCEPTED',
        ),
      );
    }
    if (invitation.status === 'revoked') {
      return errorResponse(
        badRequest(
          'This invitation was revoked by an administrator',
          'INVITATION_REVOKED',
        ),
      );
    }
    if (invitation.status !== 'pending') {
      // Defensive: covers 'expired' or any future state.
      return errorResponse(
        badRequest(
          `Invitation is not pending (current status: ${invitation.status})`,
          'INVITATION_NOT_ACCEPTABLE',
        ),
      );
    }

    const now = new Date();
    if (invitation.expiresAt < now) {
      // Mark the row as expired so a subsequent GET returns a cleaner
      // error rather than re-reading the stale timestamp. Best-effort
      // (not wrapped in the transaction); a stale-read is not the end
      // of the world.
      await db
        .update(invitations)
        .set({ status: 'expired', acceptedAt: null })
        .where(eq(invitations.id, invitation.id));
      return errorResponse(
        badRequest(
          'This invitation has expired',
          'INVITATION_EXPIRED',
        ),
      );
    }

    // Transaction boundary — all three transitions must succeed together.
    const result = await db.transaction(async (tx) => {
      // 1. Transition invitation: pending → accepted.
      const [updatedInv] = await tx
        .update(invitations)
        .set({ status: 'accepted', acceptedAt: now })
        .where(eq(invitations.id, invitation.id))
        .returning();
      if (!updatedInv) {
        throw new Error('Failed to update invitation row');
      }

      // 2. Locate the invitee user row (must exist — the POST route
      //    created it with status='invited' when the user was new).
      const [invitee] = await tx
        .select()
        .from(users)
        .where(eq(users.email, invitation.email))
        .limit(1);
      if (!invitee) {
        throw new Error(
          `Invitee user row missing for email ${invitation.email}`,
        );
      }

      // 3. If the invitee's status is still 'invited', flip to 'active'.
      let userAfter = invitee;
      if (invitee.status === 'invited') {
        const [updatedUser] = await tx
          .update(users)
          .set({ status: 'active', updatedAt: now })
          .where(eq(users.id, invitee.id))
          .returning();
        if (!updatedUser) {
          throw new Error('Failed to update user row');
        }
        userAfter = updatedUser;
      } else {
        // If the user was already active (e.g. they joined via OAuth
        // before clicking the invite link), leave status unchanged and
        // skip the status-change audit below.
      }

      // 4. Grant the role assignment.
      //    The unique constraint on (userId, orgId, workspaceId, roleName)
      //    will 23505 if the grant already exists; the outer catch maps
      //    that to ROLE_ALREADY_GRANTED.
      const grantedAt = now;
      await tx.insert(roleAssignments).values({
        userId: invitee.id,
        organizationId: invitation.organizationId,
        workspaceId: invitation.workspaceId,
        roleName: invitation.roleName,
        grantedAt,
        grantedBy: invitation.invitedBy,
      });

      return { updatedInv, userAfter, invitee, grantedAt };
    });

    // ---- Post-transaction audit (best-effort, outside the TX) -------------
    // Invitation status change.
    await insertStatusChangeEntry({
      organizationId: invitation.organizationId,
      entityType: 'invitation',
      entityId: invitation.id,
      actorId: invitation.invitedBy,
      previousStatus: 'pending',
      newStatus: 'accepted',
    });

    // User status change (only when invitee was in 'invited' state).
    if (result.invitee.status === 'invited') {
      await insertStatusChangeEntry({
        organizationId: invitation.organizationId,
        entityType: 'user',
        entityId: result.invitee.id,
        actorId: invitation.invitedBy,
        previousStatus: 'invited',
        newStatus: 'active',
      });
    }

    // Role assignment creation.
    const roleAssignmentRow: RoleAssignment = {
      userId: result.invitee.id,
      organizationId: invitation.organizationId,
      workspaceId: invitation.workspaceId,
      roleName: invitation.roleName,
      grantedAt: result.grantedAt,
      grantedBy: invitation.invitedBy,
    };
    await insertAuditEntry({
      organizationId: invitation.organizationId,
      entityType: 'role-assignment',
      entityId: `${result.invitee.id}:${invitation.organizationId}:${invitation.workspaceId ?? 'null'}:${invitation.roleName}`,
      action: 'created',
      actorId: invitation.invitedBy,
      after: {
        userId: roleAssignmentRow.userId,
        organizationId: roleAssignmentRow.organizationId,
        workspaceId: roleAssignmentRow.workspaceId,
        roleName: roleAssignmentRow.roleName,
        grantedAt: roleAssignmentRow.grantedAt.toISOString(),
        grantedBy: roleAssignmentRow.grantedBy,
      },
    });

    return NextResponse.json(
      {
        accepted: {
          invitation: result.updatedInv,
          user: User.parse(result.userAfter),
          roleAssignment: roleAssignmentRow,
        },
      },
      { status: 200 },
    );
  } catch (err) {
    // Unique-constraint violation in role_assignments: the invitee already
    // has this role in this scope. The invitation was transitioned to
    // 'accepted' in the TX (now rolled back by throw), but if it wasn't
    // caught here we'd surface a 500 for a known business case.
    if (
      err instanceof Error &&
      'code' in err &&
      (err as { code: string }).code === '23505'
    ) {
      return errorResponse(
        badRequest(
          'The invitee already holds this role in the given scope',
          'ROLE_ALREADY_GRANTED',
        ),
      );
    }
    return errorResponse(err);
  }
}
