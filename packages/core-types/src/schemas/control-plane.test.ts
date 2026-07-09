import { describe, expect, it } from 'vitest';
import {
  User,
  Organization,
  OrganizationSlug,
  Workspace,
  Permission,
  RoleName,
  RoleDefinition,
  ROLE_DEFINITIONS,
  getRolePermissions,
  // Execution domain
  Project,
  ProjectSlug,
  CreateProjectInput,
  Task,
  TaskType,
  TaskStatus,
  isTaskTerminal,
  CreateTaskInput,
  GenerationRun,
  GenerationRunStatus,
  GenerationRunSnapshot,
  isGenerationRunTerminal,
  CreateGenerationRunInput,
  Artifact,
  ArtifactKind,
  ArtifactStorageKind,
  hasInlineContent,
  CreateArtifactInput,
  // Audit
  AuditLogEntry,
  AuditEntityType,
  AuditAction,
  createStatusChangeEntry,
} from '../index.js';

// ──────────────────────────────────────────────────────────────────────
// Phase 1 — Task 1 tests (existing)
// ──────────────────────────────────────────────────────────────────────

describe('User schema', () => {
  const now = new Date();

  it('accepts a valid user with all required fields', () => {
    const parsed = User.parse({
      id: '11111111-1111-1111-1111-111111111111',
      email: 'alice@example.com',
      name: 'Alice',
      status: 'active',
      createdAt: now,
      updatedAt: now,
    });

    expect(parsed.email).toBe('alice@example.com');
    expect(parsed.status).toBe('active');
    expect(parsed.image).toBeUndefined(); // nullish field not provided
  });

  it('rejects an invalid email', () => {
    expect(() =>
      User.parse({
        id: '11111111-1111-1111-1111-111111111111',
        email: 'not-an-email',
        createdAt: now,
        updatedAt: now,
      })
    ).toThrow();
  });

  it('rejects a malformed id', () => {
    expect(() =>
      User.parse({
        id: 'not-a-uuid',
        email: 'alice@example.com',
        createdAt: now,
        updatedAt: now,
      })
    ).toThrow();
  });

  it('defaults status to "invited" when omitted', () => {
    const parsed = User.parse({
      id: '11111111-1111-1111-1111-111111111111',
      email: 'alice@example.com',
      createdAt: now,
      updatedAt: now,
    });
    expect(parsed.status).toBe('invited');
  });
});

describe('Organization slug validation', () => {
  it('accepts a valid slug', () => {
    expect(OrganizationSlug.parse('acme-corp')).toBe('acme-corp');
  });

  it('rejects a slug with uppercase', () => {
    expect(() => OrganizationSlug.parse('AcmeCorp')).toThrow();
  });

  it('rejects a slug starting with hyphen', () => {
    expect(() => OrganizationSlug.parse('-acme')).toThrow();
  });

  it('rejects a slug ending with hyphen', () => {
    expect(() => OrganizationSlug.parse('acme-')).toThrow();
  });

  it('rejects a slug that is too short', () => {
    expect(() => OrganizationSlug.parse('a')).toThrow();
  });
});

describe('Organization schema', () => {
  const now = new Date();
  const base = {
    id: '22222222-2222-2222-2222-222222222222',
    name: 'Acme Corp',
    slug: 'acme-corp',
    createdAt: now,
    updatedAt: now,
  };

  it('parses a valid organization', () => {
    const org = Organization.parse(base);
    expect(org.status).toBe('active'); // default
  });

  it('rejects an invalid slug', () => {
    expect(() => Organization.parse({ ...base, slug: 'Invalid' })).toThrow();
  });
});

describe('Workspace schema', () => {
  const now = new Date();
  const base = {
    id: '33333333-3333-3333-3333-333333333333',
    organizationId: '22222222-2222-2222-2222-222222222222',
    name: 'Production',
    slug: 'production',
    createdAt: now,
    updatedAt: now,
  };

  it('parses a valid workspace', () => {
    const ws = Workspace.parse(base);
    expect(ws.status).toBe('active');
  });

  it('requires organizationId', () => {
    expect(() =>
      Workspace.parse({ ...base, organizationId: undefined })
    ).toThrow();
  });
});

