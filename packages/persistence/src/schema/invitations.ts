/**
 * Drizzle table definition for `invitations`.
 *
 * Each row represents a pending or historical invitation to join an
 * organization (optionally scoped to a specific workspace). The `token`
 * column holds a URL-safe random string the invitee uses to accept via
 * `GET /api/invitations/accept?token=...` .
 *
 * Why not `verification_tokens`?
 *   `verification_tokens` is part of the Auth.js Drizzle adapter contract
 *   (see ADR-0008) — it has a fixed 3-column shape
 *   (identifier, token, expires) with a compound PK and no room for
 *   invitation metadata (organization, role, workspace, inviter).
 *   Overloading it would break Auth.js expectations. A dedicated table
 *   keeps the two concerns cleanly separated.
 *
 * Column naming convention: camelCase for both the TypeScript key and
 * the Postgres column name. See users.ts for the rationale.
 *
 * Source Zod schema: packages/core-types/src/schemas/invitation.ts
 */
import {
  pgTable,
  text,
  timestamp,
  pgEnum,
  index,
  uniqueIndex,
} from 'drizzle-orm/pg-core';

import { users } from './users.js';
import { organizations } from './organizations.js';
import { workspaces } from './workspaces.js';
import { roleNameEnum } from './role-assignments.js';

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------

/** invitations.status — lifecycle state. Mirrors `InvitationStatus` in core-types. */
export const invitationStatusEnum = pgEnum('invitation_status', [
  'pending',
  'accepted',
  'expired',
  'revoked',
]);

// ---------------------------------------------------------------------------
// Table
// ---------------------------------------------------------------------------

export const invitations = pgTable(
  'invitations',
  {
    /** UUID string (server-generated). */
    id: text('id').primaryKey(),

    /** The organization the invitee is being invited to join. */
    organizationId: text('organizationId')
      .notNull()
      .references(() => organizations.id),

    /** Invitee's email. Application-layer uniqueness per (org, status=pending). */
    email: text('email').notNull(),

    /**
     * Role the invitee will receive on acceptance. Reuses the `role_name`
     * enum from `role_assignments` so role vocabulary stays consistent
     * between grants and invites.
     */
    roleName: roleNameEnum('roleName').notNull(),

    /**
     * Optional workspace scope. When set, the role assignment created on
     * acceptance is scoped to this workspace. When NULL, the granted role
     * is org-scoped (applies across all workspaces).
     */
    workspaceId: text('workspaceId').references(() => workspaces.id),

    /** URL-safe random token used for out-of-band acceptance. */
    token: text('token').notNull(),

    /** The user who created this invitation. */
    invitedBy: text('invitedBy')
      .notNull()
      .references(() => users.id),

    /** Lifecycle status. Defaults to 'pending'. */
    status: invitationStatusEnum('status').notNull().default('pending'),

    /** When the invitation expires. Past-timestamped invitations can no longer be accepted. */
    expiresAt: timestamp('expiresAt', { mode: 'date' }).notNull(),

    /** When the invitation was accepted. Null until accepted. */
    acceptedAt: timestamp('acceptedAt', { mode: 'date' }),

    /** Row creation time. DB-level default for parity with other tables. */
    createdAt: timestamp('createdAt', { mode: 'date' })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    /** Look up an invitation by its acceptance token (unique). */
    tokenUnique: uniqueIndex('invitations_token_unique').on(table.token),
    /** Index for "which invitations exist in this org" queries. */
    orgIdx: index('invitations_organizationId_idx').on(table.organizationId),
  }),
);
