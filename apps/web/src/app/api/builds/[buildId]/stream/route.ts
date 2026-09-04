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

import { db, builds } from '@heynxt/persistence';
import { BuildEventEmitter, buildPipelineFromSpec } from '@heynxt/agent-adapter';
import type { BuildEvent } from '@heynxt/agent-adapter';
import { helpdeskTicketingFixture } from '@heynxt/prompt-spec';

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
  emitter.onEvent = () => {
    flushCounter++;
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

/** Flush buffered events to the builds.eventsJson column. */
async function flushEventsToDB(buildId: string, events: BuildEvent[]): Promise<void> {
  await db
    .update(builds)
    .set({ eventsJson: JSON.stringify(events), updatedAt: new Date() })
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

    // Final DB update: status, URL, error message, and ALL events
    await db
      .update(builds)
      .set({
        status: allSucceeded ? 'succeeded' : 'failed',
        deployedUrl,
        errorMessage: allSucceeded ? null : (failedDetails || 'One or more stages failed'),
        eventsJson: JSON.stringify(emitter.buffer),
        updatedAt: new Date(),
      })
      .where(eq(builds.id, buildId));
  } finally {
    // One last flush in case the pipeline threw before the final update
    await flushEventsToDB(buildId, emitter.buffer).catch(() => {});
    emitter.close();
  }
}