describe('RBAC', () => {
  it('exposes all expected permission strings', () => {
    const permissions = Permission.options;
    expect(permissions).toContain('org:admin');
    expect(permissions).toContain('project:create');
    expect(permissions).toContain('generation:run');
    expect(permissions).toContain('blueprint:publish');
    expect(permissions.length).toBeGreaterThan(25);
  });

  it('every role grants a non-empty permission set', () => {
    for (const role of RoleName.options) {
      expect(getRolePermissions(role).length).toBeGreaterThan(0);
    }
  });

  it('owner is a superset of editor permissions', () => {
    const owner = new Set(getRolePermissions('owner'));
    const editor = getRolePermissions('editor');
    for (const perm of editor) {
      expect(owner.has(perm), `owner missing ${perm}`).toBe(true);
    }
  });

  it('viewer does NOT include generation:run', () => {
    const viewer = new Set(getRolePermissions('viewer'));
    expect(viewer.has('generation:run')).toBe(false);
  });

  it('viewer does NOT include task:execute', () => {
    const viewer = new Set(getRolePermissions('viewer'));
    expect(viewer.has('task:execute')).toBe(false);
  });

  it('ROLE_DEFINITIONS can be validated by the RoleDefinition schema', () => {
    for (const roleName of RoleName.options) {
      const def = ROLE_DEFINITIONS[roleName as RoleName];
      expect(() => RoleDefinition.parse(def)).not.toThrow();
    }
  });
});

// ──────────────────────────────────────────────────────────────────────
// Phase 1 — Task 2 tests (new)
// ──────────────────────────────────────────────────────────────────────

// Stable fixture IDs used across execution-domain tests.
const USER_ID = '11111111-1111-1111-1111-111111111111';
const ORG_ID = '22222222-2222-2222-2222-222222222222';
const WORKSPACE_ID = '33333333-3333-3333-3333-333333333333';
const PROJECT_ID = '44444444-4444-4444-4444-444444444444';
const TASK_ID = '55555555-5555-5555-5555-555555555555';
const RUN_ID = '66666666-6666-6666-6666-666666666666';
const ARTIFACT_ID = '77777777-7777-7777-7777-777777777777';
const AUDIT_ID = '88888888-8888-8888-8888-888888888888';

const now = () => new Date();

describe('Project schema', () => {
  const base = () => ({
    id: PROJECT_ID,
    workspaceId: WORKSPACE_ID,
    name: 'Work-Order App',
    slug: 'work-order-app',
    createdBy: USER_ID,
    createdAt: now(),
    updatedAt: now(),
  });

  it('defaults status to "draft" when omitted', () => {
    const p = Project.parse(base());
    expect(p.status).toBe('draft');
  });

  it('parses a valid project with explicit status', () => {
    const p = Project.parse({ ...base(), status: 'active' });
    expect(p.status).toBe('active');
  });

  it('rejects an uppercase slug', () => {
    expect(() => Project.parse({ ...base(), slug: 'WorkOrder' })).toThrow();
  });

  it('rejects a project missing workspaceId', () => {
    expect(() => Project.parse({ ...base(), workspaceId: undefined })).toThrow();
  });

  it('rejects a project missing createdBy', () => {
    expect(() => Project.parse({ ...base(), createdBy: undefined })).toThrow();
  });

  it('CreateProjectInput accepts input without createdBy (ADR-0006)', () => {
    // `createdBy` is derived from the session server-side, so the input
    // shape deliberately excludes it.
    const input = CreateProjectInput.parse({
      workspaceId: WORKSPACE_ID,
      name: 'Work-Order App',
      slug: 'work-order-app-2',
    });
    expect(input).not.toHaveProperty('createdBy');
  });

  it('CreateProjectInput rejects a project missing workspaceId', () => {
    expect(() =>
      CreateProjectInput.parse({ name: 'x', slug: 'x' })
    ).toThrow();
  });

  it('ProjectSlug rejects an overlong slug', () => {
    expect(() => ProjectSlug.parse('a'.repeat(65))).toThrow();
  });
});

