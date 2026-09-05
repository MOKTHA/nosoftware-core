/**
 * Drizzle table definition for `admin_config`.
 *
 * Singleton configuration table for platform-level settings.
 * Only one row should exist (id = 'default').
 *
 * Settings:
 *   - creditsPerUSD:        how many credits = 1 USD (default 100)
 *   - minCreditsForBuild:   minimum balance to start a build (default 10)
 *   - platformFeeMultiplier: markup on raw cost (default 1.33 = 33% fee)
 */
import {
  pgTable,
  text,
  numeric,
  timestamp,
} from 'drizzle-orm/pg-core';

export const adminConfig = pgTable('admin_config', {
  /** Singleton key — always 'default'. */
  id: text('id').primaryKey().default('default'),

  /** Credits per 1 USD. Default 100. */
  creditsPerUSD: numeric('creditsPerUSD', { precision: 10, scale: 2 })
    .notNull()
    .default('100'),

  /** Minimum credits a user needs to trigger a build. */
  minCreditsForBuild: numeric('minCreditsForBuild', { precision: 10, scale: 2 })
    .notNull()
    .default('10'),

  /** Platform fee multiplier applied to raw cost. 1.33 = 33% fee. */
  platformFeeMultiplier: numeric('platformFeeMultiplier', { precision: 6, scale: 4 })
    .notNull()
    .default('1.33'),

  updatedAt: timestamp('updatedAt', { mode: 'date' }).notNull().defaultNow(),
});

export type AdminConfig = typeof adminConfig.$inferSelect;
export type InsertAdminConfig = typeof adminConfig.$inferInsert;
