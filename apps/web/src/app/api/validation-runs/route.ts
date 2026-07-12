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

import { db, validationRuns, validationResults as vrTable, generationRuns } from '@heynxt/persistence';
import { getEvidenceCaptureService } from '@heynxt/agent-adapter';
import { ValidationRunResult } from '@heynxt/core-types';

import { badRequest, errorResponse, parseJsonBody } from '@/lib/api';
import { insertAuditEntry } from '@/lib/audit';
import { requireAuth } from '@/lib/session';
import { requirePermission } from '@/lib/rbac';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/** Zod schema for creating a validation run. */
const CreateValidationRunInput = z.object({
  generationRunId: z.string().uuid(),
  results: z.array(ValidationRunResult),
  metadata: z.record(z.unknown()).optional(),
});

type CreateValidationRunInput = z.infer<typeof CreateValidationRunInput>;

/** Zod schema for query parameters. */
const ValidationRunsQueryParams = z.object({
  generationRunId: z.string().uuid().optional(),
  checkType: z.enum(['lint', 'typecheck', 'unit-tests', 'integration-tests', 'smoke-tests', 'migration-verify', 'build', 'route-smoke', 'api-smoke', 'permissions-check', 'pr-creation']).optional(),
  status: z.enum(['passed', 'failed', 'skipped']).optional(),
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
        subConditions.push(eq(vrTable.checkType, params.checkType));
      }

      if (params.status) {
        subConditions.push(eq(vrTable.status, params.status as any));
      }

      conditions.push(
        sql`${vrTable.validationRunId} IN (
          SELECT vr.id FROM ${validationRuns} v
          JOIN ${vrTable} vr ON vr.validationRunId = v.id
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
        checkType: vrTable.checkType,
        resultStatus: vrTable.status as any,
      })
      .from(validationRuns)
      .innerJoin(
        vrTable,
        sql`${validationRuns.id} = ${vrTable.validationRunId}`
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
      return errorResponse(badRequest(err.errors[0]?.message ?? 'Invalid request'));
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

    // Validate generation run exists and get its workspace ID
    const genRunsList = await db
      .select({ id: generationRuns.id, workspaceId: generationRuns.workspaceId })
      .from(generationRuns)
      .where(eq(generationRuns.id, input.generationRunId))
      .limit(1);

    if (genRunsList.length === 0) {
      return errorResponse(badRequest(`Generation run ${input.generationRunId} not found`));
    }

    const genRunData = genRunsList[0];
    if (!genRunData?.workspaceId) {
      throw new Error('Generation run missing workspace ID');
    }

    const workspaceId = genRunData.workspaceId;
    if (!workspaceId) {
      throw new Error('Generation run missing workspace ID');
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
        workspaceId,
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
    const resultInserts = input.results.map(result => {
      const validatedCheckType = result.checkType as 'lint' | 'typecheck' | 'unit-tests' | 'integration-tests' | 'smoke-tests' | 'migration-verify' | 'build' | 'route-smoke' | 'api-smoke' | 'permissions-check' | 'pr-creation';
      return {
        validationRunId: created.id,
        id: randomUUID(),
        checkType: validatedCheckType,
        status: result.status as 'passed' | 'failed',
        evidenceUrl: result.evidenceUrl,
        outputLog: result.outputLog ?? null,
        testSummary: result.testSummary ?? null,
        issueCount: result.issueCount ?? 0,
        blocksPromotion: result.blocksPromotion ?? false,
        createdAt: now,
      };
    });

    await db.insert(vrTable).values(resultInserts);

    // Record in audit log (best-effort)
    try {
      await insertAuditEntry({
        workspaceId: workspaceId!,
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
      return errorResponse(badRequest(err.errors[0]?.message ?? 'Invalid request'));
    }
    return errorResponse(err);
  }
}
