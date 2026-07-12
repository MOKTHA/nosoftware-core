/**
 * @heynxt/agent-adapter — Evidence Capture System (Phase 7.3)
 *
 * Content-addressable storage for validation evidence artifacts.
 * Provides immutable, verifiable artifact persistence with SHA-256 content hashing.
 */

import type { ValidationEvidence } from '@heynxt/core-types';
import * as fs from 'node:fs';
import * as crypto from 'node:crypto';
import * as path from 'node:path';

/** ------------------------------------------------------------------ */
/*  Storage Backend Configuration                                     */
/** ------------------------------------------------------------------ */

export interface EvidenceStorageConfig {
  /** Base directory for evidence storage (default: .evidence in repo root) */
  basePath?: string;
  /** Enable S3 backend if configured */
  useS3?: boolean;
  /** AWS bucket name for production deployments */
  s3BucketName?: string;
}

const DEFAULT_BASE_PATH = path.join(process.cwd(), '.evidence');

/** ------------------------------------------------------------------ */
/*  Content-Addressable Storage                                       */
/** ------------------------------------------------------------------ */

export interface EvidenceStorage {
  /** Store an artifact and return its content-addressed URL/path. */
  store(content: string | Buffer, kind: 'log-file' | 'test-report' | 'screenshot'): Promise<EvidenceArtifact>;

  /** Retrieve stored evidence by storage path. */
  retrieve(storagePath: string): Promise<string | Buffer>;

  /** Verify content hash matches stored artifact. */
  verify(storagePath: string, expectedHash: string): Promise<boolean>;

  /** Delete an artifact (best-effort for immutable guarantees). */
  delete(storagePath: string): Promise<void>;
}

/** Stored evidence artifact with its content address and metadata. */
export interface EvidenceArtifact {
  id: string;
  storagePath: string;
  contentHash: string;
  fileSizeBytes: number;
  kind: 'log-file' | 'test-report' | 'screenshot';
}

/** Local filesystem implementation of evidence storage. */
export class LocalEvidenceStorage implements EvidenceStorage {
  private basePath: string;

  constructor(config?: EvidenceStorageConfig) {
    this.basePath = config?.basePath ?? DEFAULT_BASE_PATH;
    // Ensure base directory exists
    if (!fs.existsSync(this.basePath)) {
      fs.mkdirSync(this.basePath, { recursive: true });
    }
  }

  async store(content: string | Buffer, kind: 'log-file' | 'test-report' | 'screenshot'): Promise<EvidenceArtifact> {
    const contentBuffer = typeof content === 'string' ? Buffer.from(content, 'utf-8') : content;
    const contentHash = crypto.createHash('sha256').update(contentBuffer).digest('hex');

    // Content-addressed path: <kind>/<first-16-chars-of-hash>-<full-hash>
    const artifactId = `${contentHash.slice(0, 16)}-${contentHash}`;
    const storagePath = path.join(this.basePath, kind, `${artifactId}.json`);

    // Ensure subdirectory exists
    fs.mkdirSync(path.dirname(storagePath), { recursive: true });

    // Write artifact with metadata
    const artifactData = JSON.stringify({
      contentHash,
      size: contentBuffer.length,
      kind,
      storedAt: new Date().toISOString(),
      content: typeof content === 'string' ? content : contentBuffer.toString('base64'),
    }, null, 2);

    fs.writeFileSync(storagePath, artifactData, 'utf-8');

    return {
      id: crypto.randomUUID(),
      storagePath: `./${path.relative(process.cwd(), storagePath)}`,
      contentHash,
      fileSizeBytes: contentBuffer.length,
      kind,
    };
  }

