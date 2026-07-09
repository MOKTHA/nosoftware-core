/**
 * /workspaces — workspace list page (React Server Component).
 *
 * URL: /workspaces?orgId=<uuid>
 *
 * Reads workspaces directly from the DB (no API round-trip — RSCs run on
 * the server). Shows the list plus an inline <CreateWorkspaceForm> for
 * adding new workspaces to the org.
 *
 * If `orgId` is missing or invalid, shows a helpful message with a
 * pre-filled link to the seed org.
 */
import { Suspense } from 'react';
import { eq } from 'drizzle-orm';
import { redirect } from 'next/navigation';

import { OrganizationId, Workspace } from '@heynxt/core-types';
import { db, workspaces } from '@heynxt/persistence';

import { CreateWorkspaceForm } from '@/app/components/CreateWorkspaceForm';

const SEED_ORG_ID = '00000000-0000-0000-0000-000000000010';

// ---------------------------------------------------------------------------
// Server Component
// ---------------------------------------------------------------------------

export const dynamic = 'force-dynamic';
export const revalidate = 0;

type PageProps = {
  searchParams: { orgId?: string };
};

export default async function WorkspacesPage({ searchParams }: PageProps) {
  const orgIdRaw = searchParams.orgId;

  // Missing orgId → soft-redirect to the seed org so the page is useful on
  // first visit. We intentionally don't hard-redirect so the user sees the
  // URL they navigated to.
  if (!orgIdRaw) {
    redirect(`/workspaces?orgId=${SEED_ORG_ID}`);
  }

  const parseResult = OrganizationId.safeParse(orgIdRaw);
  if (!parseResult.success) {
    return (
      <div style={{ color: '#c00', padding: '1rem', background: '#fff5f5' }}>
        Invalid <code>orgId</code> parameter: <code>{orgIdRaw}</code>.
      </div>
    );
  }

  const organizationId = parseResult.data;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <header>
        <h2 style={{ fontSize: '1.25rem', margin: 0 }}>Workspaces</h2>
        <p style={{ color: '#555', margin: '0.25rem 0 0', fontSize: 14 }}>
          Organization: <code>{organizationId}</code>
        </p>
      </header>

      <CreateWorkspaceForm />

      <Suspense fallback={<div style={{ color: '#666' }}>Loading workspaces…</div>}>
        <WorkspacesList organizationId={organizationId} />
      </Suspense>
    </div>
  );
}

async function WorkspacesList({ organizationId }: { organizationId: string }) {
  const rows = await db
    .select()
    .from(workspaces)
    .where(eq(workspaces.organizationId, organizationId))
    .orderBy(workspaces.createdAt);

  // Validate via Zod (defence in depth — confirms DB rows match the contract).
  const workspaceList: Workspace[] = rows.map((r) => Workspace.parse(r));

  if (workspaceList.length === 0) {
    return (
      <p style={{ color: '#888', fontStyle: 'italic' }}>
        No workspaces yet. Use the form above to create one.
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
          <th style={thStyle}>Updated</th>
        </tr>
      </thead>
      <tbody>
        {workspaceList.map((ws) => (
          <tr key={ws.id} style={{ borderTop: '1px solid #eee' }}>
            <td style={tdStyle}>{ws.name}</td>
            <td style={tdStyle}>
              <code>{ws.slug}</code>
            </td>
            <td style={tdStyle}>
              <span
                style={{
                  display: 'inline-block',
                  padding: '2px 6px',
                  background: ws.status === 'active' ? '#e6ffed' : '#fff4e0',
                  color: ws.status === 'active' ? '#00661e' : '#945500',
                  borderRadius: 3,
                  fontSize: 12,
                }}
              >
                {ws.status}
              </span>
            </td>
            <td style={tdStyle}>{ws.description ?? '—'}</td>
            <td style={tdStyle}>{ws.updatedAt.toISOString().slice(0, 10)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
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
