/**
 * Auth.js (next-auth@5) runtime entry point.
 *
 * Loads the Auth.js config from `auth.config.ts`, then boots NextAuth
 * with the Drizzle adapter wired to our existing Postgres client. This
 * module MUST import `@heynxt/persistence` (Node-side), so it must
 * only be imported from Node runtime contexts (route handlers, RSCs,
 * Server Actions). Middleware imports `auth.config.ts` instead.
 *
 * Exports produced by `NextAuth(authConfig)`:
 *   - `handlers` — Route Handlers (GET/POST for `/api/auth/*`)
 *   - `auth`     — read current session in RSC/route/middleware
 *   - `signIn`   — trigger sign-in programmatically
 *   - `signOut`  — trigger sign-out programmatically
 *
 * Environment variables (Auth.js convention, see ADR-0008):
 *   AUTH_SECRET        — symmetric key for session cookie signing
 *   AUTH_GITHUB_ID     — GitHub OAuth App client id
 *   AUTH_GITHUB_SECRET — GitHub OAuth App client secret
 *
 * See docs/adr/0008-auth-library-and-provider.md for background.
 */
import NextAuth, { type NextAuthResult } from 'next-auth';
import { DrizzleAdapter } from '@auth/drizzle-adapter';

import { db } from '@heynxt/persistence';

import { authConfig } from './auth.config';

/**
 * Lazy-init the NextAuth instance so that the `DrizzleAdapter(db)`
 * call (which accesses the `db` proxy and throws when DATABASE_URL
 * is missing) only runs on the first actual auth call, not at
 * module-evaluation time. This prevents `next build` and dev-server
 * startup from crashing when the DB is unreachable.
 *
 * The `db` import itself is fine — `@heynxt/persistence` exports a
 * lazy `Proxy` that doesn't resolve the connection until a property
 * is accessed. However, `DrizzleAdapter(db)` eagerly reads from it,
 * so we defer that call into `getNextAuth()`.
 */
let _nextAuth: NextAuthResult | null = null;

function getNextAuth(): NextAuthResult {
  if (!_nextAuth) {
    _nextAuth = NextAuth({
      ...authConfig,
      adapter: DrizzleAdapter(db),
    });
  }
  return _nextAuth;
}

/**
 * Export auth helpers with explicit NextAuthResult property-type
 * annotations.
 *
 * Why not `export const { handlers, auth, signIn, signOut } = NextAuth({...})`?
 * See https://github.com/nextauthjs/next-auth/issues/10568 — the
 * destructured result's inferred type references an internal
 * `next-auth/lib` subpath that isn't in the public package surface.
 * TypeScript's declaration-emit check then rejects the file because
 * the declaration is "not portable". Explicit per-property annotations
 * break the inference chain so TS never needs to name the internal
 * type. Do not simplify this without confirming the fix still works.
 */
export const handlers: NextAuthResult['handlers'] = {
  GET: (...args: Parameters<NextAuthResult['handlers']['GET']>) => getNextAuth().handlers.GET(...args),
  POST: (...args: Parameters<NextAuthResult['handlers']['POST']>) => getNextAuth().handlers.POST(...args),
};
export const auth: NextAuthResult['auth'] = ((...args: Parameters<NextAuthResult['auth']>) =>
  getNextAuth().auth(...args)) as NextAuthResult['auth'];
export const signIn: NextAuthResult['signIn'] = (...args: Parameters<NextAuthResult['signIn']>) =>
  getNextAuth().signIn(...args);
export const signOut: NextAuthResult['signOut'] = (...args: Parameters<NextAuthResult['signOut']>) =>
  getNextAuth().signOut(...args);
