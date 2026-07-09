/**
 * <CreateWorkspaceForm> — client-side form for creating a workspace.
 *
 * This is the one piece of the workspaces page that has to run in the
 * browser: the form collects input, POSTs JSON to /api/workspaces,
 * handles inline validation errors, and redirects back to the list on
 * success.
 *
 * Everything else on the workspaces page is a Server Component — this
 * file is the only one marked "use client".
 */
'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useState, type FormEvent } from 'react';

import { CreateWorkspaceInput } from '@heynxt/core-types';

const SEED_ORG_ID = '00000000-0000-0000-0000-000000000010';

export function CreateWorkspaceForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const orgIdFromUrl = searchParams.get('orgId') ?? '';

  const [organizationId, setOrganizationId] = useState(
    orgIdFromUrl || SEED_ORG_ID,
  );
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setFieldErrors({});

    // Client-side parse so we can surface Zod errors inline.
    const parsed = CreateWorkspaceInput.safeParse({
      organizationId,
      name,
      slug,
      description: description || undefined,
    });
    if (!parsed.success) {
      const fields: Record<string, string[]> = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path.join('.') || '_root';
        (fields[key] ??= []).push(issue.message);
      }
      setFieldErrors(fields);
      return;
    }

    setSubmitting(true);
    fetch('/api/workspaces', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(parsed.data),
    })
      .then(async (res) => {
        const body = await res.json().catch(() => ({}));
        if (!res.ok) {
          const msg =
            (body as { error?: string }).error ?? `Request failed (${res.status})`;
          const fields = (body as { fields?: Record<string, string[]> }).fields;
          throw { message: msg, fields };
        }
        return body;
      })
      .then(() => {
        // Refresh the list by navigating to the same URL.
        router.refresh();
        setName('');
        setSlug('');
        setDescription('');
      })
      .catch((err) => {
        if (err && typeof err === 'object' && 'message' in err) {
          setError((err as { message: string }).message);
          const fields = (err as { fields?: Record<string, string[]> }).fields;
          if (fields) setFieldErrors(fields);
        } else {
          setError('Network error');
        }
      })
      .finally(() => setSubmitting(false));
  }

  return (
    <form
      onSubmit={onSubmit}
      style={{
        border: '1px solid #eaeaea',
        borderRadius: 6,
        padding: '1rem',
        background: '#fff',
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: '0.75rem',
      }}
    >
      <h3 style={{ gridColumn: '1 / -1', margin: '0 0 0.25rem', fontSize: 14 }}>
        Create workspace
      </h3>

      <label style={{ display: 'flex', flexDirection: 'column', fontSize: 13 }}>
        Organization ID
        <input
          value={organizationId}
          onChange={(e) => setOrganizationId(e.target.value)}
          required
          style={inputStyle}
        />
        {fieldErrors.organizationId && (
          <span style={errStyle}>{fieldErrors.organizationId.join(', ')}</span>
        )}
      </label>

      <label style={{ display: 'flex', flexDirection: 'column', fontSize: 13 }}>
        Name
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          placeholder="e.g. Production"
          style={inputStyle}
        />
        {fieldErrors.name && (
          <span style={errStyle}>{fieldErrors.name.join(', ')}</span>
        )}
      </label>

      <label style={{ display: 'flex', flexDirection: 'column', fontSize: 13 }}>
        Slug
        <input
          value={slug}
          onChange={(e) => setSlug(e.target.value)}
          required
          placeholder="e.g. production"
          style={inputStyle}
        />
        {fieldErrors.slug && (
          <span style={errStyle}>{fieldErrors.slug.join(', ')}</span>
        )}
      </label>

      <label style={{ display: 'flex', flexDirection: 'column', fontSize: 13 }}>
        Description (optional)
        <input
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Short description"
          style={inputStyle}
        />
      </label>

      {error && (
        <div
          style={{
            gridColumn: '1 / -1',
            color: '#c00',
            fontSize: 13,
            padding: '0.5rem',
            background: '#fff5f5',
            borderRadius: 4,
          }}
        >
          {error}
        </div>
      )}

      <div style={{ gridColumn: '1 / -1', display: 'flex', gap: '0.5rem' }}>
        <button
          type="submit"
          disabled={submitting}
          style={{
            background: '#0070f3',
            color: '#fff',
            border: 'none',
            padding: '0.5rem 1rem',
            borderRadius: 4,
            cursor: submitting ? 'not-allowed' : 'pointer',
            fontSize: 13,
          }}
        >
          {submitting ? 'Creating…' : 'Create workspace'}
        </button>
      </div>
    </form>
  );
}

const inputStyle: React.CSSProperties = {
  marginTop: 4,
  padding: '0.4rem 0.5rem',
  border: '1px solid #d0d0d0',
  borderRadius: 4,
  fontSize: 13,
};

const errStyle: React.CSSProperties = {
  marginTop: 2,
  color: '#c00',
  fontSize: 12,
};
