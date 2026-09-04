/**
 * /api/builds/[buildId] — fetch a single build.
 *
 *   GET /api/builds/:buildId
 *     Returns the build record (status, deployedUrl, appName, etc.).
 *     Used by the /build/[buildId] page to restore state on refresh.
 */
import { eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';

import { db, builds } from '@heynxt/persistence';

export const dynamic = 'force-dynamic';

export async function GET(
  _req: Request,
  { params }: { params: { buildId: string } },
) {
  const { buildId } = params;

  const [build] = await db.select().from(builds).where(eq(builds.id, buildId));
  if (!build) {
    return NextResponse.json({ error: 'Build not found' }, { status: 404 });
  }

  return NextResponse.json({
    id: build.id,
    appName: build.appName,
    prompt: build.prompt,
    status: build.status,
    deployedUrl: build.deployedUrl,
    errorMessage: build.errorMessage,
    createdAt: build.createdAt,
    updatedAt: build.updatedAt,
  });
}
