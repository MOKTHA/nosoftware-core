/**
 * <CreateTaskForm> — client-side form for creating a task.
 *
 * This is the one piece of the tasks page that has to run in the
 * browser: the form collects input, POSTs JSON to /api/tasks,
 * handles inline validation errors, and refreshes the list on
 * success.
 *
 * Everything else on the tasks page is a Server Component — this
 * file is the only one marked "use client".
 */
'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useState, type FormEvent } from 'react';

import { CreateTaskInput, TaskType } from '@heynxt/core-types';

const SEED_WS_ID = '00000000-0000-0000-0000-000000000100';
const SEED_PROJECT_ID = '00000000-0000-0000-0000-000000010001';

export function CreateTaskForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const wsIdFromUrl = searchParams.get('workspaceId') ?? '';

  const [workspaceId, setWorkspaceId] = useState(wsIdFromUrl || SEED_WS_ID);
  const [projectId, setProjectId] = useState(SEED_PROJECT_ID);
  const [type, setType] = useState<TaskType>(TaskType.options[0]!);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [inputPrompt, setInputPrompt] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setFieldErrors({});

    // Client-side parse so we can surface Zod errors inline.
    // `createdBy` is no longer accepted by the schema — the API
    // reads it from the authenticated session (see ADR-0006).
    const parsed = CreateTaskInput.safeParse({
      workspaceId,
      projectId,
      type,
      title,
      description: description || undefined,
      inputPrompt: inputPrompt || undefined,
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
    fetch('/api/tasks', {
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
        // Refresh the list (RSC re-fetches). Keep dropdowns/selects at
        // their current selection for sensible UX.
        router.refresh();
        setTitle('');
        setDescription('');
        setInputPrompt('');
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
        Create task
      </h3>

      <label style={{ display: 'flex', flexDirection: 'column', fontSize: 13 }}>
        Workspace ID
        <input
          value={workspaceId}
          onChange={(e) => setWorkspaceId(e.target.value)}
          required
          style={inputStyle}
        />
        {fieldErrors.workspaceId && (
          <span style={errStyle}>{fieldErrors.workspaceId.join(', ')}</span>
        )}
      </label>

      <label style={{ display: 'flex', flexDirection: 'column', fontSize: 13 }}>
        {/* TODO: Replace with project dropdown once projects are loaded per workspace. */}
        Project ID
        <input
          value={projectId}
          onChange={(e) => setProjectId(e.target.value)}
          required
          style={inputStyle}
        />
        {fieldErrors.projectId && (
          <span style={errStyle}>{fieldErrors.projectId.join(', ')}</span>
        )}
      </label>

      <label style={{ display: 'flex', flexDirection: 'column', fontSize: 13 }}>
        Type
        <select
          value={type}
          onChange={(e) => setType(e.target.value as TaskType)}
          style={inputStyle}
        >
          {TaskType.options.map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </select>
        {fieldErrors.type && (
          <span style={errStyle}>{fieldErrors.type.join(', ')}</span>
        )}
      </label>

      <label style={{ display: 'flex', flexDirection: 'column', fontSize: 13 }}>
        Title
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
          placeholder="e.g. Draft extrusion routing builder"
          style={inputStyle}
        />
        {fieldErrors.title && (
          <span style={errStyle}>{fieldErrors.title.join(', ')}</span>
        )}
      </label>

      <label
        style={{
          display: 'flex',
          flexDirection: 'column',
          fontSize: 13,
          gridColumn: '1 / -1',
        }}
      >
        Description (optional)
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Short description"
          rows={2}
          style={{ ...inputStyle, resize: 'vertical' }}
        />
        {fieldErrors.description && (
          <span style={errStyle}>{fieldErrors.description.join(', ')}</span>
        )}
      </label>

      <label
        style={{
          display: 'flex',
          flexDirection: 'column',
          fontSize: 13,
          gridColumn: '1 / -1',
        }}
      >
        Input Prompt / Spec (optional)
        <textarea
          value={inputPrompt}
          onChange={(e) => setInputPrompt(e.target.value)}
          placeholder="Prompt or spec input for this task"
          rows={3}
          style={{ ...inputStyle, resize: 'vertical' }}
        />
        {fieldErrors.inputPrompt && (
          <span style={errStyle}>{fieldErrors.inputPrompt.join(', ')}</span>
        )}
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
          {submitting ? 'Creating…' : 'Create task'}
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
