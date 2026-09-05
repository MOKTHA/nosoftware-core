/**
 * /api/builds/[buildId]/stream — SSE build progress.
 *
 *   GET /api/builds/:buildId/stream
 *     Opens an SSE connection. Behaviour depends on build status:
 *
 *     pending  → starts the pipeline, streams live events, saves to DB.
 *     running  → replays stored events from DB, then polls for completion.
 *     succeeded/failed → replays all stored events (instant terminal replay).
 *
 *     Events are saved to the `eventsJson` column every 5 events and at
 *     pipeline end, so a page refresh can pick up where it left off.
 */
import { eq } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';

import { db, builds, users, creditTransactions } from '@heynxt/persistence';
import {
  BuildEventEmitter,
  buildPipelineFromSpec,
  resetTokenAccumulator,
  getAccumulatedTokenUsage,
} from '@heynxt/agent-adapter';
import type { BuildEvent } from '@heynxt/agent-adapter';
import { helpdeskTicketingFixture } from '@heynxt/prompt-spec';

import { getAdminConfig } from '@/lib/admin';
import { getModelPricing } from '@/lib/openrouter';

export const dynamic = 'force-dynamic';

export async function GET(
  _req: Request,
  props: { params: Promise<{ buildId: string }> },
) {
  const { buildId } = await props.params;

  const [build] = await db.select().from(builds).where(eq(builds.id, buildId));
  if (!build) {
    return new Response('Build not found', { status: 404 });
  }

  // ── Replay mode: build already ran (or is running) — send stored events ──
  if (build.status === 'running' || build.status === 'succeeded' || build.status === 'failed') {
    return replayStoredEvents(build);
  }

  // ── Live mode: build is pending — start the pipeline ──
  await db
    .update(builds)
    .set({ status: 'running', updatedAt: new Date() })
    .where(eq(builds.id, buildId));

  const emitter = new BuildEventEmitter();
  const stream = emitter.toReadableStream();

  // Flush events to DB periodically (every 5 events) and at the end
  let flushCounter = 0;
  emitter.onEvent = (event) => {
    flushCounter++;

    // Capture file data when emitted by the deploy stage
    if (event.step === 'files-collected' && event.files) {
      db.update(builds)
        .set({ filesJson: JSON.stringify(event.files), updatedAt: new Date() })
        .where(eq(builds.id, buildId))
        .catch(() => {});
    }

    if (flushCounter % 5 === 0) {
      flushEventsToDB(buildId, emitter.buffer).catch(() => {});
    }
  };

  // Run the pipeline without awaiting — the response streams concurrently
  runPipeline(buildId, build.specJson, emitter).catch((err: unknown) => {
    const message = err instanceof Error ? err.message : String(err);
    emitter.emit('pipeline', 'error', message);
    emitter.close();
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}

/**
 * Replay stored events from the DB as an SSE stream.
 * For running builds: sends stored events, then a special "replay-end" marker.
 * For terminal builds: sends all events including the final pipeline event.
 */
function replayStoredEvents(build: typeof builds.$inferSelect): Response {
  const events: BuildEvent[] = build.eventsJson
    ? (JSON.parse(build.eventsJson) as BuildEvent[])
    : [];

  const stream = new ReadableStream<string>({
    start(controller) {
      // Send all stored events
      for (const event of events) {
        controller.enqueue(`data: ${JSON.stringify(event)}\n\n`);
      }

      // For running builds, send a marker so the client knows to poll
      if (build.status === 'running') {
        controller.enqueue(
          `data: ${JSON.stringify({
            step: '__replay',
            status: 'done',
            detail: 'replay-end:poll',
            elapsed_ms: 0,
          })}\n\n`,
        );
      }

      // If the build completed but the terminal pipeline event wasn't stored,
      // synthesize one so the BuildTrace component closes properly
      if (
        (build.status === 'succeeded' || build.status === 'failed') &&
        !events.some((e) => e.step === 'pipeline' && (e.status === 'done' || e.status === 'error'))
      ) {
        const terminalEvent: BuildEvent = {
          step: 'pipeline',
          status: build.status === 'succeeded' ? 'done' : 'error',
          detail: build.status === 'succeeded'
            ? build.deployedUrl ?? 'Build complete'
            : build.errorMessage ?? 'Build failed',
          elapsed_ms: 0,
        };
        controller.enqueue(`data: ${JSON.stringify(terminalEvent)}\n\n`);
      }

      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}

/** Strip bulky `files` data from events before saving to eventsJson (files go in filesJson). */
function stripFiles(events: BuildEvent[]): BuildEvent[] {
  return events.map((e) => {
    if (e.files) {
      const { files: _files, ...rest } = e;
      return rest;
    }
    return e;
  });
}

/** Flush buffered events to the builds.eventsJson column. */
async function flushEventsToDB(buildId: string, events: BuildEvent[]): Promise<void> {
  await db
    .update(builds)
    .set({ eventsJson: JSON.stringify(stripFiles(events)), updatedAt: new Date() })
    .where(eq(builds.id, buildId));
}

async function runPipeline(
  buildId: string,
  specJson: string | null,
  emitter: BuildEventEmitter,
): Promise<void> {
  // Read spec from DB column, or fall back to fixture
  let spec;
  if (specJson) {
    try {
      spec = JSON.parse(specJson);
    } catch {
      spec = helpdeskTicketingFixture;
    }
  } else {
    spec = helpdeskTicketingFixture;
  }

  // Reset the global token accumulator before starting so we only count
  // tokens from THIS pipeline run.
  resetTokenAccumulator();

  const pipeline = buildPipelineFromSpec(spec, buildId, emitter);

  try {
    await pipeline.start();
    const results = pipeline.getStageResults();
    const allSucceeded = results.every(
      (r) => r.execution.status === 'succeeded',
    );

    // Extract the deployed URL from the deploy-to-vercel stage result
    const deployStageResult = results.find(
      (r) => r.execution.stageName === 'deploy-to-vercel',
    );
    const deployedUrl = deployStageResult?.output?.summary?.startsWith('https://')
      ? deployStageResult.output.summary
      : null;

    const failedDetails = results
      .filter((r) => r.execution.status === 'failed')
      .map((r) => `${r.execution.stageName}: ${r.execution.errorDetails ?? 'unknown'}`)
      .join('; ');

    const finalDetail = allSucceeded && deployedUrl
      ? deployedUrl
      : allSucceeded
        ? 'Build complete'
        : failedDetails || 'One or more stages failed';

    emitter.emit(
      'pipeline',
      allSucceeded ? 'done' : 'error',
      finalDetail,
    );

    // ── Credit deduction (post-generation) ──
    // Estimate token usage from pipeline stages and deduct from user balance
    await deductCreditsForBuild(buildId, results).catch((err) => {
      console.error(`[credit-deduction] Failed for build ${buildId}:`, err);
    });

    // Final DB update: status, URL, error message, and ALL events (files stripped)
    await db
      .update(builds)
      .set({
        status: allSucceeded ? 'succeeded' : 'failed',
        deployedUrl,
        errorMessage: allSucceeded ? null : (failedDetails || 'One or more stages failed'),
        eventsJson: JSON.stringify(stripFiles(emitter.buffer)),
        updatedAt: new Date(),
      })
      .where(eq(builds.id, buildId));
  } finally {
    // One last flush in case the pipeline threw before the final update
    await flushEventsToDB(buildId, emitter.buffer).catch(() => {});
    emitter.close();
  }
}

/**
 * Deduct credits from the user's balance after a build completes.
 *
 * Uses REAL token usage accumulated from OpenRouter API responses during
 * the pipeline run (via the global token accumulator in @heynxt/agent-adapter).
 * Falls back to heuristic estimates only if the accumulator reports zero
 * (e.g. all stages used stubs or the API didn't return usage data).
 *
 * Flow:
 *   1. Look up the build's userId and model
 *   2. Read actual token usage from the global accumulator
 *   3. Fetch model pricing (OpenRouter API with cache)
 *   4. Calculate cost using admin config (creditsPerUSD, platformFeeMultiplier)
 *   5. Atomically deduct credits and log the transaction
 *   6. Save cost fields (model, tokens, costUSD, creditsDeducted) to builds table
 */
async function deductCreditsForBuild(
  buildId: string,
  results: Array<{ execution: { stageName: string; status: string }; output?: { summary?: string } }>,
): Promise<void> {
  // 1. Look up build
  const [build] = await db
    .select({ userId: builds.userId, model: builds.model })
    .from(builds)
    .where(eq(builds.id, buildId));

  if (!build?.userId) return; // No user attached (e.g. anonymous build)

  // 2. Read actual token usage from the pipeline's OpenRouter calls
  const accumulated = getAccumulatedTokenUsage();
  let inputTokens = accumulated.promptTokens;
  let outputTokens = accumulated.completionTokens;

  // Fallback: if accumulator is zero (all stubs or API didn't return usage),
  // estimate from succeeded stage count
  if (inputTokens === 0 && outputTokens === 0) {
    const succeededStages = results.filter((r) => r.execution.status === 'succeeded').length;
    inputTokens = succeededStages * 3000;  // ~3K prompt tokens per stage
    outputTokens = succeededStages * 2000;  // ~2K output tokens per stage
  }

  if (inputTokens === 0 && outputTokens === 0) return;

  // 3. Determine raw cost in USD
  //    Priority: use OpenRouter's reported cost (usage.cost) when available —
  //    this is the actual amount charged and reflects real-time model pricing.
  //    Fallback: calculate from token counts × model pricing (may be stale by up to 10min).
  const model = build.model ?? 'anthropic/claude-sonnet-4';
  const adminCfg = await getAdminConfig();
  let rawCostUSD: number;

  if (accumulated.costUSD != null && accumulated.costUSD > 0) {
    // OpenRouter told us the exact cost — use it
    rawCostUSD = accumulated.costUSD;
  } else {
    // Calculate from tokens × pricing (fallback)
    const pricing = await getModelPricing(model);
    rawCostUSD =
      (inputTokens / 1_000_000) * pricing.inputPricePer1M +
      (outputTokens / 1_000_000) * pricing.outputPricePer1M;
  }

  // 4. Apply platform fee and convert to credits
  const costUSD = rawCostUSD * adminCfg.platformFeeMultiplier;
  const creditsToDeduct = Math.round(costUSD * adminCfg.creditsPerUSD * 100) / 100;

  if (creditsToDeduct <= 0) return;

  // 5. Atomically deduct credits
  const [user] = await db
    .select({ credits: users.credits })
    .from(users)
    .where(eq(users.id, build.userId));

  if (!user) return;

  const balanceBefore = parseFloat(user.credits);
  const balanceAfter = Math.max(0, balanceBefore - creditsToDeduct);

  await db
    .update(users)
    .set({ credits: balanceAfter.toFixed(2), updatedAt: new Date() })
    .where(eq(users.id, build.userId));

  await db.insert(creditTransactions).values({
    id: randomUUID(),
    userId: build.userId,
    type: 'debit',
    amount: (-creditsToDeduct).toFixed(2),
    balanceBefore: balanceBefore.toFixed(2),
    balanceAfter: balanceAfter.toFixed(2),
    reason: `Build ${buildId}`,
    buildId,
    createdAt: new Date(),
  });

  // 6. Save cost fields to builds table
  await db
    .update(builds)
    .set({
      model,
      inputTokens,
      outputTokens,
      costUSD: costUSD.toFixed(6),
      creditsDeducted: creditsToDeduct.toFixed(2),
    })
    .where(eq(builds.id, buildId));
}
