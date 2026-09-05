/**
 * POST /api/auth/change-password — Change admin password.
 *
 * Body: { currentPassword: string, newPassword: string }
 *
 * Called after first login when mustChangePassword is true,
 * or any time an admin wants to change their password.
 */
import { eq } from 'drizzle-orm';

import { db, users } from '@heynxt/persistence';
import { requireAuth } from '@/lib/session';
import { verifyPassword, hashPassword } from '@/lib/password';

export async function POST(req: Request) {
  try {
    const session = await requireAuth();

    const body = (await req.json()) as {
      currentPassword?: string;
      newPassword?: string;
    };

    if (!body.currentPassword || !body.newPassword) {
      return Response.json({ error: 'Both currentPassword and newPassword are required' }, { status: 400 });
    }

    if (body.newPassword.length < 8) {
      return Response.json({ error: 'New password must be at least 8 characters' }, { status: 400 });
    }

    // Get current user
    const [user] = await db
      .select({ passwordHash: users.passwordHash })
      .from(users)
      .where(eq(users.id, session.user.id));

    if (!user?.passwordHash) {
      return Response.json({ error: 'No password set for this account' }, { status: 400 });
    }

    // Verify current password
    const valid = await verifyPassword(body.currentPassword, user.passwordHash);
    if (!valid) {
      return Response.json({ error: 'Current password is incorrect' }, { status: 401 });
    }

    // Hash new password and update
    const newHash = await hashPassword(body.newPassword);

    await db
      .update(users)
      .set({
        passwordHash: newHash,
        mustChangePassword: false,
        updatedAt: new Date(),
      })
      .where(eq(users.id, session.user.id));

    return Response.json({ ok: true, message: 'Password changed successfully' });
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : 'Failed to change password' },
      { status: 500 },
    );
  }
}