describe('Task schema', () => {
  const base = () => ({
    id: TASK_ID,
    workspaceId: WORKSPACE_ID,
    projectId: PROJECT_ID,
    type: 'generate-app',
    title: 'Generate extrusion MES app',
    createdBy: USER_ID,
    createdAt: now(),
    updatedAt: now(),
  });

  it('defaults status to "draft" when omitted', () => {
    const t = Task.parse(base());
    expect(t.status).toBe('draft');
  });

  it('rejects an unknown task type', () => {
    expect(() => Task.parse({ ...base(), type: 'fly-to-moon' })).toThrow();
  });

  it('rejects an unknown status', () => {
    expect(() =>
      Task.parse({ ...base(), status: 'in-progress' as unknown as TaskStatus })
    ).toThrow();
  });

  it('allows a nullish inputPrompt for draft tasks', () => {
    const t = Task.parse(base());
    expect(t.inputPrompt).toBeUndefined();
  });

  it('accepts an inputPrompt up to the size limit', () => {
    const t = Task.parse({ ...base(), inputPrompt: 'Build the thing'.repeat(10) });
    expect(t.inputPrompt).toBeDefined();
  });

  it('CreateTaskInput accepts input without createdBy (ADR-0006)', () => {
    const input = CreateTaskInput.parse({
      workspaceId: WORKSPACE_ID,
      projectId: PROJECT_ID,
      type: 'generate-app',
      title: 'Draft task',
    });
    expect(input).not.toHaveProperty('createdBy');
  });
});

describe('isTaskTerminal', () => {
  it('succeeded, failed, cancelled are terminal', () => {
    expect(isTaskTerminal('succeeded')).toBe(true);
    expect(isTaskTerminal('failed')).toBe(true);
    expect(isTaskTerminal('cancelled')).toBe(true);
  });

  it('draft, queued, running are non-terminal', () => {
    expect(isTaskTerminal('draft')).toBe(false);
    expect(isTaskTerminal('queued')).toBe(false);
    expect(isTaskTerminal('running')).toBe(false);
  });

  it('all TaskStatus values are classified exactly once', () => {
    const classified = new Set<string>();
    for (const status of TaskStatus.options) {
      expect(typeof isTaskTerminal(status)).toBe('boolean');
      classified.add(status);
    }
    expect(classified.size).toBe(TaskStatus.options.length);
  });
});

describe('GenerationRun schema', () => {
  const base = () => ({
    id: RUN_ID,
    workspaceId: WORKSPACE_ID,
    projectId: PROJECT_ID,
    taskId: TASK_ID,
    runNumber: 1,
    snapshot: {},
    createdBy: USER_ID,
    createdAt: now(),
    updatedAt: now(),
  });

  it('defaults status to "pending"', () => {
    const r = GenerationRun.parse(base());
    expect(r.status).toBe('pending');
  });

  it('rejects runNumber of zero', () => {
    expect(() => GenerationRun.parse({ ...base(), runNumber: 0 })).toThrow();
  });

  it('rejects non-integer runNumber', () => {
    expect(() => GenerationRun.parse({ ...base(), runNumber: 1.5 })).toThrow();
  });

  it('accepts a fully-populated snapshot', () => {
    const r = GenerationRun.parse({
      ...base(),
      snapshot: {
        specId: 'spec-abc',
        specHash: 'deadbeef',
        blueprintPlanId: 'bp-xyz',
        blueprintPlanHash: 'cafebabe',
      },
    });
    expect(r.snapshot.specId).toBe('spec-abc');
    expect(r.snapshot.blueprintPlanHash).toBe('cafebabe');
  });

  it('accepts an empty snapshot (all fields optional)', () => {
    const parsed = GenerationRunSnapshot.parse({});
    expect(parsed.specId).toBeUndefined();
    expect(parsed.specHash).toBeUndefined();
  });

  it('CreateGenerationRunInput accepts input without createdBy (ADR-0006)', () => {
    const input = CreateGenerationRunInput.parse({
      workspaceId: WORKSPACE_ID,
      projectId: PROJECT_ID,
      taskId: TASK_ID,
    });
    expect(input).not.toHaveProperty('createdBy');
  });

  it('CreateGenerationRunInput rejects input missing workspaceId', () => {
    expect(() =>
      CreateGenerationRunInput.parse({ projectId: PROJECT_ID, taskId: TASK_ID })
    ).toThrow();
  });
});

