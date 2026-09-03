/**
 * /api/builds/[buildId]/stream — SSE build progress (Phase 5).
 *
 *   GET /api/builds/:buildId/stream
 *     Opens an SSE connection and starts the pipeline. Streams structured
 *     BuildEvent objects as `data: {...}\n\n` lines until the build
 *     completes or fails, then closes.
 *
 *     409 if the build is already running.
 *     410 if the build already completed.
 *     404 if the buildId is unknown.
 */
import { eq } from 'drizzle-orm';

import { db, builds } from '@heynxt/persistence';
import { BuildEventEmitter, buildPipelineFromSpec } from '@heynxt/agent-adapter';
import { helpdeskTicketingFixture } from '@heynxt/prompt-spec';

export const dynamic = 'force-dynamic';

export async function GET(
  _req: Request,
  { params }: { params: { buildId: string } },
) {
  const { buildId } = params;

  const [build] = await db.select().from(builds).where(eq(builds.id, buildId));
  if (!build) {
    return new Response('Build not found', { status: 404 });
  }
  if (build.status === 'running') {
    return new Response('Build already running', { status: 409 });
  }
  if (build.status === 'succeeded' || build.status === 'failed') {
    return new Response('Build already complete', { status: 410 });
  }

  await db
    .update(builds)
    .set({ status: 'running', updatedAt: new Date() })
    .where(eq(builds.id, buildId));

  const emitter = new BuildEventEmitter();
  const stream = emitter.toReadableStream();

  // Run the pipeline without awaiting — the response streams concurrently
  runPipeline(buildId, emitter).catch((err: unknown) => {
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

async function runPipeline(
  buildId: string,
  emitter: BuildEventEmitter,
): Promise<void> {
  const spec = helpdeskTicketingFixture; // will come from DB in a later phase
  const pipeline = buildPipelineFromSpec(spec, buildId, emitter);

  try {
    await pipeline.start();
    const results = pipeline.getStageResults();
    const allSucceeded = results.every(
      (r) => r.execution.status === 'succeeded',
    );

    await db
      .update(builds)
      .set({
        status: allSucceeded ? 'succeeded' : 'failed',
        updatedAt: new Date(),
      })
      .where(eq(builds.id, buildId));

    const failedDetails = results
      .filter((r) => r.execution.status === 'failed')
      .map((r) => `${r.execution.stageName}: ${r.execution.errorDetails ?? 'unknown'}`)
      .join('; ');

    emitter.emit(
      'pipeline',
      allSucceeded ? 'done' : 'error',
      allSucceeded ? 'Build complete' : failedDetails || 'One or more stages failed',
    );
  } finally {
    emitter.close();
  }
}
