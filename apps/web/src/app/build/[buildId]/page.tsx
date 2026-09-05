/**
 * /build/[buildId] — Build page with tasks sidebar, chat, and build studio.
 *
 * Layout:
 *   ┌──────────┬─────────────────┬──────────────────┐
 *   │  Tasks   │  Chat + Code    │   BuildStudio    │
 *   │ Sidebar  │   Snippets      │  (collapsible    │
 *   │ (builds) │                 │   preview)       │
 *   └──────────┴─────────────────┴──────────────────┘
 *
 * - Tasks sidebar: all previous builds, clickable to navigate
 * - Chat: shows prompt, Claude-style code snippets per build step
 * - BuildStudio: collapsible live preview + agent status
 */
'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { BuildStudio, STEP_VERBS } from '@/components/BuildStudio';
import type { BuildEvent } from '@/components/BuildStudio';

/* ------------------------------------------------------------------ */
/*  Types                                                             */
/* ------------------------------------------------------------------ */

interface BuildRecord {
  id: string;
  appName: string;
  prompt: string | null;
  status: 'pending' | 'running' | 'succeeded' | 'failed';
  deployedUrl: string | null;
  errorMessage: string | null;
  createdAt: string;
  updatedAt: string | null;
}

interface BuildListItem {
  id: string;
  appName: string;
  status: string;
  deployedUrl: string | null;
  createdAt: string;
}

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  /** If present, renders as a code snippet block */
  codeSnippet?: {
    stage: string;
    status: string;
    detail: string;
    elapsed: number;
  };
}

/* ------------------------------------------------------------------ */
/*  Code snippet labels                                               */
/* ------------------------------------------------------------------ */

const STEP_SNIPPETS: Record<string, { title: string; desc: string }> = {
  'normalize-spec': {
    title: 'Spec Analysis',
    desc: 'Parsed app requirements and validated schema structure.',
  },
  'resolve-blueprint-plan': {
    title: 'Blueprint Resolution',
    desc: 'Selected domain blueprint and mapped entity relationships.',
  },
  'generate-schema': {
    title: 'Database Schema',
    desc: 'Generated Drizzle ORM schema with tables, indexes, and relations.',
  },
  'generate-permissions': {
    title: 'Auth & Permissions',
    desc: 'Configured NextAuth.js with role-based access control.',
  },
  'generate-backend': {
    title: 'API Routes',
    desc: 'Created RESTful CRUD endpoints for all entities.',
  },
  'generate-frontend': {
    title: 'UI Components',
    desc: 'Built React pages with forms, tables, and navigation.',
  },
  'generate-workflows': {
    title: 'Business Logic',
    desc: 'Implemented workflow rules and state transitions.',
  },
  'generate-fixtures-tests': {
    title: 'Test Data & Seeds',
    desc: 'Generated fixture data and seed scripts.',
  },
  'generate-deployment': {
    title: 'Deploy Config',
    desc: 'Prepared next.config, env vars, and Vercel settings.',
  },
  'deploy-to-vercel': {
    title: 'Deployment',
    desc: 'Uploaded files, created deployment, and verified live URL.',
  },
};

/* ------------------------------------------------------------------ */
/*  Component                                                         */
/* ------------------------------------------------------------------ */

