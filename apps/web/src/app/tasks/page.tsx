/**
 * /tasks — task list page (React Server Component).
 *
 * URL: /tasks?workspaceId=<uuid>[&projectId=<uuid>]
 *
 * Reads tasks directly from the DB (no API round-trip — RSCs run on
 * the server). Shows the list plus an inline <CreateTaskForm> for
 * adding new tasks.
 *
 * If `workspaceId` is missing, soft-redirects to the seed workspace
 * so the page is useful on first visit. If invalid, shows an inline
 * error (no redirect).
 *
 * Uses a two-query approach to display project names alongside tasks:
 * fetch tasks first, collect unique projectIds, fetch projects, build
 * a Map<projectId, name>.
 */
import { Suspense } from 'react';
import { eq, and, inArray } from 'drizzle-orm';
import { redirect } from 'next/navigation';

import { Task, TaskType, WorkspaceId, ProjectId } from '@heynxt/core-types';
import { db, tasks, projects } from '@heynxt/persistence';

import { CreateTaskForm } from '@/app/components/CreateTaskForm';

const SEED_WS_ID = '00000000-0000-0000-0000-000000000100';

// ---------------------------------------------------------------------------
// Server Component
// ---------------------------------------------------------------------------

export const dynamic = 'force-dynamic';
export const revalidate = 0;

type PageProps = {
  searchParams: { workspaceId?: string; projectId?: string };
};

export default async function TasksPage({ searchParams }: PageProps) {
  const workspaceIdRaw = searchParams.workspaceId;

  // Missing workspaceId → soft-redirect to the seed workspace so the page
  // is useful on first visit.
  if (!workspaceIdRaw) {
    redirect(`/tasks?workspaceId=${SEED_WS_ID}`);
  }

  const wsParseResult = WorkspaceId.safeParse(workspaceIdRaw);
  if (!wsParseResult.success) {
    return (
      <div style={{ color: '#c00', padding: '1rem', background: '#fff5f5' }}>
        Invalid <code>workspaceId</code> parameter: <code>{workspaceIdRaw}</code>.
      </div>
    );
  }

  const workspaceId = wsParseResult.data;

  // Optionally parse projectId filter (show inline error if invalid).
  let projectId: string | undefined;
  if (searchParams.projectId) {
    const projParseResult = ProjectId.safeParse(searchParams.projectId);
    if (!projParseResult.success) {
      return (
        <div style={{ color: '#c00', padding: '1rem', background: '#fff5f5' }}>
          Invalid <code>projectId</code> parameter: <code>{searchParams.projectId}</code>.
        </div>
      );
    }
    projectId = projParseResult.data;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <header>
        <h2 style={{ fontSize: '1.25rem', margin: 0 }}>Tasks</h2>
        <p style={{ color: '#555', margin: '0.25rem 0 0', fontSize: 14 }}>
          Workspace: <code>{workspaceId}</code>
          {projectId && (
            <> · Project: <code>{projectId}</code></>
          )}
        </p>
      </header>

      <CreateTaskForm />

      <Suspense fallback={<div style={{ color: '#666' }}>Loading tasks…</div>}>
        <TasksList workspaceId={workspaceId} projectId={projectId} />
      </Suspense>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Status badge colour mapping
// ---------------------------------------------------------------------------

const statusColors: Record<string, { bg: string; color: string } | undefined> = {
  draft:     { bg: '#f5f5f5', color: '#666' },
  queued:    { bg: '#fff4e0', color: '#945500' },
  running:   { bg: '#e6f0ff', color: '#003d99' },
  succeeded: { bg: '#e6ffed', color: '#00661e' },
  failed:    { bg: '#ffe6e6', color: '#990000' },
  cancelled: { bg: '#f5f5f5', color: '#666' },
};

const defaultStatusColor = { bg: '#f5f5f5', color: '#666' };

function getStatusColor(status: string): { bg: string; color: string } {
  return statusColors[status] ?? defaultStatusColor;
}

// ---------------------------------------------------------------------------
// TasksList (rendered inside Suspense)
// ---------------------------------------------------------------------------

async function TasksList({
  workspaceId,
  projectId,
}: {
  workspaceId: string;
  projectId?: string;
}) {
  // Build where clause — optionally filtered by projectId.
  const where = projectId
    ? and(
        eq(tasks.workspaceId, workspaceId),
        eq(tasks.projectId, projectId),
      )
    : eq(tasks.workspaceId, workspaceId);

  const taskRows = await db
    .select()
    .from(tasks)
    .where(where)
    .orderBy(tasks.createdAt);

  const taskList: Task[] = taskRows.map((r) => Task.parse(r));

  // Two-query approach: collect unique projectIds, fetch project names.
  const projectIds = [...new Set(taskList.map((t) => t.projectId))];
  const projectNameMap = new Map<string, string>();

  if (projectIds.length > 0) {
    const projectRows = await db
      .select({ id: projects.id, name: projects.name })
      .from(projects)
      .where(inArray(projects.id, projectIds));

    for (const p of projectRows) {
      projectNameMap.set(p.id, p.name);
    }
  }

  if (taskList.length === 0) {
    return (
      <p style={{ color: '#888', fontStyle: 'italic' }}>
        No tasks yet. Use the form above to create one.
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
          <th style={thStyle}>Title</th>
          <th style={thStyle}>Type</th>
          <th style={thStyle}>Status</th>
          <th style={thStyle}>Project</th>
          <th style={thStyle}>Created By</th>
          <th style={thStyle}>Updated</th>
        </tr>
      </thead>
      <tbody>
        {taskList.map((t) => {
          const colors = getStatusColor(t.status);
          return (
            <tr key={t.id} style={{ borderTop: '1px solid #eee' }}>
              <td style={tdStyle}>{t.title}</td>
              <td style={tdStyle}>
                <code>{t.type}</code>
              </td>
              <td style={tdStyle}>
                <span
                  style={{
                    display: 'inline-block',
                    padding: '2px 6px',
                    background: colors.bg,
                    color: colors.color,
                    borderRadius: 3,
                    fontSize: 12,
                  }}
                >
                  {t.status}
                </span>
              </td>
              <td style={tdStyle}>
                {projectNameMap.get(t.projectId) ?? (
                  <code>{t.projectId}</code>
                )}
              </td>
              <td style={tdStyle}>
                <code>{t.createdBy}</code>
              </td>
              <td style={tdStyle}>{t.updatedAt.toISOString().slice(0, 10)}</td>
            </tr>
          );
        })}
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
