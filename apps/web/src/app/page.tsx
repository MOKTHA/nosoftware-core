/**
 * Home page — landing page for the HeyNXT control plane.
 *
 * Phase 1.7 / Task 7 API status. UI pages for these entities will follow
 * once the CRUD surface is fully in place.
 */

export default function HomePage() {
  return (
    <div>
      <h2 style={{ fontSize: '1.5rem', margin: '0 0 0.5rem' }}>
        Industrial AI App Builder
      </h2>
      <p style={{ color: '#555', lineHeight: 1.5 }}>
        Control plane API is live. Build out is in progress — UI pages for
        workspaces, projects, and tasks will follow in later slices.
      </p>
      <section style={{ marginTop: '2rem' }}>
        <h3 style={{ fontSize: '1rem', marginBottom: '0.5rem' }}>
          Live endpoints
        </h3>
        <ul style={{ paddingLeft: '1.25rem', color: '#444' }}>
          <li>
            <a href="/api/health" style={{ color: '#0070f3' }}>
              <code>GET /api/health</code>
            </a>{' '}
            — DB connectivity + build info
          </li>
          <li>
            <code>GET /api/workspaces?organizationId=&lt;uuid&gt;</code> —
            list workspaces
          </li>
          <li>
            <code>POST /api/workspaces</code> — create a workspace
          </li>
          <li>
            <code>GET /api/projects?workspaceId=&lt;uuid&gt;</code> —
            list projects in a workspace
          </li>
          <li>
            <code>POST /api/projects</code> — create a project
          </li>
          <li>
            <code>GET /api/tasks?workspaceId=&lt;uuid&gt;</code> — list tasks
          </li>
          <li>
            <code>POST /api/tasks</code> — create a task
          </li>
          <li>
            <code>GET /api/generation-runs?workspaceId=&lt;uuid&gt;</code> —
            list generation runs
          </li>
          <li>
            <code>POST /api/generation-runs</code> — create a generation run
          </li>
          <li>
            <code>GET /api/artifacts?workspaceId=&lt;uuid&gt;</code> —
            list artifacts
          </li>
          <li>
            <code>POST /api/artifacts</code> — create an artifact
          </li>
        </ul>
      </section>
      <section style={{ marginTop: '2rem' }}>
        <h3 style={{ fontSize: '1rem', marginBottom: '0.5rem' }}>
          Next
        </h3>
        <p style={{ color: '#555', lineHeight: 1.5 }}>
          Workspace / project / task CRUD pages (React Server Components),
          OAuth auth scaffold, RBAC middleware.
        </p>
      </section>
    </div>
  );
}
