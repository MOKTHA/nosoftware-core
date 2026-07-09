import { z } from 'zod';
import { OrganizationId } from './organization.js';
import { WorkspaceId } from './workspace.js';
import { UserId } from './user.js';
import { RoleName } from './rbac.js';

/**
 * Invitation schema — a pending request for a user to join an organization.
 *
 * Each invitation targets an email address and carries:
 *   - the organization to join
 *   - the role the invitee will receive on acceptance
 *   - an optional workspace scope (if set, the granted role is workspace-scoped;
 *     if not, it's org-scoped)
 *   - a URL-safe random token the invitee exchanges for account activation
 *   - an expiry timestamp after which the token is no longer accepted
 *
 * Lifecycle: pending → accepted | expired | revoked.
 *
 * The token is server-generated (crypto.randomBytes, base64url). Never
 * accepted from client input. Stored for one-time lookup; on acceptance,
 * the row's status transitions to 'accepted' and acceptedAt is set.
 */

export const InvitationId = z.string().uuid();

export const InvitationStatus = z.enum([
  'pending',
  'accepted',
  'expired',
  'revoked',
]);

export const Invitation = z.object({
  id: InvitationId,
  organizationId: OrganizationId,
  email: z.string().email(),
  roleName: RoleName,
  workspaceId: WorkspaceId.nullable(),
  token: z.string().min(1),
  invitedBy: UserId,
  status: InvitationStatus.default('pending'),
  expiresAt: z.coerce.date(),
  acceptedAt: z.coerce.date().nullish(),
  createdAt: z.coerce.date(),
});

export type Invitation = z.infer<typeof Invitation>;
export type InvitationId = z.infer<typeof InvitationId>;
export type InvitationStatus = z.infer<typeof InvitationStatus>;

/**
 * Input for creating a new invitation.
 *
 * Server generates: id, token, invitedBy, status, expiresAt, acceptedAt, createdAt.
 * Client supplies: organizationId, email, roleName, optional workspaceId.
 * Optional: `expiresInDays` (defaults server-side to 7).
 */
export const InviteUserInput = z.object({
  organizationId: OrganizationId,
  email: z.string().email(),
  roleName: RoleName,
  workspaceId: WorkspaceId.optional(),
  expiresInDays: z.number().int().min(1).max(30).optional(),
});

export type InviteUserInput = z.infer<typeof InviteUserInput>;

/**
 * Subset returned by listing endpoints. Deliberately excludes `token` —
 * tokens are single-use and should only be revealed to the invitee at
 * the moment of creation (so they can be delivered over a side channel).
 */
export const InvitationSummary = Invitation.pick({
  id: true,
  organizationId: true,
  email: true,
  roleName: true,
  workspaceId: true,
  invitedBy: true,
  status: true,
  expiresAt: true,
  acceptedAt: true,
  createdAt: true,
});

export type InvitationSummary = z.infer<typeof InvitationSummary>;
