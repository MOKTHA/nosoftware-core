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
} from '../index.js';

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
    expect(parsed.imageUrl).toBeUndefined(); // nullish field not provided
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
