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
export { auth as middleware } from './auth';

export const config = {
  matcher: [
    // Run on every request except Next.js internals and static assets.
    // Auth routes (`/api/auth/*`) and public pages (`/`, `/api/health`)
    // get a free pass via the `authorized` callback in auth.config.ts.
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
