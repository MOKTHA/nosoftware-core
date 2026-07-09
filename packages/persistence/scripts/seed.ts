/**
 * Local-dev seed script — insert a deterministic starting set of rows:
 *
 *   - 1 user        (seed@heynxt.dev)
 *   - 1 org         (seed-org)
 *   - 2 workspaces  (seed-org: default, playground)
 *   - 2 projects    (default workspace): extrusion-demo, trace-poc
 *   - 3 tasks       spread across both projects
 *
 * Idempotent: uses `ON CONFLICT DO NOTHING` so re-running is a no-op.
 *
 * Usage (from repo root):
 *
 *   DATABASE_URL=postgresql://heynxt:heynxt@127.0.0.1:5432/heynxt pnpm db:seed
 */
import { sql } from 'drizzle-orm';
// Resolve to the package's compiled output (dist/). The seed script is
// invoked via `pnpm db:seed` which is expected to run after `pnpm build` —
// same precondition that drizzle-kit generate already enforces.
import {
  db,
  users,
  organizations,
  workspaces,
  projects,
  tasks,
} from '../dist/index.js';

// ---------------------------------------------------------------------------
// Identifiers — fixed so the script is deterministic across re-runs.
// ---------------------------------------------------------------------------

const SEED_USER_ID = '00000000-0000-0000-0000-000000000001';
const SEED_ORG_ID = '00000000-0000-0000-0000-000000000010';
const SEED_WS_DEFAULT_ID = '00000000-0000-0000-0000-000000000100';
const SEED_WS_PLAYGROUND_ID = '00000000-0000-0000-0000-000000000101';
const SEED_PROJECT_A_ID = '00000000-0000-0000-0000-000000010001';
const SEED_PROJECT_B_ID = '00000000-0000-0000-0000-000000010002';
const SEED_TASK_1_ID = '00000000-0000-0000-0000-000001000001';
const SEED_TASK_2_ID = '00000000-0000-0000-0000-000001000002';
const SEED_TASK_3_ID = '00000000-0000-0000-0000-000001000003';

async function main() {
  const start = Date.now();
  console.log(`[seed] DATABASE_URL=${process.env.DATABASE_URL ?? '(default)'}`);

  const now = new Date();

  await db
    .insert(users)
    .values({
      id: SEED_USER_ID,
      name: 'Seed User',
      email: 'seed@heynxt.dev',
      status: 'active',
      createdAt: now,
      updatedAt: now,
    })
    .onConflictDoNothing();

  await db
    .insert(organizations)
    .values({
      id: SEED_ORG_ID,
      name: 'Seed Organization',
      slug: 'seed-org',
      ownerId: SEED_USER_ID,
      status: 'active',
      createdAt: now,
      updatedAt: now,
    })
    .onConflictDoNothing();

  await db
    .insert(workspaces)
    .values([
      {
        id: SEED_WS_DEFAULT_ID,
        organizationId: SEED_ORG_ID,
        name: 'Default',
        slug: 'default',
        description: 'Primary workspace for the seed org.',
        status: 'active',
        createdAt: now,
        updatedAt: now,
      },
      {
        id: SEED_WS_PLAYGROUND_ID,
        organizationId: SEED_ORG_ID,
        name: 'Playground',
        slug: 'playground',
        description: 'Sandbox workspace for experimenting with prompts.',
        status: 'active',
        createdAt: now,
        updatedAt: now,
      },
    ])
    .onConflictDoNothing();

  await db
    .insert(projects)
    .values([
      {
        id: SEED_PROJECT_A_ID,
        workspaceId: SEED_WS_DEFAULT_ID,
        name: 'Extrusion Demo',
        slug: 'extrusion-demo',
        description: 'End-to-end extrusion work order flow.',
        status: 'draft',
        createdBy: SEED_USER_ID,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: SEED_PROJECT_B_ID,
        workspaceId: SEED_WS_DEFAULT_ID,
        name: 'Traceability PoC',
        slug: 'trace-poc',
        description: 'Lot-level traceability experiment.',
        status: 'draft',
        createdBy: SEED_USER_ID,
        createdAt: now,
        updatedAt: now,
      },
    ])
    .onConflictDoNothing();

  await db
    .insert(tasks)
    .values([
      {
        id: SEED_TASK_1_ID,
        workspaceId: SEED_WS_DEFAULT_ID,
        projectId: SEED_PROJECT_A_ID,
        type: 'generate-app',
        title: 'Draft extrusion routing builder',
        description: 'Produce the initial routing DAG editor UI + persistence.',
        status: 'draft',
        createdBy: SEED_USER_ID,
        createdAt: now,
        updatedAt: now,
        completedAt: null,
      },
      {
        id: SEED_TASK_2_ID,
        workspaceId: SEED_WS_DEFAULT_ID,
        projectId: SEED_PROJECT_A_ID,
        type: 'generate-blueprint',
        title: 'Extract die-lifecycle blueprint',
        inputPrompt: 'Capture the 22-state die lifecycle FSM from FactoryNXT Extrusion.',
        status: 'draft',
        createdBy: SEED_USER_ID,
        createdAt: now,
        updatedAt: now,
        completedAt: null,
      },
      {
        id: SEED_TASK_3_ID,
        workspaceId: SEED_WS_DEFAULT_ID,
        projectId: SEED_PROJECT_B_ID,
        type: 'run-spec',
        title: 'Spec genealogy events',
        description: 'Parse a sample genealogy prompt into a SpecTemplate.',
        status: 'draft',
        createdBy: SEED_USER_ID,
        createdAt: now,
        updatedAt: now,
        completedAt: null,
      },
    ])
    .onConflictDoNothing();

  // Summary
  const summary = await db.execute(sql`
    SELECT 'users'          AS entity, COUNT(*)::int AS n FROM users
    UNION ALL SELECT 'organizations',  COUNT(*)::int   FROM organizations
    UNION ALL SELECT 'workspaces',     COUNT(*)::int   FROM workspaces
    UNION ALL SELECT 'projects',       COUNT(*)::int   FROM projects
    UNION ALL SELECT 'tasks',          COUNT(*)::int   FROM tasks
    ORDER BY entity
  `);

  console.log(`[seed] done in ${Date.now() - start}ms`);
  console.table(summary);
  process.exit(0);
}

main().catch((err) => {
  console.error('[seed] FAILED:', err);
  process.exit(1);
});