export default function BuildDetailPage() {
  const { buildId } = useParams<{ buildId: string }>();
  const router = useRouter();

  const [build, setBuild] = useState<BuildRecord | null>(null);
  const [allBuilds, setAllBuilds] = useState<BuildListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deployedUrl, setDeployedUrl] = useState<string | null>(null);
  const [filesReady, setFilesReady] = useState(false);
  const [tasksSidebarOpen, setTasksSidebarOpen] = useState(true);

  // Chat state
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [rebuilding, setRebuilding] = useState(false);
  // Track which steps we've already added snippets for
  const addedStepsRef = useRef<Set<string>>(new Set());

  const chatEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  /* ---------------------------------------------------------------- */
  /*  Fetch builds list                                               */
  /* ---------------------------------------------------------------- */

  useEffect(() => {
    fetch('/api/builds')
      .then((r) => r.json())
      .then((data: { builds: BuildListItem[] }) => setAllBuilds(data.builds))
      .catch(() => {});
  }, []);

  /* ---------------------------------------------------------------- */
  /*  Fetch build on mount                                            */
  /* ---------------------------------------------------------------- */

  const fetchBuild = useCallback(async () => {
    try {
      const res = await fetch(`/api/builds/${buildId}`);
      if (!res.ok) {
        setError(res.status === 404 ? 'Build not found' : `Failed to load build (${res.status})`);
        return;
      }
      const data = (await res.json()) as BuildRecord;
      setBuild(data);

      // Seed the chat with the original prompt
      if (data.prompt && chatMessages.length === 0) {
        const msgs: ChatMessage[] = [
          {
            role: 'user',
            content: data.prompt,
            timestamp: new Date(data.createdAt).getTime(),
          },
        ];

        if (data.status === 'succeeded') {
          msgs.push({
            role: 'assistant',
            content: `✓ Built **${data.appName}** successfully.${data.deployedUrl ? `\nDeployed to ${data.deployedUrl}` : ''}\n\nNeed changes? Describe what you'd like to modify below.`,
            timestamp: data.updatedAt ? new Date(data.updatedAt).getTime() : Date.now(),
          });
        } else if (data.status === 'failed') {
          msgs.push({
            role: 'assistant',
            content: `✗ Build failed${data.errorMessage ? `: ${data.errorMessage}` : ''}.\n\nDescribe the fix or try a different approach below.`,
            timestamp: data.updatedAt ? new Date(data.updatedAt).getTime() : Date.now(),
          });
        } else {
          msgs.push({
            role: 'assistant',
            content: `Building **${data.appName}**… I'll show progress as each stage completes.`,
            timestamp: Date.now(),
          });
        }

        setChatMessages(msgs);
      }

      if (data.status === 'succeeded' && data.deployedUrl) {
        setDeployedUrl(data.deployedUrl);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [buildId]);

  useEffect(() => {
    fetchBuild();
  }, [fetchBuild]);

  /* ---------------------------------------------------------------- */
  /*  Step update → code snippet in chat                              */
  /* ---------------------------------------------------------------- */

  function handleStepUpdate(event: BuildEvent) {
    // Only add snippet when a step completes (done/error), not on 'running'
    if (event.status !== 'done' && event.status !== 'error') return;
    // Skip pipeline-level and meta events
    if (event.step === 'pipeline' || event.step === 'files-collected') return;
    // Don't duplicate
    if (addedStepsRef.current.has(event.step)) return;
    addedStepsRef.current.add(event.step);

    const snippet = STEP_SNIPPETS[event.step];
    if (!snippet) return;

    setChatMessages((prev) => [
      ...prev,
      {
        role: 'assistant',
        content: '',
        timestamp: Date.now(),
        codeSnippet: {
          stage: snippet.title,
          status: event.status,
          detail: snippet.desc,
          elapsed: event.elapsed_ms,
        },
      },
    ]);
  }

  /* ---------------------------------------------------------------- */
  /*  Deployed callback                                               */
  /* ---------------------------------------------------------------- */

  function handleDeployed(url: string) {
    setDeployedUrl(url);
    fetchBuild();

    setChatMessages((prev) => {
      const withoutBuilding = prev.filter(
        (m) => !(m.role === 'assistant' && m.content.startsWith('Building')),
      );
      return [
        ...withoutBuilding,
        {
          role: 'assistant' as const,
          content: `✓ Built and deployed successfully!\n${url}\n\nNeed changes? Describe what you'd like to modify below.`,
          timestamp: Date.now(),
        },
      ];
    });
  }

  /* ---------------------------------------------------------------- */
  /*  Handle change request → rebuild                                 */
  /* ---------------------------------------------------------------- */

  async function handleRebuild() {
    const input = chatInput.trim();
    if (!input || rebuilding || !build) return;

    setChatInput('');
    setRebuilding(true);

    setChatMessages((prev) => [
      ...prev,
      { role: 'user', content: input, timestamp: Date.now() },
      {
        role: 'assistant',
        content: '⟳ Creating a new build with your changes…',
        timestamp: Date.now(),
      },
    ]);

    try {
      const originalPrompt = build.prompt ?? '';
      const fullPrompt = `${originalPrompt}\n\nChanges requested:\n- ${input}`;

      const res = await fetch('/api/builds', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: fullPrompt,
          appName: build.appName,
        }),
      });

      if (!res.ok) throw new Error(await res.text());

      const { buildId: newBuildId } = (await res.json()) as { buildId: string };
      router.push(`/build/${newBuildId}`);
    } catch (err) {
      setChatMessages((prev) => [
        ...prev.filter((m) => !m.content.startsWith('⟳')),
        {
          role: 'assistant',
          content: `✗ Failed to create rebuild: ${err instanceof Error ? err.message : String(err)}`,
          timestamp: Date.now(),
        },
      ]);
      setRebuilding(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleRebuild();
    }
  }

  /* ---------------------------------------------------------------- */
  /*  Render                                                          */
  /* ---------------------------------------------------------------- */

  if (loading) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        height: 'calc(100vh - 5rem)', gap: '0.5rem', color: '#a3a3a3', fontSize: '0.875rem',
      }}>
        <Spinner /> Loading build…
      </div>
    );
  }

  if (error) {
    return (
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        height: 'calc(100vh - 5rem)', gap: '1rem',
      }}>
        <div style={{
          width: 48, height: 48, borderRadius: '50%', background: '#fef2f2',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '1.25rem', color: '#dc2626',
        }}>✗</div>
        <p style={{ color: '#dc2626', fontSize: '0.875rem', margin: 0 }}>{error}</p>
        <a href="/build" style={{ fontSize: '0.8125rem', color: '#0a0a0a', textDecoration: 'underline' }}>← Start a new build</a>
      </div>
    );
  }

  if (!build) return null;

  const isTerminal = build.status === 'succeeded' || build.status === 'failed';

  return (
    <div
      style={{
        display: 'flex',
        height: 'calc(100vh - 5rem)',
        gap: 0,
        fontFamily: 'system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", sans-serif',
      }}
    >
      {/* ── Far left: Tasks sidebar (previous builds) ────────── */}
      <div
        style={{
          width: tasksSidebarOpen ? 220 : 44,
          flexShrink: 0,
          background: '#fafafa',
          borderRight: '1px solid #e5e5e5',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          transition: 'width 0.2s ease',
        }}
      >
        {/* Toggle header */}
        <div
          style={{
            padding: tasksSidebarOpen ? '0.625rem 0.75rem' : '0.625rem 0',
            borderBottom: '1px solid #e5e5e5',
            background: '#f5f5f5',
            display: 'flex',
            alignItems: 'center',
            justifyContent: tasksSidebarOpen ? 'space-between' : 'center',
            minHeight: 40,
          }}
        >
          {tasksSidebarOpen && (
            <span style={{
              fontSize: '0.6875rem', fontWeight: 600, textTransform: 'uppercase',
              letterSpacing: '0.05em', color: '#737373',
            }}>
              Builds
            </span>
          )}
          <button
            onClick={() => setTasksSidebarOpen(!tasksSidebarOpen)}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              padding: '0.25rem', color: '#737373', fontSize: '0.875rem', lineHeight: 1,
            }}
            title={tasksSidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}
          >
            {tasksSidebarOpen ? '◀' : '▶'}
          </button>
        </div>

        {/* Builds list */}
        {tasksSidebarOpen && (
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {allBuilds.map((b) => {
              const isActive = b.id === buildId;
              return (
                <a
                  key={b.id}
                  href={`/build/${b.id}`}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.125rem',
                    padding: '0.5rem 0.75rem',
                    textDecoration: 'none',
                    borderBottom: '1px solid #f0f0f0',
                    background: isActive ? '#e8e8e8' : 'transparent',
                    borderLeft: isActive ? '3px solid #0a0a0a' : '3px solid transparent',
                    transition: 'background 0.1s',
                  }}
                >
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: '0.375rem',
                  }}>
                    <span style={{
                      width: 7, height: 7, borderRadius: '50%', flexShrink: 0,
                      background: b.status === 'succeeded' ? '#16a34a'
                        : b.status === 'failed' ? '#dc2626'
                        : b.status === 'running' ? '#eab308'
                        : '#a3a3a3',
                    }} />
                    <span style={{
                      fontSize: '0.75rem', fontWeight: isActive ? 600 : 400,
                      color: '#0a0a0a', overflow: 'hidden', textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap', flex: 1,
                    }}>
                      {b.appName}
                    </span>
                  </div>
                  <span style={{
                    fontSize: '0.625rem', color: '#a3a3a3',
                    paddingLeft: '1.125rem',
                  }}>
                    {formatRelativeTime(b.createdAt)}
                  </span>
                </a>
              );
            })}
            {allBuilds.length === 0 && (
              <div style={{ padding: '1rem 0.75rem', fontSize: '0.75rem', color: '#a3a3a3', textAlign: 'center' }}>
                No builds yet
              </div>
            )}
          </div>
        )}

        {/* New build link at bottom */}
        {tasksSidebarOpen && (
          <a
            href="/build"
            style={{
              padding: '0.625rem 0.75rem',
              borderTop: '1px solid #e5e5e5',
              fontSize: '0.75rem',
              color: '#525252',
              textDecoration: 'none',
              display: 'flex',
              alignItems: 'center',
              gap: '0.375rem',
              fontWeight: 500,
            }}
          >
            <span style={{ fontSize: '1rem', lineHeight: 1 }}>+</span> New Build
          </a>
        )}
      </div>

      {/* ── Center: Chat panel ───────────────────────────── */}
      <div
        style={{
          flex: '0 0 340px',
          maxWidth: '340px',
          display: 'flex',
          flexDirection: 'column',
          borderRight: '1px solid #e5e5e5',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '0.625rem 0.75rem',
            borderBottom: '1px solid #e5e5e5',
            background: '#fafafa',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
              {filesReady && (
                <a
                  href={`/build/${buildId}/code`}
                  style={{
                    fontSize: '0.6875rem', color: '#525252', background: '#f5f5f5',
                    padding: '0.2rem 0.625rem', borderRadius: '9999px', textDecoration: 'none',
                    fontWeight: 500, border: '1px solid #e5e5e5',
                  }}
                >
                  &lt;/&gt; Code
                </a>
              )}
              {deployedUrl && (
                <a
                  href={deployedUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    fontSize: '0.6875rem', color: '#ffffff', background: '#0a0a0a',
                    padding: '0.2rem 0.625rem', borderRadius: '9999px', textDecoration: 'none',
                    fontWeight: 500,
                  }}
                >
                  Open App ↗
                </a>
              )}
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.25rem' }}>
            <h2 style={{
              fontSize: '0.9375rem', fontWeight: 600, color: '#0a0a0a', margin: 0,
              letterSpacing: '-0.01em', flex: 1, overflow: 'hidden',
              textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
              {build.appName}
            </h2>
            <span style={{
              fontSize: '0.625rem', fontWeight: 600, padding: '0.1rem 0.5rem',
              borderRadius: '9999px', textTransform: 'uppercase', letterSpacing: '0.05em',
              flexShrink: 0, ...statusStyle(build.status),
            }}>
              {build.status}
            </span>
          </div>
        </div>

        {/* Chat thread */}
        <div
          style={{
            flex: 1, overflowY: 'auto', padding: '0.75rem',
            display: 'flex', flexDirection: 'column', gap: '0.5rem',
          }}
        >
          {chatMessages.map((msg, i) => (
            <div key={i} style={{ maxWidth: '95%', alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start' }}>
              {msg.codeSnippet ? (
                /* ── Claude-style code snippet card ── */
                <CodeSnippetCard snippet={msg.codeSnippet} />
              ) : msg.role === 'user' ? (
                <div style={{
                  background: '#0a0a0a', color: '#fafafa', padding: '0.5rem 0.75rem',
                  borderRadius: '0.75rem 0.75rem 0.25rem 0.75rem', fontSize: '0.8125rem',
                  lineHeight: 1.6, wordBreak: 'break-word',
                }}>
                  {msg.content}
                </div>
              ) : (
                <div style={{
                  background: '#f5f5f5', color: '#0a0a0a', padding: '0.5rem 0.75rem',
                  borderRadius: '0.75rem 0.75rem 0.75rem 0.25rem', fontSize: '0.8125rem',
                  lineHeight: 1.6, whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                }}>
                  {msg.content}
                </div>
              )}
            </div>
          ))}
          <div ref={chatEndRef} />
        </div>

        {/* Chat input — visible when build is terminal */}
        {isTerminal && (
          <div style={{ padding: '0.625rem', borderTop: '1px solid #e5e5e5', background: '#ffffff' }}>
            <div style={{
              border: '1px solid #e5e5e5', borderRadius: '0.75rem', overflow: 'hidden',
              background: 'rgba(245,245,245,0.3)',
            }}>
              <textarea
                ref={textareaRef}
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Describe changes or new features…"
                rows={2}
                disabled={rebuilding}
                style={{
                  width: '100%', border: 'none', outline: 'none', resize: 'none',
                  padding: '0.5rem 0.75rem 0.25rem', fontSize: '0.8125rem',
                  lineHeight: 1.5, fontFamily: 'inherit', background: 'transparent',
                  color: '#0a0a0a', boxSizing: 'border-box', opacity: rebuilding ? 0.5 : 1,
                }}
              />
              <div style={{
                padding: '0.25rem 0.75rem 0.5rem', display: 'flex',
                alignItems: 'center', justifyContent: 'space-between',
              }}>
                <span style={{ fontSize: '0.6875rem', color: '#a3a3a3' }}>
                  Enter to rebuild
                </span>
                <button
                  onClick={handleRebuild}
                  disabled={!chatInput.trim() || rebuilding}
                  aria-label="Rebuild"
                  style={{
                    width: '1.5rem', height: '1.5rem', borderRadius: '9999px', border: 'none',
                    background: !chatInput.trim() || rebuilding ? '#e5e5e5' : '#0a0a0a',
                    color: '#fafafa', cursor: !chatInput.trim() || rebuilding ? 'default' : 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    transition: 'background 0.15s', padding: 0,
                  }}
                >
                  {rebuilding ? (
                    <Spinner />
                  ) : (
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="12" y1="19" x2="12" y2="5" />
                      <polyline points="5 12 12 5 19 12" />
                    </svg>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── Right panel: BuildStudio ─────────────────────── */}
      <div
        style={{
          flex: 1, borderRadius: '0 0.75rem 0.75rem 0',
          display: 'flex', flexDirection: 'column', overflow: 'hidden',
          border: '1px solid #e5e5e5', borderLeft: 'none',
        }}
      >
        <BuildStudio
          buildId={buildId}
          onDeployed={handleDeployed}
          onFilesReady={() => setFilesReady(true)}
          onStepUpdate={handleStepUpdate}
        />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Code Snippet Card (Claude-style)                                   */
/* ------------------------------------------------------------------ */

function CodeSnippetCard({ snippet }: { snippet: NonNullable<ChatMessage['codeSnippet']> }) {
  const isError = snippet.status === 'error';
  return (
    <div style={{
      background: '#1e1e1e',
      borderRadius: '0.5rem',
      overflow: 'hidden',
      border: `1px solid ${isError ? '#7f1d1d' : '#333'}`,
      fontSize: '0.75rem',
    }}>
      {/* Header bar */}
      <div style={{
        padding: '0.375rem 0.625rem',
        background: isError ? '#7f1d1d' : '#2d2d2d',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '0.5rem',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
          <span style={{
            width: 7, height: 7, borderRadius: '50%',
            background: isError ? '#f87171' : '#4ade80',
            flexShrink: 0,
          }} />
          <span style={{ color: '#e5e5e5', fontWeight: 600, fontSize: '0.6875rem' }}>
            {snippet.stage}
          </span>
        </div>
        <span style={{ color: '#737373', fontSize: '0.625rem' }}>
          {(snippet.elapsed / 1000).toFixed(1)}s
        </span>
      </div>
      {/* Body */}
      <div style={{
        padding: '0.5rem 0.625rem',
        fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace',
        color: isError ? '#fca5a5' : '#a3e635',
        lineHeight: 1.6,
      }}>
        <span style={{ color: '#737373' }}>{'> '}</span>
        {isError ? '✗ ' : '✓ '}
        {snippet.detail}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                           */
/* ------------------------------------------------------------------ */

function Spinner() {
  return (
    <span style={{
      display: 'inline-block', width: '0.75rem', height: '0.75rem',
      border: '1.5px solid currentColor', borderTopColor: 'transparent',
      borderRadius: '50%', animation: 'spin 0.6s linear infinite',
    }} />
  );
}

function statusStyle(status: string): React.CSSProperties {
  switch (status) {
    case 'succeeded':
      return { background: '#dcfce7', color: '#166534' };
    case 'failed':
      return { background: '#fef2f2', color: '#dc2626' };
    case 'running':
      return { background: '#eff6ff', color: '#1d4ed8' };
    default:
      return { background: '#f5f5f5', color: '#737373' };
  }
}

function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}
