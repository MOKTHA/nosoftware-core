/**
 * GET /api/admin/users — List all users (admin only).
 *
 * Returns: { users: User[], total: number }
 * Query params: ?search=<term>&limit=<n>&offset=<n>
 */
import { desc, like, or, sql } from 'drizzle-orm';

import { db, users } from '@heynxt/persistence';
import { requireAdmin } from '@/lib/admin';
import { errorResponse } from '@/lib/api';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    await requireAdmin();

    const url = new URL(req.url);
    const search = url.searchParams.get('search')?.trim();
    const limit = Math.min(parseInt(url.searchParams.get('limit') ?? '50'), 200);
    const offset = parseInt(url.searchParams.get('offset') ?? '0');

    let query = db
      .select({
        id: users.id,
        email: users.email,
        name: users.name,
        image: users.image,
        role: users.role,
        credits: users.credits,
        status: users.status,
        createdAt: users.createdAt,
      })
      .from(users)
      .orderBy(desc(users.createdAt))
      .limit(limit)
      .offset(offset);

    if (search) {
      query = query.where(
        or(
          like(users.email, `%${search}%`),
          like(users.name, `%${search}%`),
        ),
      ) as typeof query;
    }

    const rows = await query;

    // Total count
    const [countRow] = await db
      .select({ count: sql<number>`count(*)` })
      .from(users);

    return Response.json({
      users: rows,
      total: Number(countRow?.count ?? 0),
    });
  } catch (err) {
    return errorResponse(err);
  }
}
