import type { Metadata } from 'next';

import { getSession } from '@/lib/session';
import { UserMenu } from '@/components/UserMenu';

/**
 * Root layout — the HTML shell for every page in the control plane.
 *
 * App Router convention: the root layout must contain <html> and <body>.
 * It's a React Server Component (no "use client") by default. The
 * async `getSession()` call runs on the server; the user slice it
 * returns is passed into `<UserMenu>`, a client component that owns
 * the sign-out action. Keeping `getSession` here means the header
 * renders the correct user state on first paint (no client-side
 * flicker waiting for `auth()` to resolve).
 *
 * See docs/adr/0008-auth-library-and-provider.md for background.
 */

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'NoSoftware — Industrial AI App Builder',
  description:
    'Control plane for NoSoftware: blueprints, generation runs, and industrial applications.',
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  const user = session?.user
    ? {
        id: session.user.id,
        name: session.user.name ?? null,
        email: session.user.email ?? null,
        image: session.user.image ?? null,
      }
    : null;

  return (
    <html lang="en">
      <head>
        <style
          dangerouslySetInnerHTML={{
            __html: `
              @keyframes spin { to { transform: rotate(360deg) } }
              @keyframes blink { 50% { opacity: 0 } }
              @keyframes pulse { 0%,100% { opacity: 1 } 50% { opacity: 0.5 } }
              *, *::before, *::after { box-sizing: border-box; }
              a { color: inherit; text-decoration: none; }
              a:hover { opacity: 0.8; }
            `,
          }}
        />
      </head>
      <body
        style={{
          fontFamily:
            'system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", sans-serif',
          margin: 0,
          padding: 0,
          background: '#ffffff',
          color: '#0a0a0a',
          WebkitFontSmoothing: 'antialiased',
        }}
      >
        <header
          style={{
            borderBottom: '1px solid #e5e5e5',
            padding: '0 1.5rem',
            height: '3.5rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: '#ffffff',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
            <a
              href="/"
              style={{
                fontSize: '1rem',
                fontWeight: 600,
                letterSpacing: '-0.02em',
                color: '#0a0a0a',
              }}
            >
              NoSoftware
            </a>
            <nav
              style={{
                display: 'flex',
                gap: '1rem',
                fontSize: '0.875rem',
                color: '#737373',
              }}
            >
              <a href="/workspaces">Workspaces</a>
              <a href="/projects">Projects</a>
              <a href="/tasks">Tasks</a>
              <a
                href="/build"
                style={{ fontWeight: 500, color: '#0a0a0a' }}
              >
                Build
              </a>
            </nav>
          </div>
          <UserMenu user={user} />
        </header>
        <main style={{ padding: '0.75rem 1.5rem' }}>{children}</main>
      </body>
    </html>
  );
}