describe('isGenerationRunTerminal', () => {
  it('succeeded, failed, cancelled are terminal', () => {
    expect(isGenerationRunTerminal('succeeded')).toBe(true);
    expect(isGenerationRunTerminal('failed')).toBe(true);
    expect(isGenerationRunTerminal('cancelled')).toBe(true);
  });

  it('pending and running are non-terminal', () => {
    expect(isGenerationRunTerminal('pending')).toBe(false);
    expect(isGenerationRunTerminal('running')).toBe(false);
  });

  it('every GenerationRunStatus value is classified', () => {
    for (const status of GenerationRunStatus.options) {
      expect(typeof isGenerationRunTerminal(status)).toBe('boolean');
    }
  });
});

describe('Artifact schema', () => {
  const baseArtifact = () => ({
    id: ARTIFACT_ID,
    workspaceId: WORKSPACE_ID,
    projectId: PROJECT_ID,
    taskId: TASK_ID,
    generationRunId: RUN_ID,
    kind: 'code',
    storageKind: 'inline',
    name: 'src/routes/work-orders.ts',
    textContent: 'export const handler = () => { ... };',
    createdBy: USER_ID,
    createdAt: now(),
  });

  it('parses a valid inline artifact', () => {
    const a = Artifact.parse(baseArtifact());
    expect(a.kind).toBe('code');
    expect(a.storageKind).toBe('inline');
    expect(a.textContent).toBeDefined();
  });

  it('rejects an unknown artifact kind', () => {
    expect(() =>
      Artifact.parse({ ...baseArtifact(), kind: 'poem' })
    ).toThrow();
  });

  it('rejects an unknown storage kind', () => {
    expect(() =>
      Artifact.parse({ ...baseArtifact(), storageKind: 's3' })
    ).toThrow();
  });

  it('rejects negative byteSize', () => {
    expect(() =>
      Artifact.parse({ ...baseArtifact(), byteSize: -1 })
    ).toThrow();
  });

  it('accepts zero byteSize', () => {
    const a = Artifact.parse({ ...baseArtifact(), byteSize: 0 });
    expect(a.byteSize).toBe(0);
  });

  it('requires storageUrl to be a URL when provided', () => {
    expect(() =>
      Artifact.parse({
        ...baseArtifact(),
        storageKind: 'url',
        storageUrl: 'not a url',
      })
    ).toThrow();
  });

  it('all ArtifactKind enum values are recognized', () => {
    expect(ArtifactKind.options.length).toBeGreaterThanOrEqual(9);
    expect(ArtifactKind.options).toContain('blueprint-plan');
    expect(ArtifactKind.options).toContain('migration');
  });

  it('all ArtifactStorageKind values are recognized', () => {
    expect(ArtifactStorageKind.options).toEqual(['inline', 'url', 'git']);
  });

  it('CreateArtifactInput accepts input without createdBy (ADR-0006)', () => {
    const input = CreateArtifactInput.parse({
      workspaceId: WORKSPACE_ID,
      projectId: PROJECT_ID,
      taskId: TASK_ID,
      generationRunId: RUN_ID,
      kind: 'code',
      storageKind: 'inline',
      name: 'src/routes/work-orders.ts',
    });
    expect(input).not.toHaveProperty('createdBy');
  });

  it('CreateArtifactInput rejects input missing generationRunId', () => {
    expect(() =>
      CreateArtifactInput.parse({
        workspaceId: WORKSPACE_ID,
        projectId: PROJECT_ID,
        taskId: TASK_ID,
        kind: 'code',
        storageKind: 'inline',
        name: 'x',
      })
    ).toThrow();
  });
});

