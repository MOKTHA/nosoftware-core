/**
 * POST /api/auth/admin-login — Credentials-based admin login.
 *
 * Verifies email + password, creates a session in the sessions table
 * (same table Auth.js uses), and sets the session cookie so that
 * subsequent `auth()` / `getSession()` calls work normally.
 *
 * This avoids the complexity of Auth.js Credentials provider + database
 * sessions, while sharing the same session infrastructure.
 *
 * Body: { email: string, password: string }
 * Response: { user: { id, email, name, role }, mustChangePassword: boolean }
 */
import { eq } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import { cookies } from 'next/headers';

import { db, users, sessions } from '@heynxt/persistence';
import { verifyPassword } from '@/lib/password';

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { email?: string; password?: string };

    const email = body.email?.trim();
    const password = body.password;

    if (!email || !password) {
      return Response.json({ error: 'Email and password are required' }, { status: 400 });
    }

    // Find user by email
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.email, email));

    if (!user || !user.passwordHash) {
      return Response.json({ error: 'Invalid email or password' }, { status: 401 });
    }

    // Verify password
    const valid = await verifyPassword(password, user.passwordHash);
    if (!valid) {
      return Response.json({ error: 'Invalid email or password' }, { status: 401 });
    }

    // Create session
    const sessionToken = randomUUID();
    const expires = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days

    await db.insert(sessions).values({
      sessionToken,
      userId: user.id,
      expires,
    });

    // Set session cookie (same name Auth.js uses)
    const cookieName = process.env.NODE_ENV === 'production'
      ? '__Secure-authjs.session-token'
      : 'authjs.session-token';

    const cookieStore = await cookies();
    cookieStore.set(cookieName, sessionToken, {
      expires,
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
    });

    return Response.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
      mustChangePassword: user.mustChangePassword,
    });
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : 'Login failed' },
      { status: 500 },
    );
  }
}
