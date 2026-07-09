/**
 * Auth.js configuration — separated from `auth.ts` so the Next.js App
 * Router middleware can import it without triggering Auth.js's full
 * bootstrap (which depends on Node-specific adapters).
 *
 * This file is imported by `auth.ts` (the NextAuth result entry) and
 * by `middleware.ts` (edge runtime).
 *
 * See docs/adr/0008-auth-library-and-provider.md for background.
 */
import type { NextAuthConfig } from 'next-auth';
import GitHub from 'next-auth/providers/github';

export const authConfig: NextAuthConfig = {
  // Phase 1: database sessions per ADR-0008. The session cookie holds a
  // session-token that Auth.js looks up in the `sessions` table on each
  // request.
  session: {
    strategy: 'database',
    // Reasonable default; no need to tune until Phase 9 hardening.
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },

  providers: [
    // GitHub env-var auto-resolution per ADR-0008:
    //   AUTH_GITHUB_ID     → clientId
    //   AUTH_GITHUB_SECRET → clientSecret
    // Passing `GitHub` (no arg) lets next-auth read those env vars.
    GitHub,
  ],

  callbacks: {
    // The `session` callback shapes the value returned by `auth()`.
    // For Phase 1, we only need `user.id` alongside the default Name/email.
    async session({ session, user }) {
      if (session.user) {
        session.user.id = user.id;
      }
      return session;
    },

    // The `authorized` callback is consulted by the Auth.js middleware
    // (`src/middleware.ts`) to decide whether a request is allowed
    // through. Returning `false` causes Auth.js to redirect to the
    // sign-in page with a `callbackUrl` query param so the user lands
    // back on the original page after signing in.
    //
    // Public routes in Phase 1 — no auth required for these:
    //   - `/`            landing page
    //   - `/api/auth/*`  Auth.js endpoints (CSRF, providers, sign-in,
    //                    callback, session, signout)
    //   - `/api/health`  uptime probe (used by load balancers / k8s)
    //
    // Everything else requires a valid session. Phase 9 will replace
    // this simple boolean with workspace-scoped RBAC checks.
    async authorized({ auth, request }) {
      const { pathname } = request.nextUrl;

      if (pathname === '/') return true;
      if (pathname === '/api/health') return true;
      if (pathname.startsWith('/api/auth')) return true;

      // Logged in → allow. Otherwise Auth.js redirects to /api/auth/signin.
      return !!auth;
    },
  },

  // Trust the request host for callback URLs in dev (local + behind
  // ngrok/similar). Phase 9 hardening will tighten this.
  trustHost: true,

  // Pages override — keep defaults (Auth.js's built-in sign-in page
  // works fine for Phase 1; UI-side sign-in button added later).
};
