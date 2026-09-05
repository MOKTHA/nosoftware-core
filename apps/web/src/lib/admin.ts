/**
 * Admin access helpers.
 *
 * Two-layer admin check:
 *   1. `ADMIN_GITHUB_IDS` env var — comma-separated GitHub account IDs
 *      that are always admins (for bootstrap)
 *   2. `role = 'admin'` in the users table (for DB-managed admin)
 *
 * The default admin account (admin@nosoftware.ai) has role='admin'
 * set directly in the DB.
 */
import { eq } from 'drizzle-orm';
import { db, users } from '@heynxt/persistence';
import { requireAuth, type AuthenticatedSession } from './session';

/**
 * Check if a user ID is an admin via the database role field.
 */
export async function isAdmin(userId: string): Promise<boolean> {
  const [user] = await db
    .select({ role: users.role })
    .from(users)
    .where(eq(users.id, userId));

  if (user?.role === 'admin') return true;

  // Fallback: check env-based admin list
  const adminIds = process.env['ADMIN_GITHUB_IDS']?.split(',').map((s) => s.trim()) ?? [];
  return adminIds.includes(userId);
}

/**
 * Require admin access. Returns the session if the user is admin,
 * throws ForbiddenError otherwise.
 */
export async function requireAdmin(): Promise<AuthenticatedSession> {
  const session = await requireAuth();
  const admin = await isAdmin(session.user.id);

  if (!admin) {
    const { ForbiddenError } = await import('./api');
    throw new ForbiddenError('Admin access required');
  }

  return session;
}

/**
 * Get admin configuration from the database.
 * Returns defaults if no config row exists.
 */
export async function getAdminConfig() {
  const { adminConfig } = await import('@heynxt/persistence');
  const [config] = await db.select().from(adminConfig);

  return {
    creditsPerUSD: config ? parseFloat(config.creditsPerUSD) : 100,
    minCreditsForBuild: config ? parseFloat(config.minCreditsForBuild) : 10,
    platformFeeMultiplier: config ? parseFloat(config.platformFeeMultiplier) : 1.33,
  };
}
