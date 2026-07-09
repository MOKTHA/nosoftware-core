import { z } from 'zod';
import { OrganizationId } from './organization.js';
import { WorkspaceId } from './workspace.js';
import { UserId } from './user.js';

/**
 * Audit log schema — immutable, append-only record of state-changing
 * operations in the control plane.
 *
 * Every status transition, create, update, delete, and approval should
 * generate exactly one audit entry. The audit log backs:
 *   - Phase 7 validation (evidence capture)
 *   - Phase 9 governance (audit trail, secret-rotation logging, approval
 *     records)
 *
 * Design notes:
 * - **Immutability**: audit entries are append-only. Never update or delete
 *   them. If a correction is needed, append a new entry with the corrected
 *   state and a reason referencing the original entry id.
 * - **Snapshot discipline**: store only the fields relevant to the action
 *   in `before` / `after`. Do NOT dump whole entity rows. For a status
 *   change store `{ status: oldStatus }` → `{ status: newStatus }`, not
 *   the full entity. Large snapshots bloat the log.
 * - **Cross-workspace lookups**: querying audit log across workspaces
 *   within an org is supported (workspaceId is nullable). Cross-org
 *   lookups are forbidden — the schema enforces org scope via
 *   `organizationId`.
 * - **Retention**: retention policy belongs in Phase 9 governance. The
 *   schema accepts retention hints via metadata (e.g.,
 *   `metadata: { retentionDays: 365 }`).
 * - **Actor**: `actorId` may be a system user (e.g., "system") for
 *   automated transitions, but typically a real UserId.
 * - **EntityType / Action**: keep the enums tight. Loosen only when a
 *   new entity class or action has been reviewed at the ADR level.
 */

export const AuditLogId = z.string().uuid();

/**
 * The class of entity that changed. Keep the enum tight — loosen only
 * when a new entity class has been reviewed at the ADR level.
 */
export const AuditEntityType = z.enum([
  'organization',
  'workspace',
  'project',
  'task',
  'generation-run',
  'artifact',
  'blueprint',
  'user',
  'role-assignment',
  'invitation',
]);

/**
 * The action that was performed. Keep verbs consistent with the RBAC
 * permission vocabulary (create, read, update, delete, run, approve, ...).
 */
export const AuditAction = z.enum([
  'created',
  'updated',
  'deleted',
  'status-changed',
  'approved',
  'rejected',
  'archived',
  'restored',
  'published',
  'deprecated',
]);

export const AuditLogEntry = z.object({
  id: AuditLogId,

  // Organization scope. Every audit entry is scoped to an org, even
  // when the entity lives deeper (workspace, project, etc.).
  organizationId: OrganizationId,

  // Optional workspace scope. Null for org-level events.
  workspaceId: WorkspaceId.nullish(),

  // The entity that was acted upon. entityType discriminates; entityId
  // is the row id in the entity's own table (a UUID for all current
  // entity types).
  entityType: AuditEntityType,
  entityId: z.string().max(64),

  // What happened.
  action: AuditAction,

  // Who performed the action. May be a system user (e.g., "system")
  // for automated transitions, but typically a real UserId.
  actorId: z.string().max(64),

  // Free-form reason given at the time of the action. Required for
  // destructive or elevated actions (delete, approve, reject). Optional
  // for routine transitions.
  reason: z.string().max(2000).nullish(),

  // Snapshot of the entity's relevant fields BEFORE the change.
  // Use sparingly — large snapshots bloat the log. Store only the
  // fields that matter for the action. For example, for a status
  // change, store { status: 'draft' }.
  before: z.record(z.string(), z.unknown()).nullish(),

  // Snapshot AFTER the change. Same guidance as `before`.
  after: z.record(z.string(), z.unknown()).nullish(),

  // Free-form metadata bag for additional context:
  //   - IP address
  //   - user agent
  //   - linked generation run id
  //   - spec hash
  //   - retention hints (e.g., { retentionDays: 365 })
  // Don't store secrets or large blobs here.
  metadata: z.record(z.string(), z.unknown()).nullish(),

  createdAt: z.coerce.date(),
});

export type AuditLogEntry = z.infer<typeof AuditLogEntry>;
export type AuditLogId = z.infer<typeof AuditLogId>;
export type AuditEntityType = z.infer<typeof AuditEntityType>;
export type AuditAction = z.infer<typeof AuditAction>;

/**
 * Convenience factory for a status-change entry. Keeps call sites terse
 * and ensures `before` / `after` follow the snapshot discipline for the
 * common case of a single-field status transition.
 */
export function createStatusChangeEntry(params: {
  id: string;
  organizationId: string;
  workspaceId?: string | null;
  entityType: AuditEntityType;
  entityId: string;
  actorId: string;
  previousStatus: string | null;
  newStatus: string;
  reason?: string | null;
  createdAt: Date;
}): AuditLogEntry {
  return {
    id: params.id,
    organizationId: params.organizationId,
    workspaceId: params.workspaceId ?? null,
    entityType: params.entityType,
    entityId: params.entityId,
    action: 'status-changed',
    actorId: params.actorId,
    reason: params.reason ?? null,
    before: params.previousStatus === null ? null : { status: params.previousStatus },
    after: { status: params.newStatus },
    metadata: null,
    createdAt: params.createdAt,
  };
}
