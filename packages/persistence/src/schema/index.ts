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
