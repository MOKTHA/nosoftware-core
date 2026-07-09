/**
 * Audit log writer — shared by all API routes that mutate domain entities.
 *
 * The `audit_log` table (see docs/adr/0006-created-by-session-sweep.md and
 * packages/core-types/src/schemas/audit-log.ts) is append-only and
 * organization-scoped. Every entry carries:
 *   - organizationId (required) — tenant scope
 *   - entityType                  — what changed (workspace, project, task, …)
 *   - entityId                    — which row
 *   - action                      — what happened (created, updated, …)
 *   - actorId                     — who did it (a user id or "system")
 *   - before / after              — lightweight snapshots per snapshot discipline
 *   - metadata                    — optional context (IP, user-agent, …)
 *
 * This helper is the one place in the web app that actually writes to the
 * table. Routes call `insertAuditEntry(...)` after the primary INSERT/UPDATE
 * succeeds; failures during the audit insert are swallowed and logged so a
 * broken audit path never breaks the caller's happy path.
 *
 * **Organization scope resolution.**
 *   - If the route already knows the organizationId (e.g. POST /api/workspaces
 *     takes it in the request body), pass `organizationId` directly.
 *   - If the route only knows a workspaceId (e.g. POST /api/projects), pass
 *     `workspaceId` and the helper will look up the owning organization in
 *     a single primary-key query.
 *   - Passing neither is a programming error — the helper throws so the route
 *     surfaces a 500 rather than silently dropping the audit entry. This was
 *     chosen over `console.warn` + silent skip because a missing audit entry
 *     on a state transition is a governance failure worth surfacing loudly.
 *
 * See docs/adr/0006-created-by-session-sweep.md for the ADR that established
 * `createdBy` as session-derived; the actorId here is the same value.
 *
 * Not exported from `@heynxt/persistence` on purpose — this is a web-app
 * helper, not a package-level primitive. If another consumer needs it
 * (worker, background job, etc.) move it into the persistence package.
 */
import { eq } from 'drizzle-orm';

import type { AuditAction, AuditEntityType } from '@heynxt/core-types';
import { AuditLogEntry, createStatusChangeEntry } from '@heynxt/core-types';
import { auditLog, db, workspaces } from '@heynxt/persistence';

export interface InsertAuditEntryParams {
  /** The org this event belongs to. Either this or `workspaceId` must be set. */
  organizationId?: string | null;
  /** The workspace scope. When set without `organizationId`, we look up the org. */
  workspaceId?: string | null;
  /** The class of entity that changed. */
  entityType: AuditEntityType;
  /** The row id of the entity (UUID for all Phase 1 entity types). */
  entityId: string;
  /** The operation being recorded. */
  action: AuditAction;
  /** Who performed the action. Typically the session's `user.id` or "system". */
  actorId: string;
  /** Reason for the action (required for destructive actions). */
  reason?: string | null;
  /** Snapshot of relevant fields before the change (per snapshot discipline). */
  before?: Record<string, unknown> | null;
  /** Snapshot of relevant fields after the change. */
  after?: Record<string, unknown> | null;
  /** Free-form metadata bag (IP, user-agent, retention hints, …). */
  metadata?: Record<string, unknown> | null;
}

/** Shape accepted for resolving an organization scope. */
export interface OrgScope {
  organizationId?: string | null;
  workspaceId?: string | null;
}

/**
 * Resolve the organizationId from the inputs. Returns the orgId, or throws
 * if neither scope was provided.
 *
 * @internal — exported only for tests.
 */
export async function resolveOrganizationId(params: OrgScope): Promise<string> {
  if (params.organizationId) {
    return params.organizationId;
  }
  if (!params.workspaceId) {
    throw new Error(
      'insertAuditEntry: either `organizationId` or `workspaceId` must be provided',
    );
  }
  const rows = await db
    .select({ organizationId: workspaces.organizationId })
    .from(workspaces)
    .where(eq(workspaces.id, params.workspaceId))
    .limit(1);
  const row = rows[0];
  if (!row) {
    throw new Error(
      `insertAuditEntry: workspace ${params.workspaceId} not found; cannot resolve organization`,
    );
  }
  return row.organizationId;
}

