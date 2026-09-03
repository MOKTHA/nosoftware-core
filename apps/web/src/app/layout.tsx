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
  title: 'HeyNXT — Industrial AI App Builder',
  description:
    'Control plane for HeyNXT: blueprints, generation runs, and industrial applications.',
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  // Extract only the user fields we want to expose to the client.
  // Sending the whole session object would cross the server/client
  // boundary with internal Auth.js fields we don't need in the UI.
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
        {/* Keyframe animation for the BuildTrace spinner component */}
        <style
          dangerouslySetInnerHTML={{
            __html: '@keyframes spin{to{transform:rotate(360deg)}}',
          }}
        />
      </head>
      <body
        style={{
          fontFamily:
            'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
          margin: 0,
          padding: '2rem',
          background: '#fafafa',
          color: '#111',
        }}
      >
        <header
          style={{
            borderBottom: '1px solid #eaeaea',
            paddingBottom: '1rem',
            marginBottom: '2rem',
            display: 'flex',
            alignItems: 'baseline',
            justifyContent: 'space-between',
          }}
        >
          <h1 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 600 }}>
            <a href="/" style={{ color: 'inherit', textDecoration: 'none' }}>
              HeyNXT
            </a>
          </h1>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '1rem',
              fontSize: '0.875rem',
            }}
          >
            <nav style={{ display: 'flex', gap: '1rem' }}>
              <a href="/workspaces" style={{ color: '#0070f3' }}>
                Workspaces
              </a>
              <a href="/projects" style={{ color: '#0070f3' }}>
                Projects
              </a>
              <a href="/tasks" style={{ color: '#0070f3' }}>
                Tasks
              </a>
              <a href="/build" style={{ color: '#0070f3' }}>
                Build
              </a>
            </nav>
            <UserMenu user={user} />
          </div>
        </header>
        <main>{children}</main>
      </body>
    </html>
  );
}
