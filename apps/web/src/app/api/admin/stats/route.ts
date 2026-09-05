/**
 * GET /api/admin/stats — System-wide metrics (admin only).
 *
 * Returns: totalUsers, totalBuilds, totalCreditsIssued, totalCreditsSpent
 */
import { sql } from 'drizzle-orm';

import { db, users, builds, creditTransactions } from '@heynxt/persistence';
import { requireAdmin } from '@/lib/admin';
import { errorResponse } from '@/lib/api';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    await requireAdmin();

    const [userCount] = await db
      .select({ count: sql<number>`count(*)` })
      .from(users);

    const [buildCount] = await db
      .select({ count: sql<number>`count(*)` })
      .from(builds);

    const [creditsIssued] = await db
      .select({ total: sql<string>`coalesce(sum(amount::numeric), 0)` })
      .from(creditTransactions)
      .where(sql`type = 'credit'`);

    const [creditsSpent] = await db
      .select({ total: sql<string>`coalesce(sum(abs(amount::numeric)), 0)` })
      .from(creditTransactions)
      .where(sql`type = 'debit'`);

    return Response.json({
      totalUsers: Number(userCount?.count ?? 0),
      totalBuilds: Number(buildCount?.count ?? 0),
      totalCreditsIssued: parseFloat(creditsIssued?.total ?? '0'),
      totalCreditsSpent: parseFloat(creditsSpent?.total ?? '0'),
    });
  } catch (err) {
    return errorResponse(err);
  }
}