describe('hasInlineContent', () => {
  const makeArtifact = (storageKind: 'inline' | 'url' | 'git', textContent?: string | null) =>
    Artifact.parse({
      id: ARTIFACT_ID,
      workspaceId: WORKSPACE_ID,
      projectId: PROJECT_ID,
      taskId: TASK_ID,
      generationRunId: RUN_ID,
      kind: 'code',
      storageKind,
      name: 'src/thing.ts',
      textContent: textContent ?? undefined,
      createdBy: USER_ID,
      createdAt: now(),
    });

  it('returns true for inline with non-null content', () => {
    expect(hasInlineContent(makeArtifact('inline', 'const x = 1;'))).toBe(true);
  });

  it('returns false for inline with null content', () => {
    expect(hasInlineContent(makeArtifact('inline', null))).toBe(false);
  });

  it('returns false for inline with undefined content', () => {
    expect(hasInlineContent(makeArtifact('inline'))).toBe(false);
  });

  it('returns false for url storage kind even with textContent set', () => {
    // Unusual but defensive: if a mis-configured url artifact has
    // textContent lying around, hasInlineContent should still say no.
    expect(hasInlineContent(makeArtifact('url', 'oops'))).toBe(false);
  });
});

describe('AuditLogEntry schema', () => {
  const base = () => ({
    id: AUDIT_ID,
    organizationId: ORG_ID,
    entityType: 'task',
    entityId: TASK_ID,
    action: 'status-changed',
    actorId: USER_ID,
    createdAt: now(),
  });

  it('parses a minimal audit entry', () => {
    const entry = AuditLogEntry.parse(base());
    expect(entry.workspaceId).toBeUndefined();
    expect(entry.before).toBeUndefined();
  });

  it('accepts a full audit entry with before/after snapshots', () => {
    const entry = AuditLogEntry.parse({
      ...base(),
      workspaceId: WORKSPACE_ID,
      reason: 'User clicked approve',
      before: { status: 'pending' },
      after: { status: 'running', startedAt: '2026-07-09T10:00:00Z' },
      metadata: { ip: '10.0.0.1', userAgent: 'hey-nxt/1.0' },
    });
    expect(entry.before).toEqual({ status: 'pending' });
    expect(entry.after).toHaveProperty('startedAt');
  });

  it('rejects unknown entity type', () => {
    expect(() => AuditLogEntry.parse({ ...base(), entityType: 'invoice' })).toThrow();
  });

  it('rejects unknown action', () => {
    expect(() => AuditLogEntry.parse({ ...base(), action: 'blessed' })).toThrow();
  });

  it('every AuditEntityType and AuditAction value parses', () => {
    for (const entityType of AuditEntityType.options) {
      expect(() => AuditLogEntry.parse({ ...base(), entityType })).not.toThrow();
    }
    for (const action of AuditAction.options) {
      expect(() => AuditLogEntry.parse({ ...base(), action })).not.toThrow();
    }
  });
});

describe('createStatusChangeEntry helper', () => {
  it('produces action "status-changed" with before/after snapshots', () => {
    const createdAt = new Date('2026-07-09T10:00:00Z');
    const entry = createStatusChangeEntry({
      id: AUDIT_ID,
      organizationId: ORG_ID,
      workspaceId: WORKSPACE_ID,
      entityType: 'task',
      entityId: TASK_ID,
      actorId: USER_ID,
      previousStatus: 'draft',
      newStatus: 'queued',
      createdAt,
    });

    expect(entry.action).toBe('status-changed');
    expect(entry.before).toEqual({ status: 'draft' });
    expect(entry.after).toEqual({ status: 'queued' });
    expect(entry.reason).toBeNull();
    expect(entry.metadata).toBeNull();
    expect(entry.createdAt).toBe(createdAt);
  });

  it('handles null previousStatus (first transition, no prior state)', () => {
    const entry = createStatusChangeEntry({
      id: AUDIT_ID,
      organizationId: ORG_ID,
      entityType: 'project',
      entityId: PROJECT_ID,
      actorId: USER_ID,
      previousStatus: null,
      newStatus: 'draft',
      createdAt: now(),
    });

    expect(entry.before).toBeNull();
    expect(entry.after).toEqual({ status: 'draft' });
    expect(entry.workspaceId).toBeNull();
  });

  it('passes through the optional reason field', () => {
    const entry = createStatusChangeEntry({
      id: AUDIT_ID,
      organizationId: ORG_ID,
      entityType: 'generation-run',
      entityId: RUN_ID,
      actorId: USER_ID,
      previousStatus: 'running',
      newStatus: 'failed',
      reason: 'agent timeout after 300s',
      createdAt: now(),
    });

    expect(entry.reason).toBe('agent timeout after 300s');
  });
});
