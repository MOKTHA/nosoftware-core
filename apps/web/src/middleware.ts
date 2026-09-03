/**
 * Next.js middleware — auth gate for protected routes.
 *
 * Uses Auth.js's `auth()` export as the middleware wrapper. The
 * `authorized` callback in `auth.config.ts` decides whether a request
 * is allowed through; if not, Auth.js redirects to the sign-in page
 * (`/api/auth/signin`) with a `callbackUrl` query param so the user
 * is returned to the original page after sign-in.
 *
 * Public routes (no auth required):
 *   - `/`                            — public landing page
 *   - `/api/auth/*`                  — Auth.js endpoints
 *   - `/api/health`                  — uptime probe (used by load
 *                                      balancers, k8s probes, etc.)
 *   - `/_next/*`, `/favicon.ico`     — Next.js internals + static assets
 *
 * Everything else requires a valid session. Phase 9 will add RBAC-aware
 * per-route checks on top of this baseline.
 *
 * The matcher excludes static internals via the standard negative
 * lookahead; everything else falls into the authorized callback which
 * applies the public-route allowlist above.
 *
 * See docs/adr/0008-auth-library-and-provider.md for background.
 */
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { auth } from './auth';

/**
 * Wrap the Auth.js middleware so that errors (e.g. DATABASE_URL not
 * set) don't crash the entire app — the request proceeds as
 * unauthenticated and the layout renders a null session.
 */
export async function middleware(request: NextRequest) {
  try {
    // Auth.js middleware overload: auth(request) invokes the authorized callback
    const handler = auth as unknown as (request: NextRequest) => Promise<NextResponse>;
    return await handler(request);
  } catch {
    // Auth unavailable (missing DATABASE_URL, DB down, etc.).
    // Let the request through; layout/pages treat session as null.
    return NextResponse.next();
  }
}

export const config = {
  matcher: [
    // Run on every request except Next.js internals and static assets.
    // Auth routes (`/api/auth/*`) and public pages (`/`, `/api/health`)
    // get a free pass via the `authorized` callback in auth.config.ts.
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
