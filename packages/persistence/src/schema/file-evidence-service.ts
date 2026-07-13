/**
 * Drizzle table definition for `artifacts` (file/evidence service).
 *
 * Phase 8 — Industrial Runtime Services: File and evidence persistence.
 * Content-addressable storage with SHA-256 integrity verification.
 */
import {
  pgTable,
  text,
  timestamp,
  integer,
  jsonb,
  index,
} from 'drizzle-orm/pg-core';

// ---------------------------------------------------------------------------
// Enums for artifact types
// ---------------------------------------------------------------------------

export const artifactStorageTypeEnum = text('storageType', {
  enum: ['local', 's3', 'gcs', 'azure_blob'],
});

export const artifactContentTypeEnum = text('contentType', {
  enum: [
    'application/json',
    'application/pdf',
    'text/plain',
    'image/png',
    'image/jpeg',
    'video/mp4',
    'application/zip',
    'multipart/form-data',
  ],
});

export const storageTierEnum = text('storageTier', {
  enum: ['hot', 'cold', 'archive'],
});

export const evidenceTypeEnum = text('evidenceType', {
  enum: [
    'validation-log',
    'generation-diff',
    'test-report',
    'screenshot',
    'terminal-output',
    'process-run-log',
    'quality-inspection',
    'genealogy-record',
    'custom',
  ],
});

// ---------------------------------------------------------------------------
// Table: artifacts (file/evidence storage)
// ---------------------------------------------------------------------------

/**
 * Content-addressable artifact storage. Each artifact is identified by its
 * SHA-256 content hash, which ensures integrity and deduplication.
 */
export const artifacts = pgTable(
  'artifacts',
  {
    /** UUID string (server-generated if not provided). */
    id: text('id').primaryKey(),

    /** Artifact name. */
    name: text('name').notNull(),

    /** Optional description. */
    description: text('description'),

    /** Content type (MIME type). */
    contentType: artifactContentTypeEnum.notNull(),

    /** File size in bytes. */
    sizeBytes: integer('sizeBytes').notNull(),

    /** SHA-256 content hash (64 hex characters). Used for integrity verification and deduplication. */
    contentHash: text('contentHash').notNull(),

    /** Storage type (local, S3, GCS, Azure Blob). */
    storageType: artifactStorageTypeEnum.notNull().default('local'),

    /** Storage location (S3 path or local filesystem path). */
    storageLocation: text('storageLocation').notNull(),

    /** Storage tier for cost optimization. */
    storageTier: storageTierEnum.notNull().default('hot'),

    /** Evidence type (if this artifact is evidence from validation/generation). */
    evidenceType: evidenceTypeEnum,

    /** FK to related generation run (optional). */
    relatedGenerationRunId: text('relatedGenerationRunId'),

    /** FK to related validation run (optional). */
    relatedValidationRunId: text('relatedValidationRunId'),

    /** Additional metadata as JSON object. */
    metadata: jsonb('metadata').$type<unknown>(),

    createdAt: timestamp('createdAt', { mode: 'date' }).notNull(),
  },
  (table) => ({
    contentHashIdx: index(
      'artifacts_contentHash_idx',
    ).on(table.contentHash), // For deduplication and integrity checks
    evidenceTypeIdx: index(
      'artifacts_evidenceType_idx',
    ).on(table.evidenceType),
    storageTypeIdx: index(
      'artifacts_storageType_idx',
    ).on(table.storageType),
    genRunIdx: index(
      'artifacts_relatedGenerationRunId_idx',
    ).on(table.relatedGenerationRunId),
    valRunIdx: index(
      'artifacts_relatedValidationRunId_idx',
    ).on(table.relatedValidationRunId),
  }),
);

// ---------------------------------------------------------------------------
// Table: artifact_verification_log (integrity audit trail)
// ---------------------------------------------------------------------------

/**
 * Records integrity verification results for artifacts. Each time an artifact
 * is accessed or verified, a new record is created to track its health over time.
 */
export const artifactVerificationLog = pgTable(
  'artifact_verification_log',
  {
    /** UUID string. */
    id: text('id').primaryKey(),

    /** FK to the artifact being verified. */
    artifactId: text('artifactId')
      .notNull()
      .references(() => artifacts.id, { onDelete: 'cascade' }),

    /** When verification was performed. */
    verifiedAt: timestamp('verifiedAt', { mode: 'date' })
      .notNull()
      .$defaultFn(() => new Date()),

    /** Verification result status. */
    status: text('status', {
      enum: ['valid', 'corrupted', 'missing'],
    }).notNull(),

    /** Hash computed from current file contents (if accessible). */
    actualHash: text('actualHash'),

    /** Expected hash that was compared against. */
    expectedHash: text('expectedHash').notNull(),

    /** Error message if verification failed. */
    errorMessage: text('errorMessage'),
  },
  (table) => ({
    artifactIdx: index(
      'artifact_verification_log_artifactId_idx',
    ).on(table.artifactId),
    statusIdx: index(
      'artifact_verification_log_status_idx',
    ).on(table.status),
  }),
);

// ---------------------------------------------------------------------------
// Type Exports
// ---------------------------------------------------------------------------

/** Artifact record type. */
export type Artifact = typeof artifacts.$inferSelect;

/** Insertable artifact (without id, createdAt). */
export type InsertArtifact = Omit<
  typeof artifacts.$inferInsert,
  'id' | 'createdAt'
>;

/** Artifact verification log record type. */
export type ArtifactVerificationLog = typeof artifactVerificationLog.$inferSelect;

/** Insertable artifact verification log (without id, verifiedAt). */
export type InsertArtifactVerificationLog = Omit<
  typeof artifactVerificationLog.$inferInsert,
  'id' | 'verifiedAt'
>;
