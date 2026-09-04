/**
 * /build/[buildId] — Persistent build page with chat sidebar.
 *
 * Each build gets its own URL so users can refresh and come back to
 * the same build. On load it fetches the build record to get metadata
 * (app name, prompt, status), then always mounts BuildTrace which
 * connects to the SSE stream endpoint.
 *
 * The left panel is a chat interface where users can:
 *   - See the original prompt and build result
 *   - Request changes or add requirements
 *   - Trigger a rebuild with the updated prompt
 */
'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { BuildTrace } from '@/components/BuildTrace';

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

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

/* ------------------------------------------------------------------ */
/*  Component                                                         */
/* ------------------------------------------------------------------ */

export default function BuildDetailPage() {
  const { buildId } = useParams<{ buildId: string }>();
  const router = useRouter();

  const [build, setBuild] = useState<BuildRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deployedUrl, setDeployedUrl] = useState<string | null>(null);

  // Chat state
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [rebuilding, setRebuilding] = useState(false);

  const chatEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

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

        // Add a build result message
        if (data.status === 'succeeded') {
          msgs.push({
            role: 'assistant',
            content: `✓ Built "${data.appName}" successfully.${data.deployedUrl ? ` Deployed to ${data.deployedUrl}` : ''}\n\nNeed changes? Describe what you'd like to add or modify below.`,
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
            content: `Building "${data.appName}"… Watch the progress on the right.`,
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
  /*  Deployed callback from BuildTrace                               */
  /* ---------------------------------------------------------------- */

  function handleDeployed(url: string) {
    setDeployedUrl(url);
    fetchBuild();

    // Update the chat with the deploy result
    setChatMessages((prev) => {
      // Remove the "Building..." message and replace with success
      const withoutBuilding = prev.filter(
        (m) => !(m.role === 'assistant' && m.content.startsWith('Building')),
      );
      return [
        ...withoutBuilding,
        {
          role: 'assistant' as const,
          content: `✓ Built and deployed successfully!\n${url}\n\nNeed changes? Describe what you'd like to add or modify below.`,
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

    // Add user message to chat
    setChatMessages((prev) => [
      ...prev,
      { role: 'user', content: input, timestamp: Date.now() },
    ]);

    // Add "thinking" message
    setChatMessages((prev) => [
      ...prev,
      {
        role: 'assistant',
        content: '⟳ Creating a new build with your changes…',
        timestamp: Date.now(),
      },
    ]);

    try {
      // Combine original prompt with the change request
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

      // Navigate to the new build
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

  /* ---------------------------------------------------------------- */
  /*  Keyboard handler                                                */
  /* ---------------------------------------------------------------- */

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
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          height: 'calc(100vh - 5rem)',
          gap: '0.5rem',
          color: '#a3a3a3',
          fontSize: '0.875rem',
        }}
      >
        <Spinner /> Loading build…
      </div>
    );
  }

  if (error) {
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          height: 'calc(100vh - 5rem)',
          gap: '1rem',
        }}
      >
        <div
          style={{
            width: 48,
            height: 48,
            borderRadius: '50%',
            background: '#fef2f2',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '1.25rem',
            color: '#dc2626',
          }}
        >
          ✗
        </div>
        <p style={{ color: '#dc2626', fontSize: '0.875rem', margin: 0 }}>{error}</p>
        <a
          href="/build"
          style={{
            fontSize: '0.8125rem',
            color: '#0a0a0a',
            textDecoration: 'underline',
          }}
        >
          ← Start a new build
        </a>
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
        fontFamily:
          'system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", sans-serif',
      }}
    >
      {/* ── Left panel: chat sidebar ─────────────────────────── */}
      <div
        style={{
          flex: '0 0 400px',
          maxWidth: '400px',
          display: 'flex',
          flexDirection: 'column',
          borderRight: '1px solid #e5e5e5',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '0.75rem 1rem',
            borderBottom: '1px solid #e5e5e5',
            background: '#fafafa',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <a
              href="/build"
              style={{ fontSize: '0.6875rem', color: '#737373', textDecoration: 'none' }}
            >
              ← New Build
            </a>
            {deployedUrl && (
              <a
                href={deployedUrl}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  fontSize: '0.6875rem',
                  color: '#ffffff',
                  background: '#0a0a0a',
                  padding: '0.2rem 0.625rem',
                  borderRadius: '9999px',
                  textDecoration: 'none',
                  fontWeight: 500,
                }}
              >
                Open App ↗
              </a>
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.375rem' }}>
            <h2
              style={{
                fontSize: '1rem',
                fontWeight: 600,
                color: '#0a0a0a',
                margin: 0,
                letterSpacing: '-0.01em',
                flex: 1,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {build.appName}
            </h2>
            <span
              style={{
                fontSize: '0.625rem',
                fontWeight: 600,
                padding: '0.1rem 0.5rem',
                borderRadius: '9999px',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                flexShrink: 0,
                ...statusStyle(build.status),
              }}
            >
              {build.status}
            </span>
          </div>
        </div>

        {/* Chat thread */}
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '0.75rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.5rem',
          }}
        >
          {chatMessages.map((msg, i) => (
            <div
              key={i}
              style={{
                maxWidth: '92%',
                alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start',
              }}
            >
              {msg.role === 'user' ? (
                <div
                  style={{
                    background: '#0a0a0a',
                    color: '#fafafa',
                    padding: '0.625rem 0.875rem',
                    borderRadius: '1rem 1rem 0.25rem 1rem',
                    fontSize: '0.8125rem',
                    lineHeight: 1.6,
                    wordBreak: 'break-word',
                  }}
                >
                  {msg.content}
                </div>
              ) : (
                <div
                  style={{
                    background: '#f5f5f5',
                    color: '#0a0a0a',
                    padding: '0.625rem 0.875rem',
                    borderRadius: '1rem 1rem 1rem 0.25rem',
                    fontSize: '0.8125rem',
                    lineHeight: 1.6,
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                  }}
                >
                  {msg.content}
                </div>
              )}
            </div>
          ))}
          <div ref={chatEndRef} />
        </div>

        {/* Chat input — visible when build is terminal */}
        {isTerminal && (
          <div
            style={{
              padding: '0.75rem',
              borderTop: '1px solid #e5e5e5',
              background: '#ffffff',
            }}
          >
            <div
              style={{
                border: '1px solid #e5e5e5',
                borderRadius: '0.75rem',
                overflow: 'hidden',
                background: 'rgba(245,245,245,0.3)',
              }}
            >
              <textarea
                ref={textareaRef}
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Describe changes or new features…"
                rows={2}
                disabled={rebuilding}
                style={{
                  width: '100%',
                  border: 'none',
                  outline: 'none',
                  resize: 'none',
                  padding: '0.625rem 0.75rem 0.375rem',
                  fontSize: '0.8125rem',
                  lineHeight: 1.5,
                  fontFamily: 'inherit',
                  background: 'transparent',
                  color: '#0a0a0a',
                  boxSizing: 'border-box',
                  opacity: rebuilding ? 0.5 : 1,
                }}
              />
              <div
                style={{
                  padding: '0.375rem 0.75rem 0.5rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <span style={{ fontSize: '0.6875rem', color: '#a3a3a3' }}>
                  Enter to rebuild · Shift+Enter for new line
                </span>
                <button
                  onClick={handleRebuild}
                  disabled={!chatInput.trim() || rebuilding}
                  aria-label="Rebuild"
                  style={{
                    width: '1.75rem',
                    height: '1.75rem',
                    borderRadius: '9999px',
                    border: 'none',
                    background:
                      !chatInput.trim() || rebuilding ? '#e5e5e5' : '#0a0a0a',
                    color: '#fafafa',
                    cursor: !chatInput.trim() || rebuilding ? 'default' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    transition: 'background 0.15s',
                    padding: 0,
                  }}
                >
                  {rebuilding ? (
                    <Spinner />
                  ) : (
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
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

      {/* ── Right panel: build trace / preview ─────────────────── */}
      <div
        style={{
          flex: 1,
          borderRadius: '0 0.75rem 0.75rem 0',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          border: '1px solid #e5e5e5',
          borderLeft: 'none',
          background: deployedUrl ? '#f5f5f5' : '#ffffff',
        }}
      >
        {deployedUrl ? (
          <DeployedPreview url={deployedUrl} />
        ) : (
          <BuildTrace buildId={buildId} onDeployed={handleDeployed} />
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Deployed preview (iframe with fallback)                           */
/* ------------------------------------------------------------------ */

function DeployedPreview({ url }: { url: string }) {
  const [iframeBlocked, setIframeBlocked] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      try {
        const doc = iframeRef.current?.contentDocument;
        if (!doc || !doc.body || doc.body.innerHTML === '') {
          setIframeBlocked(true);
        }
      } catch {
        setIframeBlocked(true);
      }
    }, 8000);
    return () => clearTimeout(timer);
  }, [url]);

  return (
    <>
      {/* URL bar */}
      <div
        style={{
          padding: '0.5rem 0.75rem',
          borderBottom: '1px solid #e5e5e5',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: '#ffffff',
          borderRadius: '0 0.75rem 0 0',
        }}
      >
        <span
          style={{
            fontSize: '0.75rem',
            color: '#16a34a',
            fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, monospace',
            display: 'flex',
            alignItems: 'center',
            gap: '0.375rem',
          }}
        >
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#16a34a', flexShrink: 0 }} />
          {url}
        </span>
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            fontSize: '0.75rem',
            color: '#ffffff',
            background: '#0a0a0a',
            padding: '0.25rem 0.75rem',
            borderRadius: '9999px',
            textDecoration: 'none',
            fontWeight: 500,
          }}
        >
          Open in new tab ↗
        </a>
      </div>

      {/* Preview area */}
      <div style={{ flex: 1, position: 'relative' }}>
        {iframeBlocked ? (
          <div
            style={{
              width: '100%',
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '1rem',
              background: '#fafafa',
            }}
          >
            <div
              style={{
                width: 48,
                height: 48,
                borderRadius: '50%',
                background: '#dcfce7',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '1.5rem',
              }}
            >
              ✓
            </div>
            <div style={{ textAlign: 'center' }}>
              <p style={{ fontWeight: 600, fontSize: '1rem', color: '#0a0a0a', margin: '0 0 0.25rem' }}>
                Your app is live!
              </p>
              <p style={{ fontSize: '0.8125rem', color: '#737373', margin: '0 0 1rem' }}>
                Preview blocked by security headers. Open in a new tab to view.
              </p>
              <a
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  padding: '0.625rem 1.5rem',
                  background: '#0a0a0a',
                  color: '#fafafa',
                  border: 'none',
                  borderRadius: '0.5rem',
                  fontSize: '0.875rem',
                  fontWeight: 500,
                  textDecoration: 'none',
                }}
              >
                View App ↗
              </a>
            </div>
          </div>
        ) : (
          <iframe
            ref={iframeRef}
            src={url}
            style={{ width: '100%', height: '100%', border: 'none' }}
            title="Generated app preview"
            onError={() => setIframeBlocked(true)}
          />
        )}
      </div>
    </>
  );
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                           */
/* ------------------------------------------------------------------ */

function Spinner() {
  return (
    <span
      style={{
        display: 'inline-block',
        width: '0.875rem',
        height: '0.875rem',
        border: '1.5px solid currentColor',
        borderTopColor: 'transparent',
        borderRadius: '50%',
        animation: 'spin 0.6s linear infinite',
      }}
    />
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
