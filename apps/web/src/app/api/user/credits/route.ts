/**
 * GET /api/user/credits — Get current user's credit balance and history.
 *
 * Returns: { credits: number, transactions: CreditTransaction[] }
 */
import { eq, desc } from 'drizzle-orm';

import { db, users, creditTransactions } from '@heynxt/persistence';
import { requireAuth } from '@/lib/session';
import { errorResponse } from '@/lib/api';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const session = await requireAuth();

    const [user] = await db
      .select({ credits: users.credits })
      .from(users)
      .where(eq(users.id, session.user.id));

    const transactions = await db
      .select()
      .from(creditTransactions)
      .where(eq(creditTransactions.userId, session.user.id))
      .orderBy(desc(creditTransactions.createdAt))
      .limit(50);

    return Response.json({
      credits: user ? parseFloat(user.credits) : 0,
      transactions,
    });
  } catch (err) {
    return errorResponse(err);
  }
}
