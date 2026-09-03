/**
 * /api/builds — create a pipeline build (Phase 5).
 *
 *   POST /api/builds
 *     Trigger a build from the helpdesk ticketing fixture.
 *     A future phase will read the spec from the conversation engine output.
 *     Returns 201 with `{ buildId }`.
 */
import { NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';

import { db, builds } from '@heynxt/persistence';
import { helpdeskTicketingFixture } from '@heynxt/prompt-spec';
import { validateSpecTemplate } from '@heynxt/agent-adapter';

import { errorResponse } from '@/lib/api';

export const dynamic = 'force-dynamic';

export async function POST() {
  try {
    // For now, always use the helpdesk fixture regardless of body.
    // A future phase will read the spec from the conversation engine output.
    const spec = helpdeskTicketingFixture;

    const validation = validateSpecTemplate(spec);
    if (!validation.valid) {
      return NextResponse.json(
        { error: validation.errors },
        { status: 400 },
      );
    }

    const buildId = randomUUID();

    await db.insert(builds).values({
      id: buildId,
      appId: spec.spec.appId,
      appName: spec.spec.appName,
      status: 'pending',
      createdAt: new Date(),
    });

    return NextResponse.json({ buildId }, { status: 201 });
  } catch (err) {
    return errorResponse(err);
  }
}
