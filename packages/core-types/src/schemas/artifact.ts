import { z } from 'zod';
import { WorkspaceId } from './workspace.js';
import { ProjectId } from './project.js';
import { TaskId } from './task.js';
import { GenerationRunId } from './generation-run.js';
import { UserId } from './user.js';

/**
 * Artifact schema — an immutable file or record produced by a generation run.
 *
 * An artifact is the evidence layer for validation (Phase 7). Each artifact
 * is attached to exactly one GenerationRun and denormalizes its parent chain
 * (task → project → workspace) so lookups and queries are simple — no joins
 * required to scope by any ancestor.
 *
 * Design notes:
 * - Artifacts are immutable once created. Re-runs produce new artifacts in a
 *   new GenerationRun; they do not mutate existing artifacts. If a re-run
 *   produces an identical result, the content hash will match, but the
 *   artifact row itself is brand new with a fresh id and `generationRunId`.
 * - `contentHash` (SHA-256 hex) enables idempotent regeneration and dedup
 *   across runs. Combined with spec/blueprint hashes on the run, callers can
 *   decide whether to skip regeneration entirely when the input + output
 *   hashes all match.
 * - `byteSize` is required for `url` and `git` storage kinds (where the size
 *   cannot be computed locally), and optional for `inline` content (where it
 *   can be derived from `textContent`).
 * - `storageKind` splits how content is accessed: `inline` stores content
 *   directly in `textContent`; `url` stores an external URL in `storageUrl`;
 *   `git` stores a blob reference (`<sha>:<path>`) in `storageRef`.
 */

export const ArtifactId = z.string().uuid();

/**
 * What kind of artifact this is. Keep the enum tight; add kinds here rather
 * than inventing free-form strings.
 */
export const ArtifactKind = z.enum([
  'code',            // generated source files
  'diff',            // diff against a previous version
  'migration',       // database migration file
  'spec',            // the parsed spec document
  'blueprint-plan',  // the blueprint composition result
  'log',             // agent execution log
  'test-report',     // test output / report
  'screenshot',      // UI snapshot
  'config',          // generated config (Dockerfile, env, etc.)
]);

/**
 * How the artifact content is stored / accessed.
 */
export const ArtifactStorageKind = z.enum([
  'inline',  // content stored directly in the textContent field
  'url',     // content stored externally, accessible via storageUrl
  'git',     // content stored as a Git blob reference (SHA + path)
]);

export const Artifact = z.object({
  id: ArtifactId,
  workspaceId: WorkspaceId,
  projectId: ProjectId,
  taskId: TaskId,
  generationRunId: GenerationRunId,

  kind: ArtifactKind,
  storageKind: ArtifactStorageKind,

  // Filename or path within the generation run's output tree.
  // Example: "src/routes/work-orders.ts", "migrations/0001_init.sql".
  name: z.string().min(1).max(500),

  // MIME type. Optional for code artifacts (infer from extension).
  mimeType: z.string().max(200).nullish(),

  // For `inline` storage: the content itself.
  // For `url` or `git` storage: null (use storageUrl or storageRef instead).
  textContent: z.string().max(5_000_000).nullish(),

  // For `url` storage: a signed/accessible URL.
  // For `git` storage: the object storage URL if served.
  storageUrl: z.string().url().nullish(),

  // For `git` storage: git blob SHA or ref. Format: "<sha>:<path>".
  storageRef: z.string().max(500).nullish(),

  // SHA-256 hex digest of the content. Used for idempotent re-runs
  // (if spec + blueprint + input hash match AND content hash matches,
  // the generator may skip regeneration).
  contentHash: z.string().max(64).nullish(),

  // Size in bytes. Required for url/git storage kinds; optional for inline
  // (can be computed from textContent).
  byteSize: z.number().int().nonnegative().nullish(),

  createdBy: UserId,
  createdAt: z.coerce.date(),
});

export type Artifact = z.infer<typeof Artifact>;
export type ArtifactId = z.infer<typeof ArtifactId>;
export type ArtifactKind = z.infer<typeof ArtifactKind>;
export type ArtifactStorageKind = z.infer<typeof ArtifactStorageKind>;

/**
 * Subset used when embedding artifacts in generation run details, task
 * summaries, or UI lists. Omits potentially large content fields.
 */
export const ArtifactSummary = Artifact.pick({
  id: true,
  generationRunId: true,
  kind: true,
  storageKind: true,
  name: true,
  mimeType: true,
  contentHash: true,
  byteSize: true,
  createdAt: true,
});

export type ArtifactSummary = z.infer<typeof ArtifactSummary>;

/**
 * Returns true if the artifact's textContent is directly usable inline.
 */
export function hasInlineContent(a: Artifact): boolean {
  return a.storageKind === 'inline' && a.textContent !== null && a.textContent !== undefined;
}

/**
 * Input schema for creating a new Artifact.
 *
 * Omits server-generated fields:
 *   - `id` (UUID, server-assigned)
 *   - `createdAt` (timestamp, server-assigned)
 *
 * All foreign keys are required from the caller (the artifact denormalizes
 * the parent chain for query efficiency — workspace/project/task/run must
 * all be provided and match).
 *
 * Storage fields are optional and conditional on `storageKind`:
 *   - `inline` → `textContent` should be set (content stored in DB)
 *   - `url`    → `storageUrl` should be set (external URL)
 *   - `git`    → `storageRef` should be set (blob SHA + path)
 *
 * Cross-field validation is soft: the schema accepts any combination, and
 * the API layer relies on the caller to provide matching fields. The DB
 * schema does not enforce this either — documentation drives correctness.
 *
 * `contentHash` and `byteSize` are optional. Callers may compute them
 * client-side (e.g., SHA-256 of textContent before upload), or leave them
 * null and rely on the server to fill them for inline artifacts.
 *
 * `createdBy` is omitted from the input — the API derives it from the
 * authenticated session (see `apps/web/src/app/api/artifacts/route.ts`).
 * Callers cannot set it directly; the server enforces the audit trail.
 */
export const CreateArtifactInput = Artifact.omit({
  id: true,
  createdAt: true,
  createdBy: true,
}).partial({
  mimeType: true,
  textContent: true,
  storageUrl: true,
  storageRef: true,
  contentHash: true,
  byteSize: true,
});

export type CreateArtifactInput = z.infer<typeof CreateArtifactInput>;
