/**
 * /api/builds/[buildId]/files — Read and update generated source files.
 *
 * GET  → returns filesJson from the build
 * PUT  → saves updated file contents back to the build
 */
import { eq } from 'drizzle-orm';
import { db, builds } from '@heynxt/persistence';

export async function GET(
  _req: Request,
  props: { params: Promise<{ buildId: string }> },
) {
  const { buildId } = await props.params;

  const [build] = await db
    .select({ filesJson: builds.filesJson })
    .from(builds)
    .where(eq(builds.id, buildId));

  if (!build) {
    return Response.json({ error: 'Build not found' }, { status: 404 });
  }

  if (!build.filesJson) {
    return Response.json({ files: [] });
  }

  try {
    const files = JSON.parse(build.filesJson) as Array<{ path: string; content: string }>;
    return Response.json({ files });
  } catch {
    return Response.json({ files: [] });
  }
}

/**
 * PUT /api/builds/[buildId]/files — Save updated file contents.
 *
 * Body: { files: Array<{ path: string; content: string }> }
 */
export async function PUT(
  req: Request,
  props: { params: Promise<{ buildId: string }> },
) {
  const { buildId } = await props.params;

  const [build] = await db
    .select({ id: builds.id })
    .from(builds)
    .where(eq(builds.id, buildId));

  if (!build) {
    return Response.json({ error: 'Build not found' }, { status: 404 });
  }

  try {
    const body = (await req.json()) as { files: Array<{ path: string; content: string }> };

    if (!Array.isArray(body.files)) {
      return Response.json({ error: 'files must be an array' }, { status: 400 });
    }

    await db
      .update(builds)
      .set({ filesJson: JSON.stringify(body.files) })
      .where(eq(builds.id, buildId));

    return Response.json({ ok: true, fileCount: body.files.length });
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : 'Failed to save files' },
      { status: 500 },
    );
  }
}
