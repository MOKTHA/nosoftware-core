/**
 * Drizzle table definition for `artifacts`.
 *
 * Column naming convention: camelCase for both the TypeScript key and the
 * Postgres column name. See users.ts for the rationale.
 *
 * Source Zod schema: packages/core-types/src/schemas/artifact.ts
 */
import {
  pgTable,
  text,
  integer,
  timestamp,
  pgEnum,
  index,
} from 'drizzle-orm/pg-core';

import { workspaces } from './workspaces.js';
import { projects } from './projects.js';
import { tasks } from './tasks.js';
import { generationRuns } from './generation-runs.js';
import { users } from './users.js';

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------

/** artifact.kind. Mirrors `ArtifactKind` in core-types. */
export const artifactKindEnum = pgEnum('artifact_kind', [
  'code',
  'diff',
  'migration',
  'spec',
  'blueprint-plan',
  'log',
  'test-report',
  'screenshot',
  'config',
]);

/** artifact.storageKind — where/how the content is persisted. */
export const artifactStorageKindEnum = pgEnum('artifact_storage_kind', [
  'inline',
  'url',
  'git',
]);

// ---------------------------------------------------------------------------
// Table
// ---------------------------------------------------------------------------

export const artifacts = pgTable('artifacts', {
  /** UUID string (client-generated). */
  id: text('id').primaryKey(),

  /** FK to the owning workspace (denormalized for query efficiency). */
  workspaceId: text('workspaceId')
    .notNull()
    .references(() => workspaces.id),

  /** FK to the owning project (denormalized). */
  projectId: text('projectId')
    .notNull()
    .references(() => projects.id),

  /** FK to the parent task (denormalized). */
  taskId: text('taskId')
    .notNull()
    .references(() => tasks.id),

  /** FK to the generation run that produced this artifact. */
  generationRunId: text('generationRunId')
    .notNull()
    .references(() => generationRuns.id),

  /** What kind of artifact this is. */
  kind: artifactKindEnum('kind').notNull(),

  /** How the content is stored / accessed. */
  storageKind: artifactStorageKindEnum('storageKind').notNull(),

  /** Filename or path within the generation run's output tree. */
  name: text('name').notNull(),

  /** MIME type. Nullable for code artifacts (infer from extension). */
  mimeType: text('mimeType'),

  /**
   * For `inline` storage: the content itself.
   * For `url` or `git` storage: null.
   */
  textContent: text('textContent'),

  /**
   * For `url` storage: a signed/accessible URL.
   * For `git` storage: the object storage URL if served.
   */
  storageUrl: text('storageUrl'),

  /**
   * For `git` storage: git blob SHA or ref. Format: "<sha>:<path>".
   * Null for inline and url storage kinds.
   */
  storageRef: text('storageRef'),

  /**
   * SHA-256 hex digest of the content. Used for idempotent re-runs.
   */
  contentHash: text('contentHash'),

  /** Size in bytes. Required for url/git; optional for inline. */
  byteSize: integer('byteSize'),

  /** The user who created this artifact. */
  createdBy: text('createdBy')
    .notNull()
    .references(() => users.id),

  createdAt: timestamp('createdAt', { mode: 'date' }).notNull(),
}, (table) => ({
  generationRunIdx: index('artifacts_generationRunId_idx').on(table.generationRunId),
  workspaceIdx: index('artifacts_workspaceId_idx').on(table.workspaceId),
}));
