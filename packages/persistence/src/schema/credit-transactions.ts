/**
 * Drizzle table definition for `credit_transactions`.
 *
 * Immutable audit log of every credit balance change.
 * Each row records who changed what, how much, and why.
 *
 * Transaction types:
 *   - debit:      credits deducted for a build
 *   - credit:     credits added (purchase, admin grant)
 *   - adjustment: admin manual adjustment (up or down)
 */
import {
  pgTable,
  pgEnum,
  text,
  numeric,
  timestamp,
  index,
} from 'drizzle-orm/pg-core';

export const creditTxTypeEnum = pgEnum('credit_tx_type', [
  'debit',
  'credit',
  'adjustment',
]);

export const creditTransactions = pgTable('credit_transactions', {
  /** UUID string (server-generated). */
  id: text('id').primaryKey(),

  /** FK to users.id — whose balance changed. */
  userId: text('userId').notNull(),

  /** Type of transaction. */
  type: creditTxTypeEnum('type').notNull(),

  /** Amount (positive for credit/adjustment-up, negative for debit). */
  amount: numeric('amount', { precision: 12, scale: 2 }).notNull(),

  /** Balance before this transaction. */
  balanceBefore: numeric('balanceBefore', { precision: 12, scale: 2 }).notNull(),

  /** Balance after this transaction. */
  balanceAfter: numeric('balanceAfter', { precision: 12, scale: 2 }).notNull(),

  /** Human-readable reason (e.g. "Build abc123", "Admin adjustment"). */
  reason: text('reason').notNull(),

  /** FK to builds.id — linked build (for debit transactions). */
  buildId: text('buildId'),

  /** FK to users.id — admin who performed the action (for adjustments). */
  adminId: text('adminId'),

  createdAt: timestamp('createdAt', { mode: 'date' }).notNull().defaultNow(),
}, (table) => ({
  userIdIdx: index('credit_tx_user_id_idx').on(table.userId),
  buildIdIdx: index('credit_tx_build_id_idx').on(table.buildId),
}));

export type CreditTransaction = typeof creditTransactions.$inferSelect;
export type InsertCreditTransaction = typeof creditTransactions.$inferInsert;
