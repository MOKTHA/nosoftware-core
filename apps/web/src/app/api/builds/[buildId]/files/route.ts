/**
 * /api/builds/[buildId]/files — Fetch generated source files for a build.
 *
 * Returns the file tree and contents stored during the deploy stage.
 * Used by the BuildStudio component to render the code viewer.
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
