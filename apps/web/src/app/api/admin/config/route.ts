/**
 * /api/admin/config — Read and update platform configuration (admin only).
 *
 * GET  → returns current creditsPerUSD, minCreditsForBuild, platformFeeMultiplier
 * PATCH → updates one or more config values
 */
import { eq } from 'drizzle-orm';

import { db, adminConfig } from '@heynxt/persistence';
import { requireAdmin } from '@/lib/admin';
import { errorResponse } from '@/lib/api';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    await requireAdmin();

    const [config] = await db.select().from(adminConfig);

    if (!config) {
      // Return defaults if no config row exists
      return Response.json({
        creditsPerUSD: 100,
        minCreditsForBuild: 10,
        platformFeeMultiplier: 1.33,
      });
    }

    return Response.json({
      creditsPerUSD: parseFloat(config.creditsPerUSD),
      minCreditsForBuild: parseFloat(config.minCreditsForBuild),
      platformFeeMultiplier: parseFloat(config.platformFeeMultiplier),
      updatedAt: config.updatedAt,
    });
  } catch (err) {
    return errorResponse(err);
  }
}

export async function PATCH(req: Request) {
  try {
    await requireAdmin();

    const body = (await req.json()) as {
      creditsPerUSD?: number;
      minCreditsForBuild?: number;
      platformFeeMultiplier?: number;
    };

    // Validate
    if (body.creditsPerUSD !== undefined && (body.creditsPerUSD <= 0 || body.creditsPerUSD > 100_000)) {
      return Response.json({ error: 'creditsPerUSD must be between 0 and 100,000' }, { status: 400 });
    }
    if (body.minCreditsForBuild !== undefined && body.minCreditsForBuild < 0) {
      return Response.json({ error: 'minCreditsForBuild must be >= 0' }, { status: 400 });
    }
    if (body.platformFeeMultiplier !== undefined && (body.platformFeeMultiplier < 1 || body.platformFeeMultiplier > 5)) {
      return Response.json({ error: 'platformFeeMultiplier must be between 1 and 5' }, { status: 400 });
    }

    // Check if config row exists
    const [existing] = await db.select({ id: adminConfig.id }).from(adminConfig);

    const values: Record<string, string | Date> = { updatedAt: new Date() };
    if (body.creditsPerUSD !== undefined) values.creditsPerUSD = body.creditsPerUSD.toString();
    if (body.minCreditsForBuild !== undefined) values.minCreditsForBuild = body.minCreditsForBuild.toString();
    if (body.platformFeeMultiplier !== undefined) values.platformFeeMultiplier = body.platformFeeMultiplier.toString();

    if (existing) {
      await db
        .update(adminConfig)
        .set(values)
        .where(eq(adminConfig.id, 'default'));
    } else {
      await db.insert(adminConfig).values({
        id: 'default',
        ...values,
      });
    }

    return Response.json({ ok: true });
  } catch (err) {
    return errorResponse(err);
  }
}
