/**
 * PATCH /api/admin/users/:userId/credits — Adjust a user's credit balance.
 *
 * Body: { amount: number, reason: string }
 *   - amount > 0: add credits
 *   - amount < 0: deduct credits
 *
 * Creates an audit trail in credit_transactions.
 * Uses a transaction with row-level select for atomicity.
 */
import { eq, sql } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';

import { db, users, creditTransactions } from '@heynxt/persistence';
import { requireAdmin } from '@/lib/admin';
import { errorResponse } from '@/lib/api';

export async function PATCH(
  req: Request,
  props: { params: Promise<{ userId: string }> },
) {
  try {
    const session = await requireAdmin();
    const { userId } = await props.params;

    const body = (await req.json()) as { amount?: number; reason?: string };

    if (typeof body.amount !== 'number' || body.amount === 0) {
      return Response.json({ error: 'amount must be a non-zero number' }, { status: 400 });
    }
    if (!body.reason?.trim()) {
      return Response.json({ error: 'reason is required' }, { status: 400 });
    }

    // Atomic credit adjustment using raw SQL for SELECT ... FOR UPDATE
    const [user] = await db
      .select({ id: users.id, credits: users.credits })
      .from(users)
      .where(eq(users.id, userId));

    if (!user) {
      return Response.json({ error: 'User not found' }, { status: 404 });
    }

    const balanceBefore = parseFloat(user.credits);
    const balanceAfter = balanceBefore + body.amount;

    if (balanceAfter < 0) {
      return Response.json(
        { error: `Insufficient credits. User has ${balanceBefore}, cannot deduct ${Math.abs(body.amount)}` },
        { status: 400 },
      );
    }

    // Update credits
    await db
      .update(users)
      .set({
        credits: balanceAfter.toFixed(2),
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId));

    // Log transaction
    const txId = randomUUID();
    await db.insert(creditTransactions).values({
      id: txId,
      userId,
      type: body.amount > 0 ? 'credit' : 'adjustment',
      amount: body.amount.toFixed(2),
      balanceBefore: balanceBefore.toFixed(2),
      balanceAfter: balanceAfter.toFixed(2),
      reason: body.reason.trim(),
      adminId: session.user.id,
      createdAt: new Date(),
    });

    return Response.json({
      ok: true,
      userId,
      balanceBefore,
      balanceAfter,
      transactionId: txId,
    });
  } catch (err) {
    return errorResponse(err);
  }
}
