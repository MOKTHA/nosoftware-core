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
    const [existing] = await db.select({ id: fileEvidenceArtifactsTable.id }).from(fileEvidenceArtifactsTable).where(eq(fileEvidenceArtifactsTable.contentHash, contentHash)).limit(1);

    if (existing) {
      return NextResponse.json({
        artifact: {
          kind: input.kind,
          name: input.name,
          sizeBytes: decodedData.length,
          contentHash,
          generationRunId: input.generationRunId,
          isDuplicate: true,
        },
        message: 'Artifact already exists (same content)',
      });
    }

    // Generate unique storage key for content-addressable storage
    const storageLocation = `artifacts/${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, '0')}/${contentHash}`;

    // Insert the artifact record with minimal metadata (immutability)
    const [created] = await db.insert(fileEvidenceArtifactsTable).values({
      id: crypto.randomUUID(),
      name: input.name,
      description: null,
      contentType: getContentType(input.kind),
      sizeBytes: decodedData.length,
      contentHash,
      storageType: 'local', // Default to local for now
      storageLocation, // In production, this would be S3/GCS blob path
      evidenceType: input.kind === 'evidence' ? 'custom' : undefined,
      relatedGenerationRunId: input.generationRunId || null,
    }).returning();

    if (!created) {
      throw new Error('INSERT returned zero rows');
    }

    return NextResponse.json({
      artifact: {
        id: created.id,
        kind: input.kind,
        name: created.name,
        contentType: created.contentType,
        sizeBytes: created.sizeBytes,
        contentHash: created.contentHash,
        storageLocation: created.storageLocation,
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
