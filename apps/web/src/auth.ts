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

const nextAuth = NextAuth({
  ...authConfig,

  // Use our own Drizzle client as the adapter. The Drizzle adapter expects
  // a client (the PgDatabase instance); we pass it directly so Auth.js
  // queries go through the same singleton everyone else uses.
  adapter: DrizzleAdapter(db),
});

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
export const handlers: NextAuthResult['handlers'] = nextAuth.handlers;
export const auth: NextAuthResult['auth'] = nextAuth.auth;
export const signIn: NextAuthResult['signIn'] = nextAuth.signIn;
export const signOut: NextAuthResult['signOut'] = nextAuth.signOut;
