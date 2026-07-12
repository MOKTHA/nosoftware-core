/**
 * /api/validation-runs — Validation Runs API (Phase 7.3)
 *
 *   GET    /api/validation-runs?generationRunId=<uuid>&[checkType=lint|typecheck|tests]&[status=passed|failed]
 *     List validation runs, optionally filtered by generation run or check type/status.
 *     Returns array of stored validation runs with metadata.
 *
 *   POST   /api/validation-runs
 *     Create a new validation run record and store evidence artifacts.
 *     Body: CreateValidationRunInput.
 *       { generationRunId, results[], metadata? }
 *     Returns 201 with the created validation run.
 *     401 when not authenticated.
 */

import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';
import { eq, and, sql } from 'drizzle-orm';
import { z } from 'zod';

import { db, validationRuns, validationResults, generationRuns } from '@heynxt/persistence';
import { getEvidenceCaptureService } from '@heynxt/agent-adapter';

import { badRequest, errorResponse, parseJsonBody } from '@/lib/api';
import { insertAuditEntry } from '@/lib/audit';
import { requireAuth } from '@/lib/session';
import { requirePermission } from '@/lib/rbac';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/** Zod schema for creating a validation run. */
const CreateValidationRunInput = z.object({
  generationRunId: z.string().uuid(),
  results: z.array(z.object({
    id: z.string().uuid(),
    checkType: z.enum(['lint', 'typecheck', 'unit-tests', 'integration-tests', 'smoke-tests', 'build', 'routes', 'api-smoke', 'permissions-check', 'migration-verify', 'route-smoke']),
    status: z.enum(['passed', 'failed', 'skipped']),
    completedAt: z.coerce.date(),
    startedAt: z.coerce.date(),
    durationMs: z.number().int().nonnegative(),
    evidenceUrl: z.string().url(),
    outputLog: z.string().nullish(),
    testSummary: z.string().nullish(),
    issueCount: z.number().int().nonnegative(),
    blocksPromotion: z.boolean().default(false),
  })),
  metadata: z.record(z.unknown()).optional(),
});

type CreateValidationRunInput = z.infer<typeof CreateValidationRunInput>;

/** Zod schema for query parameters. */
const ValidationRunsQueryParams = z.object({
  generationRunId: z.string().uuid().optional(),
  checkType: z.enum(['lint', 'typecheck', 'tests', 'migrations', 'build', 'routes', 'api', 'permissions']).optional(),
  status: z.enum(['passed', 'failed']).optional(),
});

// ---------------------------------------------------------------------------
// GET /api/validation-runs?generationRunId=<uuid>&[checkType=...][&status=...]
// ---------------------------------------------------------------------------

export async function GET(req: NextRequest) {
  try {
    const session = await requireAuth();
    const userId = session.user.id;

    // Parse query parameters
    const params = ValidationRunsQueryParams.parse({
      generationRunId: req.nextUrl.searchParams.get('generationRunId') ?? undefined,
      checkType: req.nextUrl.searchParams.get('checkType') as any ?? undefined,
      status: req.nextUrl.searchParams.get('status') as any ?? undefined,
    });

    // Build where conditions
    const conditions = [];

    if (params.generationRunId) {
      conditions.push(eq(validationRuns.generationRunId, params.generationRunId));
    } else {
      throw badRequest('`generationRunId` query parameter is required');
    }

    // Filter by check type and status at DB level for efficiency
    if (params.checkType || params.status) {
      const subConditions = [];

      if (params.checkType) {
        subConditions.push(eq(validationResults.checkType, params.checkType));
      }

      if (params.status) {
        subConditions.push(eq(validationResults.status, params.status as any));
      }

      conditions.push(
        sql`${validationResults.validationRunId} IN (
          SELECT vr.id FROM ${validationRuns} v
          JOIN ${validationResults} vr ON vr.validationRunId = v.id
          WHERE ${eq(validationRuns.generationRunId, params.generationRunId)}
            AND (${subConditions.length > 0 ? and(...(subConditions as any)) : 'true'})
        )`
      );
    }

    const where = conditions.length === 1 ? conditions[0] : and(...conditions);

    // Fetch validation runs with results joined
    const rows = await db
      .select({
        id: validationRuns.id,
        generationRunId: validationRuns.generationRunId,
        status: validationRuns.status,
        createdAt: validationRuns.createdAt,
        updatedAt: validationRuns.updatedAt,
        checkType: validationResults.checkType,
        resultStatus: validationResults.status as any,
      })
      .from(validationRuns)
      .innerJoin(
        validationResults,
        sql`${validationRuns.id} = ${validationResults.validationRunId}`
      )
      .where(where);

    // Group results by validation run ID
    const grouped: Record<string, any> = {};

    for (const row of rows) {
      if (!grouped[row.id]) {
        grouped[row.id] = {
          id: row.id,
          generationRunId: row.generationRunId,
          status: row.status,
          createdAt: row.createdAt,
          updatedAt: row.updatedAt,
          results: [],
        };
      }

      grouped[row.id].results.push({
        checkType: row.checkType,
        status: row.resultStatus,
      });
    }

    const validationRunsList = Object.values(grouped);

    return NextResponse.json(
      { validationRuns: validationRunsList },
      { status: 200 }
    );
  } catch (err) {
    if (err instanceof z.ZodError) {
      return errorResponse(badRequest(err.errors[0].message));
    }
    return errorResponse(err);
  }
}

