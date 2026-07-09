/**
 * Session helpers — thin wrappers around the Auth.js `auth()` function.
 *
 * Two functions for now:
 *
 *   - `getSession()` — returns the current session or null. Safe to call
 *     from anywhere that has a request context (RSCs, route handlers,
 *     Server Actions). Never throws.
 *
 *   - `requireAuth()` — returns the session if one is present, otherwise
 *     throws a typed error. Used by API routes that must be
 *     authenticated — routes can catch and convert the error to a 401
 *     response, or let it propagate to a global error handler.
 *
 * These are the abstraction boundary that insulates HeyNXT code from
 * Auth.js internals. All future code that needs the current user
 * imports from here, not from `next-auth` directly. If auth is ever
 * swapped (see ADR-0008 tradeoffs), only this file changes.
 *
 * See docs/adr/0008-auth-library-and-provider.md for background.
 */
import { auth } from '../auth';

/**
 * Returns the current session, or null if no user is signed in.
 *
 * Safe to call from any async server context (RSC, route handler,
 * Server Action). Returns `null` rather than throwing so callers can
 * branch on the value.
 */
export async function getSession() {
  try {
    const session = await auth();
    return session;
  } catch {
    // Auth.js can throw in weird boot contexts (missing env vars,
    // misconfigured providers). Swallowing here keeps pages
    // renderable in dev; mis-config is surfaced via the server logs
    // next-auth writes on first request.
    return null;
  }
}

/**
 * Returns the current session or throws if unauthenticated.
 *
 * Use this at the top of protected API routes to fail fast. Callers
 * can catch the error and map it to their preferred error body/shape.
 *
 * Thrown error shape is kept minimal by design — the 401-ness is the
 * important part, not the message. Routes that want a richer error
 * should call getSession() and build their own response.
 */
export class NotAuthenticatedError extends Error {
  constructor() {
    super('Not authenticated');
    this.name = 'NotAuthenticatedError';
  }
}

export async function requireAuth() {
  const session = await getSession();
  if (!session?.user) {
    throw new NotAuthenticatedError();
  }
  return session;
}
