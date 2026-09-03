/**
 * /api/builds/[buildId]/stream — SSE build progress.
 *
 *   GET /api/builds/:buildId/stream
 *     Opens an SSE connection and starts the pipeline. Reads the spec
 *     from the builds table (specJson column) or falls back to the
 *     helpdesk fixture. Streams structured BuildEvent objects until
 *     the build completes or fails.
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

    await db
      .update(builds)
      .set({
        status: allSucceeded ? 'succeeded' : 'failed',
        deployedUrl,
        updatedAt: new Date(),
      })
      .where(eq(builds.id, buildId));

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
  } finally {
    emitter.close();
  }
}