// ---------------------------------------------------------------------------
// POST /api/validation-runs
// ---------------------------------------------------------------------------

export async function POST(req: NextRequest) {
  try {
    const session = await requireAuth();
    const createdBy = session.user.id;

    // Parse request body
    const input = CreateValidationRunInput.parse(await parseJsonBody(req));

    // Validate generation run exists and user has permission
    const genRunsExists = await db
      .select({ id: 1 })
      .from(validationResults)
      .innerJoin(
        validationRuns,
        sql`${validationResults.validationRunId} = ${validationRuns.id}`
      )
      .where(eq(validationRuns.generationRunId, input.generationRunId))
      .limit(1);

    if (genRunsExists.length === 0) {
      // Check generation run directly via Drizzle table
      const genRunExists = await db
        .select({ id: 1 })
        .from(generationRuns)
        .where(eq(generationRuns.id, input.generationRunId))
        .limit(1);

      if (genRunExists.length === 0) {
        return errorResponse(badRequest(`Generation run ${input.generationRunId} not found`));
      }
    }

    const now = new Date();
    const validationRunId = randomUUID();

    // Store evidence artifacts using the capture service
    const captureService = getEvidenceCaptureService();
    await captureService.captureValidationRun(validationRunId, input.results, input.metadata);

    // Persist to database (minimal metadata for immutability)
    const [created] = await db
      .insert(validationRuns)
      .values({
        id: validationRunId,
        generationRunId: input.generationRunId,
        status: 'completed',
        createdBy,
        createdAt: now,
        updatedAt: now,
      })
      .returning();

    if (!created) {
      throw new Error('INSERT returned zero rows');
    }

    // Insert validation results (one per check result)
    const resultInserts = input.results.map((result): StoredValidationCheckResult => ({
      ...result,
      evidenceUrl: result.evidenceUrl,
      outputLog: result.outputLog ?? null,
      testSummary: result.testSummary ?? null,
      issueCount: result.issueCount ?? 0,
      blocksPromotion: result.blocksPromotion ?? false,
    })).map(result => ({
      validationRunId: created.id,
      id: randomUUID(),
      checkType: result.checkType as ValidationCheckType,
      status: result.status as 'passed' | 'failed',
      evidenceUrl: result.evidenceUrl,
      outputLog: result.outputLog ?? null,
      testSummary: result.testSummary ?? null,
      issueCount: result.issueCount ?? 0,
      blocksPromotion: result.blocksPromotion ?? false,
    }));

    await db.insert(validationResults).values(resultInserts);

    // Record in audit log (best-effort)
    try {
      await insertAuditEntry({
        workspaceId: session.user.workspaceId,
        entityType: 'validation-run',
        entityId: created.id,
        action: 'created',
        actorId: createdBy,
        after: {
          id: created.id,
          generationRunId: input.generationRunId,
          status: 'completed',
        },
      });
    } catch (auditErr) {
      console.warn('Failed to record audit entry for validation run:', auditErr);
    }

    return NextResponse.json(
      {
        validationRun: {
          id: created.id,
          generationRunId: input.generationRunId,
          status: 'completed',
          createdAt: now,
          updatedAt: now,
          resultsCount: input.results.length,
        },
      },
      { status: 201 }
    );
  } catch (err) {
    if (err instanceof z.ZodError) {
      return errorResponse(badRequest(err.errors[0].message));
    }
    return errorResponse(err);
  }
}
