/**
 * Home page — landing page for the HeyNXT control plane.
 *
 * Status: placeholder. Phase 1.6 wires up API routes; UI pages for
 * workspaces/projects/tasks will follow in later slices. The API is
 * live under /api/* — see route.ts siblings.
 */

export default function HomePage() {
  return (
    <div>
      <h2 style={{ fontSize: '1.5rem', margin: '0 0 0.5rem' }}>
        Industrial AI App Builder
      </h2>
      <p style={{ color: '#555', lineHeight: 1.5 }}>
        Control plane is up. Build out is in progress — workspace, project,
        and task views are coming soon.
      </p>
      <section style={{ marginTop: '2rem' }}>
        <h3 style={{ fontSize: '1rem', marginBottom: '0.5rem' }}>
          Live endpoints
        </h3>
        <ul style={{ paddingLeft: '1.25rem', color: '#444' }}>
          <li>
            <a href="/api/health" style={{ color: '#0070f3' }}>
              /api/health
            </a>{' '}
            — DB connectivity + build info
          </li>
          <li>
            <code style={{ background: '#eee', padding: '0 0.25rem' }}>
              GET /api/workspaces
            </code>{' '}
            — list workspaces
          </li>
          <li>
            <code style={{ background: '#eee', padding: '0 0.25rem' }}>
              POST /api/workspaces
            </code>{' '}
            — create a workspace
          </li>
        </ul>
      </section>
    </div>
  );
}
