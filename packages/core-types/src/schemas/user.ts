import { z } from 'zod';

/**
 * User schema — a person who interacts with the platform.
 *
 * Mirrors the shape of `vercel-labs/coding-agent-template`'s `users` table
 * (id/name/email/image) while adding organization-membership fields
 * needed for RBAC.
 *
 * Identity merge pattern: users authenticate via one or more OAuth providers
 * (GitHub, Vercel). Multiple accounts may link to the same user. The
 * connection list lives in a separate schema (user-provider link) — see
 * schemas/account.ts (deferred to Phase 1 follow-up).
 */

export const UserId = z.string().uuid();

export const UserStatus = z.enum([
  'active',
  'invited',
  'suspended',
  'deleted',
]);

export const User = z.object({
  id: UserId,
  email: z.string().email(),
  emailVerified: z.coerce.date().nullish(),
  name: z.string().min(1).max(200).nullish(),
  image: z.string().url().nullish(),

  // Status / lifecycle
  status: UserStatus.default('invited'),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

export type User = z.infer<typeof User>;
export type UserId = z.infer<typeof UserId>;
export type UserStatus = z.infer<typeof UserStatus>;

/**
 * Subset used when embedding users in audit trails, logs, or UI lists.
 * Avoids pulling provider links or large metadata.
 */
export const UserSummary = User.pick({
  id: true,
  email: true,
  name: true,
  image: true,
  status: true,
});

export type UserSummary = z.infer<typeof UserSummary>;