  async retrieve(storagePath: string): Promise<string | Buffer> {
    const fullPath = path.join(this.basePath, storagePath.replace(/^\.\//, ''));

    if (!fs.existsSync(fullPath)) {
      throw new Error(`Evidence artifact not found: ${storagePath}`);
    }

    const content = fs.readFileSync(fullPath, 'utf-8');
    const data = JSON.parse(content) as { contentHash: string; content: string };

    // Verify hash on read for integrity guarantee
    const computedHash = crypto.createHash('sha256').update(data.content, 'base64').digest('hex');
    if (computedHash !== data.contentHash) {
      throw new Error(`Evidence artifact corrupted: expected hash ${data.contentHash}, got ${computedHash}`);
    }

    return Buffer.from(data.content, 'base64');
  }

  async verify(storagePath: string, expectedHash: string): Promise<boolean> {
    const fullPath = path.join(this.basePath, storagePath.replace(/^\.\//, ''));

    if (!fs.existsSync(fullPath)) {
      return false;
    }

    const content = fs.readFileSync(fullPath, 'utf-8');
    const data = JSON.parse(content) as { contentHash: string };

    return data.contentHash === expectedHash;
  }

  async delete(storagePath: string): Promise<void> {
    const fullPath = path.join(this.basePath, storagePath.replace(/^\.\//, ''));

    if (fs.existsSync(fullPath)) {
      fs.unlinkSync(fullPath);
    }
  }
}

/** ------------------------------------------------------------------ */
/*  Evidence Capture Service                                          */
/** ------------------------------------------------------------------ */

import type { ValidationResult as ValidationCheckResult } from '@heynxt/core-types';

export interface EvidenceCaptureService {
  /** Create validation run record and store all evidence artifacts. */
  captureValidationRun(runId: string, results: ValidationCheckResult[], metadata?: Record<string, unknown>): Promise<StoredValidationRun>;

  /** Retrieve a stored validation run by ID. */
  getValidationRun(runId: string): Promise<StoredValidationRun | null>;

  /** List all validation runs with optional filtering. */
  listValidationRuns(filters?: { checkType?: 'lint' | 'typecheck' | 'tests'; status?: 'passed' | 'failed' }): Promise<StoredValidationRun[]>;
}

/** Stored validation run with all evidence artifacts resolved. */
export interface StoredValidationRun {
  id: string;
  generationRunId: string;
  results: Array<{ result: ValidationCheckResult & { isFreshEvidence?: boolean }; evidenceArtifacts: EvidenceArtifact[] }>;
  metadata?: Record<string, unknown>;
  createdAt: Date;
}

/** Global storage instance (singleton). */
let _storageInstance: LocalEvidenceStorage | null = null;
let _captureServiceInstance: EvidenceCaptureService | null = null;

export function getEvidenceStorage(): EvidenceStorage {
  if (!_storageInstance) {
    _storageInstance = new LocalEvidenceStorage();
  }
  return _storageInstance;
}

/** Main evidence capture service for validation runs. */
export class DefaultEvidenceCaptureService implements EvidenceCaptureService {
  private storage: EvidenceStorage;

  constructor(storage?: EvidenceStorage) {
    this.storage = storage ?? getEvidenceStorage();
  }

  async captureValidationRun(
    runId: string,
    results: ValidationCheckResult[],
    metadata?: Record<string, unknown>
  ): Promise<StoredValidationRun> {
    const now = new Date();
    const storedResults: Array<{ result: ValidationCheckResult & { isFreshEvidence: boolean }; evidenceArtifacts: EvidenceArtifact[] }> = [];

    for (const result of results) {
      // Create evidence artifacts for each validation check
      const artifactDefinitions = await this.createEvidenceArtifacts(runId, result);

      // Store each artifact and collect the stored references
      const storedPromises: Promise<EvidenceArtifact>[] = [];
      for (const artifactDef of artifactDefinitions) {
        if (!artifactDef) continue;
        storedPromises.push(
          this.storage.store(JSON.stringify(artifactDef), 'log-file').then(stored => ({ ...stored, id: artifactDef.id }))
        );
      }

      const evidenceArtifacts = await Promise.all(storedPromises);

      // Add isFreshEvidence flag to result for metadata tracking
      const enrichedResult: ValidationCheckResult & { isFreshEvidence: boolean } = { ...result, isFreshEvidence: true };
      storedResults.push({ result: enrichedResult, evidenceArtifacts });
    }

    const storedRun: StoredValidationRun = {
      id: runId,
      generationRunId: '', // Will be set by caller if needed
      results: storedResults,
      metadata,
      createdAt: now,
    };

    // Persist run metadata (not full content for immutability)
    await this.persistRunMetadata(runId, storedRun);

    return storedRun;
  }

  private async createEvidenceArtifacts(
    runId: string,
    result: ValidationCheckResult
  ): Promise<ValidationEvidence[]> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');

    // Log file evidence for the check output
    const logFileArtifact: ValidationEvidence = {
      id: crypto.randomUUID(),
      validationRunId: runId,
      checkType: result.checkType as any,
      kind: 'log-file',
      storagePath: `validation/${result.checkType}/${timestamp}-${result.id}-output.json`,
      fileSizeBytes: Buffer.byteLength(result.outputLog ?? '{}'),
      contentHash: crypto.createHash('sha256').update(result.outputLog ?? '{}').digest('hex').slice(0, 16),
      isFreshEvidence: true,
      createdAt: new Date(),
    };

    // Test report evidence for the summary
    const reportArtifact: ValidationEvidence = {
      id: crypto.randomUUID(),
      validationRunId: runId,
      checkType: result.checkType as any,
      kind: 'test-report',
      storagePath: `validation/${result.checkType}/${timestamp}-${result.id}-summary.json`,
      fileSizeBytes: Buffer.byteLength(JSON.stringify(result)),
      contentHash: crypto.createHash('sha256').update(JSON.stringify(result)).digest('hex').slice(0, 16),
      isFreshEvidence: true,
      createdAt: new Date(),
    };

    return [logFileArtifact, reportArtifact];
  }

  async getValidationRun(runId: string): Promise<StoredValidationRun | null> {
    const metadataPath = path.join(DEFAULT_BASE_PATH, `validation-runs/${runId}.json`);

    if (!fs.existsSync(metadataPath)) {
      return null;
    }

    const content = fs.readFileSync(metadataPath, 'utf-8');
    const data: StoredValidationRun = JSON.parse(content);

    // Resolve evidence artifacts from storage (no full content for immutability)
    for (const storedResult of data.results) {
      for (const artifact of storedResult.evidenceArtifacts) {
        try {
          await this.storage.retrieve(artifact.storagePath);
          // Artifact resolved successfully - keep metadata only
        } catch (err) {
          console.warn(`Failed to retrieve evidence for ${artifact.storagePath}:`, err);
        }
      }
    }

    return data;
  }

  async listValidationRuns(filters?: { checkType?: 'lint' | 'typecheck' | 'tests'; status?: 'passed' | 'failed' }): Promise<StoredValidationRun[]> {
    const runsDir = path.join(DEFAULT_BASE_PATH, 'validation-runs');

    if (!fs.existsSync(runsDir)) {
      return [];
    }

    const files = fs.readdirSync(runsDir).filter(f => f.endsWith('.json'));
    const allRuns: StoredValidationRun[] = [];

    for (const file of files) {
      const runId = file.replace('.json', '');
      const run = await this.getValidationRun(runId);
      if (run) {
        allRuns.push(run);
      }
    }

    // Apply filters
    if (filters) {
      return allRuns.filter(run => {
        if (!filters.checkType && !filters.status) return true;

        const matchesCheckType = filters.checkType
          ? run.results.some(r => r.result.checkType === filters.checkType)
          : true;

        const matchesStatus = filters.status
          ? run.results.some(r => r.result.status === filters.status)
          : true;

        return matchesCheckType && matchesStatus;
      });
    }

    return allRuns.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  private async persistRunMetadata(runId: string, run: StoredValidationRun): Promise<void> {
    const metadataPath = path.join(DEFAULT_BASE_PATH, `validation-runs/${runId}.json`);
    fs.mkdirSync(path.dirname(metadataPath), { recursive: true });

    // Store minimal metadata (no full content for immutability)
    const hasFreshEvidence = run.results.some(
      r => 'isFreshEvidence' in r.result && r.result.isFreshEvidence === true
    );

    const metadata = {
      id: run.id,
      generationRunId: run.generationRunId,
      resultsCount: run.results.length,
      createdAt: run.createdAt.toISOString(),
      hasFreshEvidence,
    };

    fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2));
  }
}

export function getEvidenceCaptureService(): EvidenceCaptureService {
  if (!_captureServiceInstance) {
    _captureServiceInstance = new DefaultEvidenceCaptureService();
  }
  return _captureServiceInstance;
}
