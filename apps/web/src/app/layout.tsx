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
          }}
        >
          <h1 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 600 }}>
            HeyNXT
          </h1>
        </header>
        <main>{children}</main>
      </body>
    </html>
  );
}
