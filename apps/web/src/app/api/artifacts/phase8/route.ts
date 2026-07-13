/**
 * /api/artifacts/phase8 — File/Evidence Service API (Phase 8)
 * Content-addressable artifact storage and verification.
 *
 *   POST   /api/artifacts/phase8/upload
 *     Upload a new artifact with content-addressable storage using SHA-256 hashing.
 *     Body: { kind, name, data (base64), generationRunId?, metadata? }
 *     Returns the stored artifact with hash verification info.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createHash } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { z } from 'zod';

import { db, artifacts as fileEvidenceArtifactsTable } from '@heynxt/persistence';

import { badRequest, errorResponse, parseJsonBody } from '@/lib/api';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/** Zod schema for artifact kinds */
const ArtifactKindEnum = z.enum(['code', 'log', 'diff', 'report', 'evidence', 'attachment']);
type ArtifactKind = z.infer<typeof ArtifactKindEnum>;

/** Zod schema for uploading an artifact. */
const UploadArtifactInput = z.object({
  kind: ArtifactKindEnum,
  name: z.string().min(1).max(256),
  data: z.string(), // Base64 encoded content
  generationRunId: z.string().uuid().optional(),
  workspaceId: z.string().uuid(), // Required for this table schema
  projectId: z.string().uuid(), // Required for this table schema
  taskId: z.string().uuid().optional(), // Optional FK to tasks
  metadata: z.record(z.unknown()).optional(),
});

type UploadArtifactInput = z.infer<typeof UploadArtifactInput>;

// ---------------------------------------------------------------------------
// POST /api/artifacts/phase8/upload
// ---------------------------------------------------------------------------

export async function POST(req: NextRequest) {
  try {
    const input = UploadArtifactInput.parse(await parseJsonBody(req));

    if (!input.data || typeof input.data !== 'string') {
      throw badRequest('Base64 encoded data is required');
    }

    const now = new Date();

    // Decode base64 and compute content hash (content-addressable storage)
    let decodedData: Buffer;
    try {
      decodedData = Buffer.from(input.data, 'base64');
    } catch (decodeErr) {
      throw badRequest('Invalid base64 data');
    }

    const contentHash = createHash('sha256').update(decodedData).digest('hex');

    // Check for duplicate artifact (same hash = same content)
    const [existing] = await db.select({ id: fileEvidenceArtifactsTable.id, byteSize: fileEvidenceArtifactsTable.byteSize }).from(fileEvidenceArtifactsTable).where(eq(fileEvidenceArtifactsTable.contentHash, contentHash)).limit(1);

    if (existing) {
      return NextResponse.json({
        artifact: {
          kind: input.kind,
          name: input.name,
          sizeBytes: existing.byteSize ?? 0,
          contentHash,
          generationRunId: input.generationRunId,
          isDuplicate: true,
        },
        message: 'Artifact already exists (same content)',
      });
    }

    // Generate unique storage key for content-addressable storage
    const storageLocation = `artifacts/${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, '0')}/${contentHash}`;

    // Determine MIME type based on artifact kind and file extension
    function getMimeType(kind: ArtifactKind): string {
      switch (kind) {
        case 'code': return 'application/x-typescript';
        case 'log': return 'text/plain';
        case 'diff': return 'text/x-diff';
        case 'report': return 'application/json';
        default: return 'application/octet-stream';
      }
    }

    const mimeType = getMimeType(input.kind);

    // Insert the artifact record with minimal metadata (immutability)
    const result = await db.insert(fileEvidenceArtifactsTable).values({
      workspaceId: input.workspaceId,
      projectId: input.projectId,
      taskId: input.taskId ?? null,
      generationRunId: input.generationRunId || '',
      kind: input.kind,
      storageKind: 'inline', // Default to inline for now
      name: input.name,
      mimeType,
      textContent: input.data, // Store base64 content inline
      byteSize: decodedData.length,
      contentHash,
      createdBy: 'system', // TODO: Get from auth context
      createdAt: now,
    }).returning({
      id: fileEvidenceArtifactsTable.id,
      name: fileEvidenceArtifactsTable.name,
      mimeType: fileEvidenceArtifactsTable.mimeType,
      byteSize: fileEvidenceArtifactsTable.byteSize,
      contentHash: fileEvidenceArtifactsTable.contentHash,
    }).then(r => r[0]);

    if (!result) {
      throw new Error('INSERT returned zero rows');
    }

    return NextResponse.json({
      artifact: {
        id: result.id,
        kind: input.kind,
        name: result.name,
        mimeType: result.mimeType,
        sizeBytes: result.byteSize ?? 0,
        contentHash: result.contentHash,
        storageLocation,
        generationRunId: input.generationRunId,
      },
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return errorResponse(badRequest(err.errors[0]?.message ?? 'Invalid request'));
    }
    return errorResponse(err);
  }
}

/** Helper to determine content type based on artifact kind. */
function getContentType(kind: ArtifactKind): string {
  switch (kind) {
    case 'code':
      return 'application/x-typescript';
    case 'log':
      return 'text/plain';
    case 'diff':
      return 'text/x-diff';
    case 'report':
      return 'application/json';
    case 'evidence':
      return 'application/octet-stream';
    default:
      return 'application/octet-stream';
  }
}
