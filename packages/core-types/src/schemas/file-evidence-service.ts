/**
 * File/evidence service schema for Phase 8 — Industrial Runtime Services
 *
 * Defines the structure of artifacts, logs, and attachments that are persisted and served.
 */

import { z } from 'zod';

// ============================================================================
// Artifact Core Types
// ============================================================================

/** Unique identifier for an artifact record */
export const ArtifactId = z.string().uuid();
export type ArtifactId = z.infer<typeof ArtifactId>;

/** Content-addressable hash (SHA-256) for integrity verification */
export const ContentHash = z.string().regex(
  /^[a-f0-9]{64}$/i,
  'Content hash must be SHA-256 hex format (64 characters)'
);

export type ContentHash = z.infer<typeof ContentHash>;

/** Storage location types */
export const ArtifactStorageType = z.enum([
  'local',      // Local filesystem storage
  's3',         // AWS S3 or compatible object storage
  'gcs',        // Google Cloud Storage
  'azure_blob', // Azure Blob Storage
]);

export type ArtifactStorageType = z.infer<typeof ArtifactStorageType>;

/** Content types for artifacts */
export const ArtifactContentType = z.enum([
  'application/json',
  'application/pdf',
  'text/plain',
  'image/png',
  'image/jpeg',
  'video/mp4',
  'application/zip',
  'multipart/form-data', // For mixed content uploads
]);

export type ArtifactContentType = z.infer<typeof ArtifactContentType>;

/** Storage tier for cost optimization */
export const StorageTier = z.enum([
  'hot',      // Frequently accessed, fast storage
  'cold',     // Infrequently accessed, lower-cost storage
  'archive',  // Long-term retention, very low-cost but slower access
]);

export type StorageTier = z.infer<typeof StorageTier>;

// ============================================================================
// Artifact Schema
// ============================================================================

/** Base artifact metadata */
export const ArtifactBase = z.object({
  id: ArtifactId.optional(), // Generated on insert if not provided
  name: z.string().min(1, 'Artifact name is required'),
  description: z.string().optional(),
  contentType: ArtifactContentType,
  sizeBytes: z.number().int().positive('Size must be positive bytes'),
  contentHash: ContentHash, // SHA-256 hash of file contents for integrity verification
  storageType: ArtifactStorageType.default('local'),
  storageLocation: z.string().min(1, 'Storage location is required'), // e.g., "s3://bucket/path/to/file" or "/mnt/data/artifacts/..."
  storageTier: StorageTier.default('hot'),
});

export const Artifact = ArtifactBase.extend({
  id: ArtifactId, // Required for persisted artifacts
});

export type Artifact = z.infer<typeof Artifact>;

// ============================================================================
// Evidence Types (specific to heynxt-core)
// ============================================================================

/** Type of evidence being stored */
export const EvidenceType = z.enum([
  'validation-log',     // Output from validation stages (lint, tests, etc.)
  'generation-diff',    // Generated code diffs
  'test-report',        // Test execution reports (JUnit XML, coverage)
  'screenshot',         // Visual evidence (browser screenshots of UI)
  'terminal-output',    // Raw terminal/CLI output
  'process-run-log',    // Production run logs from industrial equipment
  'quality-inspection', // Quality inspection results and images
  'genealogy-record',   // Traceability/genealogy data for work items
  'custom',             // Custom evidence type defined by user
]);

export type EvidenceType = z.infer<typeof EvidenceType>;

/** Evidence record with artifact linkage */
export const EvidenceRecordBase = ArtifactBase.extend({
  evidenceType: EvidenceType.default('custom'),
  relatedGenerationRunId: ArtifactId.optional(), // Which generation run this evidence is from
  relatedValidationRunId: ArtifactId.optional(), // Which validation run this evidence is from
  metadata: z.record(z.unknown()).optional(), // Additional context-specific metadata
});

export const EvidenceRecord = EvidenceRecordBase.extend({
  id: ArtifactId, // Required for persisted records
});

export type EvidenceRecord = z.infer<typeof EvidenceRecord>;

// ============================================================================
// File Upload/Download API Schema
// ============================================================================

/** Request to upload a new artifact */
export const UploadArtifactRequest = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  contentType: ArtifactContentType,
  contentHash: ContentHash, // Pre-computed hash before upload for integrity check
  storageType: ArtifactStorageType.optional(), // Override default if needed
});

export type UploadArtifactRequest = z.infer<typeof UploadArtifactRequest>;

/** Response after successful upload */
export const UploadArtifactResponse = z.object({
  id: ArtifactId,
  name: z.string(),
  sizeBytes: z.number().int(),
  contentHash: ContentHash,
  storageLocation: z.string(),
  uploadedAt: z.date(),
});

export type UploadArtifactResponse = z.infer<typeof UploadArtifactResponse>;

/** Request to download an artifact */
export const DownloadArtifactRequest = z.object({
  id: ArtifactId,
});

export type DownloadArtifactRequest = z.infer<typeof DownloadArtifactRequest>;

/** Response containing download URL (presigned URL for S3/GCS/Azure) */
export const DownloadArtifactResponse = z.object({
  artifactId: ArtifactId,
  name: z.string(),
  contentType: ArtifactContentType,
  sizeBytes: z.number().int(),
  presignedUrl: z.string().url('Presigned download URL'),
  expiresAt: z.date(), // When the URL expires (typically 15-60 minutes)
});

export type DownloadArtifactResponse = z.infer<typeof DownloadArtifactResponse>;

// ============================================================================
// Evidence Query/Search API Schema
// ============================================================================

/** Filter options for querying evidence */
export const EvidenceFilterSchema = z.object({
  evidenceType: EvidenceType.optional(), // Filter by evidence type
  generationRunId: ArtifactId.optional(), // Filter by related generation run
  validationRunId: ArtifactId.optional(), // Filter by related validation run
  contentType: ArtifactContentType.optional(), // Filter by content type
  startDate: z.date().optional(), // Include records from this date onwards
  endDate: z.date().optional(), // Include records up to this date
  limit: z.number().int().min(1).max(500).default(50),
  offset: z.number().int().min(0).default(0),
});

export type EvidenceFilter = z.infer<typeof EvidenceFilterSchema>;

/** Response with paginated evidence results */
export const QueryEvidenceResponse = z.object({
  items: z.array(EvidenceRecord),
  total: z.number().int(), // Total count matching filter (before pagination)
  limit: z.number().int(),
  offset: z.number().int(),
});

export type QueryEvidenceResponse = z.infer<typeof QueryEvidenceResponse>;

// ============================================================================
// Artifact Integrity Verification
// ============================================================================

/** Request to verify artifact integrity */
export const VerifyArtifactRequest = z.object({
  id: ArtifactId, // Which artifact to verify
  expectedHash: ContentHash.optional(), // Expected hash (defaults to stored contentHash if not provided)
});

export type VerifyArtifactRequest = z.infer<typeof VerifyArtifactRequest>;

/** Result of integrity verification */
export const VerificationResult = z.object({
  artifactId: ArtifactId,
  verifiedAt: z.date(),
  status: z.enum(['valid', 'corrupted', 'missing']),
  actualHash: ContentHash.optional(), // Hash computed from current file contents
  expectedHash: ContentHash, // What was compared against
});

export type VerificationResult = z.infer<typeof VerificationResult>;

// ============================================================================
// Export Types
// ============================================================================

/** Complete artifact/evidence service schemas */
export const FileEvidenceServiceSchema = z.object({
  artifact: Artifact,
  evidenceRecord: EvidenceRecord,
  uploadRequest: UploadArtifactRequest,
  downloadResponse: DownloadArtifactResponse,
});
