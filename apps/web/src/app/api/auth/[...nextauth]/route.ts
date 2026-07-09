/**
 * Auth.js App Router route handler.
 *
 * Single catch-all route that serves every `/api/auth/*` endpoint:
 *   - `/api/auth/signin/github` — kick off the GitHub OAuth flow
 *   - `/api/auth/callback/github` — OAuth redirect after user authorizes
 *   - `/api/auth/signout`       — destroy the session
 *   - `/api/auth/session`       — read the current session (JSON)
 *   - `/api/auth/csrf`          — CSRF token for forms
 *   - ...and others defined by Auth.js
 *
 * Implementation delegates entirely to `auth.ts` (the NextAuth result).
 *
 * See docs/adr/0008-auth-library-and-provider.md for background.
 */
import { handlers } from '../../../../auth';

export const { GET, POST } = handlers;
