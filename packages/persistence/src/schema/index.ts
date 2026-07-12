/**
 * Barrel re-export for all Drizzle table definitions and enums.
 *
 * Consumers should import from `@heynxt/persistence` (the top-level
 * re-export), not from this file directly.
 */

// Tables
export {
  users,
  userStatusEnum,
} from './users.js';

export {
  organizations,
  organizationStatusEnum,
} from './organizations.js';

export {
  workspaces,
  workspaceStatusEnum,
} from './workspaces.js';

export {
  roleAssignments,
  roleNameEnum,
} from './role-assignments.js';

export {
  projects,
  projectStatusEnum,
} from './projects.js';

export {
  tasks,
  taskTypeEnum,
  taskStatusEnum,
} from './tasks.js';

export {
  generationRuns,
  generationRunStatusEnum,
} from './generation-runs.js';

export {
  artifacts,
  artifactKindEnum,
  artifactStorageKindEnum,
} from './artifacts.js';

export {
  auditLog,
  auditEntityTypeEnum,
  auditActionEnum,
} from './audit-log.js';

// Auth.js adapter tables (ADR-0008)
export { accounts } from './accounts.js';
export { sessions } from './sessions.js';
export { verificationTokens } from './verification-tokens.js';

// Invitation flow (Phase 1.8 — Task 23)
export { invitations, invitationStatusEnum } from './invitations.js';

// Agent execution (Phase 2)
export {
  agentSpecs,
  agentExecutionResults,
  agentTypeEnum,
  agentStatusEnum,
  executionResultStatusEnum,
} from './agent-spec.js';

// Validation runs (Phase 7.3)
export {
  validationRuns,
  type ValidationRun,
} from './validation-run.js';

export {
  validationResults,
  type ValidationResultDbRecord as ValidationResultRecord,
} from './validation-results.js';

// Approval decisions and rerun requests (Phase 7.5)
export {
  approvalDecisions,
  type ApprovalDecision,
  type InsertApprovalDecision,
} from './approval-decisions.js';

export {
  rerunRequests,
  type RerunRequest,
  type InsertRerunRequest,
} from './approval-decisions.js';
