import type { Metadata } from 'next';

/**
 * Root layout — the HTML shell for every page in the control plane.
 *
 * App Router convention: the root layout must contain <html> and <body>.
 * It's a React Server Component (no "use client") by default.
 */

export const metadata: Metadata = {
  title: 'HeyNXT — Industrial AI App Builder',
  description:
    'Control plane for HeyNXT: blueprints, generation runs, and industrial applications.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
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
          <nav
            style={{
              display: 'flex',
              gap: '1rem',
              fontSize: '0.875rem',
            }}
          >
            <a href="/workspaces" style={{ color: '#0070f3' }}>
              Workspaces
            </a>
          </nav>
        </header>
        <main>{children}</main>
      </body>
    </html>
  );
}