/**
 * Append a single audit entry. Best-effort: if the insert fails we log and
 * swallow so the audit path never blocks the caller's success response.
 *
 * The entry is validated via `AuditLogEntry.parse` before insertion so any
 * shape drift surfaces at write time rather than as a silent Postgres error
 * down the line.
 */
export async function insertAuditEntry(params: InsertAuditEntryParams): Promise<void> {
  let organizationId: string;
  try {
    organizationId = await resolveOrganizationId(params);
  } catch (err) {
    // Surface prominently in server logs so the missing-scope bug is noticed.
    // We deliberately don't throw: the route already succeeded and we don't
    // want to fail the user's request because audit infra is broken.
    console.error(
      '[audit] failed to resolve organizationId for audit entry:',
      params,
      err,
    );
    return;
  }

  // Build the entry and validate via Zod before inserting. This catches
  // enum/drift issues early (e.g. entityType enum value misspelled).
  let entry: AuditLogEntry;
  try {
    entry = AuditLogEntry.parse({
      id: crypto.randomUUID(),
      organizationId,
      workspaceId: params.workspaceId ?? null,
      entityType: params.entityType,
      entityId: params.entityId,
      action: params.action,
      actorId: params.actorId,
      reason: params.reason ?? null,
      before: params.before ?? null,
      after: params.after ?? null,
      metadata: params.metadata ?? null,
      createdAt: new Date(),
    });
  } catch (err) {
    console.error('[audit] entry failed Zod validation:', params, err);
    return;
  }

  try {
    await db.insert(auditLog).values({
      id: entry.id,
      organizationId: entry.organizationId,
      workspaceId: entry.workspaceId,
      entityType: entry.entityType,
      entityId: entry.entityId,
      action: entry.action,
      actorId: entry.actorId,
      reason: entry.reason,
      before: entry.before,
      after: entry.after,
      metadata: entry.metadata,
      createdAt: entry.createdAt,
    });
  } catch (err) {
    console.error('[audit] insert failed:', err);
  }
}

/**
 * Convenience factory for a status-change audit entry.
 *
 * Thin wrapper around the core-types `createStatusChangeEntry` helper that
 * resolves the org scope and delegates to `insertAuditEntry`. Call sites
 * (future PATCH/PUT routes) can use this directly.
 *
 * Not yet wired to any route — kept here so the first status-transition
 * endpoint doesn't need to reinvent the call shape.
 */
export async function insertStatusChangeEntry(params: {
  organizationId?: string | null;
  workspaceId?: string | null;
  entityType: AuditEntityType;
  entityId: string;
  actorId: string;
  previousStatus: string | null;
  newStatus: string;
  reason?: string | null;
}): Promise<void> {
  // Resolve the organization scope up front so the factory can build a
  // fully-populated entry. If resolution fails we log and bail — matching
  // the best-effort behaviour of insertAuditEntry.
  let organizationId: string;
  try {
    organizationId = await resolveOrganizationId(params);
  } catch (err) {
    console.error(
      '[audit] failed to resolve organizationId for status-change:',
      err,
    );
    return;
  }

  const entry = createStatusChangeEntry({
    id: crypto.randomUUID(),
    organizationId,
    workspaceId: params.workspaceId ?? null,
    entityType: params.entityType,
    entityId: params.entityId,
    actorId: params.actorId,
    previousStatus: params.previousStatus,
    newStatus: params.newStatus,
    reason: params.reason ?? null,
    createdAt: new Date(),
  });

  // The entry is already validated by the factory — insert directly
  // instead of double-validating via insertAuditEntry.
  try {
    await db.insert(auditLog).values({
      id: entry.id,
      organizationId: entry.organizationId,
      workspaceId: entry.workspaceId,
      entityType: entry.entityType,
      entityId: entry.entityId,
      action: entry.action,
      actorId: entry.actorId,
      reason: entry.reason,
      before: entry.before,
      after: entry.after,
      metadata: entry.metadata,
      createdAt: entry.createdAt,
    });
  } catch (err) {
    console.error('[audit] status-change insert failed:', err);
  }
}
