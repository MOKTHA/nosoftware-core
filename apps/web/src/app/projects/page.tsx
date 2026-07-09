/**
 * /projects — project list page (React Server Component).
 *
 * URL: /projects?workspaceId=<uuid>
 *
 * Reads projects directly from the DB (no API round-trip — RSCs run on
 * the server). Shows the list plus an inline <CreateProjectForm> for
 * adding new projects to the workspace.
 *
 * If `workspaceId` is missing, soft-redirects to the seed workspace so the
 * page is useful on first visit. If it's present but invalid, shows an
 * inline error (no redirect).
 */
import { Suspense } from 'react';
import { eq } from 'drizzle-orm';
import { redirect } from 'next/navigation';

import { WorkspaceId, Project } from '@heynxt/core-types';
import { db, projects } from '@heynxt/persistence';

import { CreateProjectForm } from '@/app/components/CreateProjectForm';

const SEED_WORKSPACE_ID = '00000000-0000-0000-0000-000000000100';

// ---------------------------------------------------------------------------
// Server Component
// ---------------------------------------------------------------------------

export const dynamic = 'force-dynamic';
export const revalidate = 0;

type PageProps = {
  searchParams: { workspaceId?: string };
};

export default async function ProjectsPage({ searchParams }: PageProps) {
  const workspaceIdRaw = searchParams.workspaceId;

  // Missing workspaceId → soft-redirect to the seed workspace so the page is
  // useful on first visit.
  if (!workspaceIdRaw) {
    redirect(`/projects?workspaceId=${SEED_WORKSPACE_ID}`);
  }

  const parseResult = WorkspaceId.safeParse(workspaceIdRaw);
  if (!parseResult.success) {
    return (
      <div style={{ color: '#c00', padding: '1rem', background: '#fff5f5' }}>
        Invalid <code>workspaceId</code> parameter: <code>{workspaceIdRaw}</code>.
      </div>
    );
  }

  const workspaceId = parseResult.data;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <header>
        <h2 style={{ fontSize: '1.25rem', margin: 0 }}>Projects</h2>
        <p style={{ color: '#555', margin: '0.25rem 0 0', fontSize: 14 }}>
          Workspace: <code>{workspaceId}</code>
        </p>
      </header>

      <CreateProjectForm />

      <Suspense fallback={<div style={{ color: '#666' }}>Loading projects…</div>}>
        <ProjectsList workspaceId={workspaceId} />
      </Suspense>
    </div>
  );
}

async function ProjectsList({ workspaceId }: { workspaceId: string }) {
  const rows = await db
    .select()
    .from(projects)
    .where(eq(projects.workspaceId, workspaceId))
    .orderBy(projects.createdAt);

  // Validate via Zod (defence in depth — confirms DB rows match the contract).
  const projectList: Project[] = rows.map((r) => Project.parse(r));

  if (projectList.length === 0) {
    return (
      <p style={{ color: '#888', fontStyle: 'italic' }}>
        No projects yet. Use the form above to create one.
      </p>
    );
  }

  return (
    <table
      style={{
        width: '100%',
        borderCollapse: 'collapse',
        background: '#fff',
        border: '1px solid #eaeaea',
        borderRadius: 6,
        overflow: 'hidden',
        fontSize: 14,
      }}
    >
      <thead>
        <tr style={{ background: '#fafafa', textAlign: 'left' }}>
          <th style={thStyle}>Name</th>
          <th style={thStyle}>Slug</th>
          <th style={thStyle}>Status</th>
          <th style={thStyle}>Description</th>
          <th style={thStyle}>Created By</th>
          <th style={thStyle}>Updated</th>
        </tr>
      </thead>
      <tbody>
        {projectList.map((p) => (
          <tr key={p.id} style={{ borderTop: '1px solid #eee' }}>
            <td style={tdStyle}>{p.name}</td>
            <td style={tdStyle}>
              <code>{p.slug}</code>
            </td>
            <td style={tdStyle}>
              <span
                style={{
                  display: 'inline-block',
                  padding: '2px 6px',
                  background: statusColor(p.status).bg,
                  color: statusColor(p.status).fg,
                  borderRadius: 3,
                  fontSize: 12,
                }}
              >
                {p.status}
              </span>
            </td>
            <td style={tdStyle}>{p.description ?? '—'}</td>
            <td style={tdStyle}>
              <code style={{ fontSize: 12 }}>{p.createdBy}</code>
            </td>
            <td style={tdStyle}>{p.updatedAt.toISOString().slice(0, 10)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function statusColor(status: string): { bg: string; fg: string } {
  switch (status) {
    case 'active':
      return { bg: '#e6ffed', fg: '#00661e' };
    case 'archived':
      return { bg: '#f0f0f0', fg: '#555' };
    case 'draft':
    default:
      return { bg: '#fff4e0', fg: '#945500' };
  }
}

const thStyle: React.CSSProperties = {
  padding: '0.5rem 0.75rem',
  fontWeight: 600,
  fontSize: 13,
  borderBottom: '1px solid #eaeaea',
};

const tdStyle: React.CSSProperties = {
  padding: '0.5rem 0.75rem',
};
