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
 * Features:
 *   - Auto dark/light theme (follows system preference)
 *   - Tasks sidebar: all previous builds, clickable to navigate
 *   - Chat: animated step progress, code snippets with copy, preserved history
 *   - BuildStudio: collapsible live preview + agent status with N/10 counter
 */
'use client';

import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { BuildStudio, STEP_VERBS, TOTAL_PIPELINE_STEPS } from '@/components/BuildStudio';
import type { BuildEvent } from '@/components/BuildStudio';

/* ------------------------------------------------------------------ */
/*  Theme system                                                       */
/* ------------------------------------------------------------------ */

interface ThemeTokens {
  bg: string;
  bgSurface: string;
  bgElevated: string;
  bgHover: string;
  bgActive: string;
  bgInput: string;
  text: string;
  textSecondary: string;
  textMuted: string;
  textInverse: string;
  border: string;
  borderSubtle: string;
  accent: string;
  accentText: string;
  // Chat bubbles
  userBubbleBg: string;
  userBubbleText: string;
  assistantBubbleBg: string;
  assistantBubbleText: string;
  // Code cards (always dark)
  codeBg: string;
  codeHeaderBg: string;
  codeBorder: string;
  codeText: string;
  codeTextMuted: string;
}

const LIGHT: ThemeTokens = {
  bg: '#ffffff',
  bgSurface: '#fafafa',
  bgElevated: '#f5f5f5',
  bgHover: '#f0f0f0',
  bgActive: '#e8e8e8',
  bgInput: '#ffffff',
  text: '#0a0a0a',
  textSecondary: '#525252',
  textMuted: '#a3a3a3',
  textInverse: '#fafafa',
  border: '#e5e5e5',
  borderSubtle: '#f0f0f0',
  accent: '#0a0a0a',
  accentText: '#ffffff',
  userBubbleBg: '#0a0a0a',
  userBubbleText: '#fafafa',
  assistantBubbleBg: '#f5f5f5',
  assistantBubbleText: '#0a0a0a',
  codeBg: '#1e1e1e',
  codeHeaderBg: '#2d2d2d',
  codeBorder: '#333333',
  codeText: '#d4d4d4',
  codeTextMuted: '#525252',
};

const DARK: ThemeTokens = {
  bg: '#0a0a0a',
  bgSurface: '#141414',
  bgElevated: '#1a1a1a',
  bgHover: '#222222',
  bgActive: '#2a2a2a',
  bgInput: '#141414',
  text: '#e5e5e5',
  textSecondary: '#a3a3a3',
  textMuted: '#666666',
  textInverse: '#0a0a0a',
  border: '#2a2a2a',
  borderSubtle: '#1f1f1f',
  accent: '#e5e5e5',
  accentText: '#0a0a0a',
  userBubbleBg: '#1d4ed8',
  userBubbleText: '#ffffff',
  assistantBubbleBg: '#1a1a1a',
  assistantBubbleText: '#e5e5e5',
  codeBg: '#111111',
  codeHeaderBg: '#1a1a1a',
  codeBorder: '#2a2a2a',
  codeText: '#d4d4d4',
  codeTextMuted: '#555555',
};

function useTheme(): ThemeTokens {
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    setIsDark(mq.matches);
    const handler = (e: MediaQueryListEvent) => setIsDark(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  return isDark ? DARK : LIGHT;
}

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
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  /** Animated running step indicator */
  runningStep?: { stage: string; stepIndex: number };
  /** Completed step code snippet */
  codeSnippet?: {
    stage: string;
    stepIndex: number;
    status: string;
    detail: string;
    elapsed: number;
    /** Representative code sample from generated files */
    code?: string;
    codeLang?: string;
    codeFile?: string;
  };
}

/* ------------------------------------------------------------------ */
/*  Stage → representative file mapping                               */
/* ------------------------------------------------------------------ */

const STAGE_FILES: Record<string, { pattern: RegExp; label: string }> = {
  'generate-schema': { pattern: /schema\.ts$|schema\.sql$/, label: 'schema' },
  'generate-permissions': { pattern: /auth|middleware|permissions/i, label: 'auth' },
  'generate-backend': { pattern: /api\/.*route\.ts$/, label: 'API route' },
  'generate-frontend': { pattern: /page\.tsx$/, label: 'page' },
  'generate-workflows': { pattern: /workflow|action|hook/i, label: 'workflow' },
  'generate-fixtures-tests': { pattern: /seed|fixture|test/i, label: 'seed data' },
  'generate-deployment': { pattern: /next\.config|vercel|deploy/i, label: 'deploy config' },
};

function findStageFile(
  stage: string,
  files: Array<{ path: string; content: string }>,
): { path: string; content: string } | null {
  const mapping = STAGE_FILES[stage];
  if (!mapping) return null;
  return files.find((f) => mapping.pattern.test(f.path)) ?? null;
}

function truncateCode(code: string, maxLines = 15): string {
  const lines = code.split('\n');
  if (lines.length <= maxLines) return code;
  return lines.slice(0, maxLines).join('\n') + '\n// ... (' + (lines.length - maxLines) + ' more lines)';
}

/* ------------------------------------------------------------------ */
/*  Component                                                         */
/* ------------------------------------------------------------------ */

export default function BuildDetailPage() {
  const { buildId } = useParams<{ buildId: string }>();
  const router = useRouter();
  const t = useTheme();

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
  const addedStepsRef = useRef<Set<string>>(new Set());
  const buildFilesRef = useRef<Array<{ path: string; content: string }>>([]);

  const chatEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  /* -- Status styles with theme awareness -- */
  const statusBadge = useCallback((status: string): React.CSSProperties => {
    const isDark = t.bg === DARK.bg;
    switch (status) {
      case 'succeeded': return { background: isDark ? '#052e16' : '#dcfce7', color: isDark ? '#4ade80' : '#166534' };
      case 'failed': return { background: isDark ? '#450a0a' : '#fef2f2', color: isDark ? '#f87171' : '#dc2626' };
      case 'running': return { background: isDark ? '#172554' : '#eff6ff', color: isDark ? '#60a5fa' : '#1d4ed8' };
      default: return { background: t.bgElevated, color: t.textMuted };
    }
  }, [t]);

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

      if (data.prompt && chatMessages.length === 0) {
        const msgs: ChatMessage[] = [
          { id: 'prompt', role: 'user', content: data.prompt, timestamp: new Date(data.createdAt).getTime() },
        ];

        if (data.status === 'succeeded') {
          msgs.push({
            id: 'result', role: 'assistant',
            content: `✓ Built **${data.appName}** successfully.${data.deployedUrl ? `\nDeployed to ${data.deployedUrl}` : ''}\n\nNeed changes? Describe what you'd like to modify below.`,
            timestamp: data.updatedAt ? new Date(data.updatedAt).getTime() : Date.now(),
          });
        } else if (data.status === 'failed') {
          msgs.push({
            id: 'result', role: 'assistant',
            content: `✗ Build failed${data.errorMessage ? `: ${data.errorMessage}` : ''}.\n\nDescribe the fix or try a different approach below.`,
            timestamp: data.updatedAt ? new Date(data.updatedAt).getTime() : Date.now(),
          });
        } else {
          msgs.push({
            id: 'building', role: 'assistant',
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

  useEffect(() => { fetchBuild(); }, [fetchBuild]);

  /* ---------------------------------------------------------------- */
  /*  Step update → animated progress + code snippets in chat         */
  /* ---------------------------------------------------------------- */

  function handleStepUpdate(event: BuildEvent, stepIndex: number, _totalSteps: number) {
    const stepKey = event.step;
    const verb = STEP_VERBS[stepKey] ?? stepKey;

    if (event.status === 'running') {
      setChatMessages((prev) => {
        const withoutRunning = prev.filter((m) => !m.runningStep);
        return [
          ...withoutRunning,
          { id: `running-${stepKey}`, role: 'assistant', content: '', timestamp: Date.now(), runningStep: { stage: verb, stepIndex } },
        ];
      });
    }

    if (event.status === 'done' || event.status === 'error') {
      if (addedStepsRef.current.has(stepKey)) return;
      addedStepsRef.current.add(stepKey);

      const stageFile = findStageFile(stepKey, buildFilesRef.current);
      const codePreview = stageFile ? truncateCode(stageFile.content) : null;

      setChatMessages((prev) => {
        const withoutRunning = prev.filter((m) => !m.runningStep);
        return [
          ...withoutRunning,
          {
            id: `step-${stepKey}`, role: 'assistant', content: '', timestamp: Date.now(),
            codeSnippet: {
              stage: verb.replace('…', ''), stepIndex, status: event.status,
              detail: event.detail, elapsed: event.elapsed_ms,
              code: codePreview ?? undefined,
              codeLang: stageFile ? getLangFromPath(stageFile.path) : undefined,
              codeFile: stageFile?.path,
            },
          },
        ];
      });
    }
  }

  function handleFilesReady(files: Array<{ path: string; content: string }>) {
    buildFilesRef.current = files;
    setFilesReady(true);
  }

  function handleDeployed(url: string) {
    setDeployedUrl(url);
    fetchBuild();
    setChatMessages((prev) => {
      const cleaned = prev.filter((m) => !m.runningStep && m.id !== 'building');
      return [
        ...cleaned,
        { id: 'deploy-success', role: 'assistant' as const, content: `✓ Built and deployed successfully!\n${url}\n\nNeed changes? Describe what you'd like to modify below.`, timestamp: Date.now() },
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
      { id: `user-${Date.now()}`, role: 'user', content: input, timestamp: Date.now() },
      { id: `thinking-${Date.now()}`, role: 'assistant', content: '⟳ Creating a new build with your changes…', timestamp: Date.now() },
    ]);

    try {
      const fullPrompt = `${build.prompt ?? ''}\n\nChanges requested:\n- ${input}`;
      const res = await fetch('/api/builds', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: fullPrompt, appName: build.appName }),
      });
      if (!res.ok) throw new Error(await res.text());
      const { buildId: newBuildId } = (await res.json()) as { buildId: string };
      router.push(`/build/${newBuildId}`);
    } catch (err) {
      setChatMessages((prev) => [
        ...prev.filter((m) => !m.content.startsWith('⟳')),
        { id: `error-${Date.now()}`, role: 'assistant', content: `✗ Failed to create rebuild: ${err instanceof Error ? err.message : String(err)}`, timestamp: Date.now() },
      ]);
      setRebuilding(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleRebuild(); }
  }

  /* ---------------------------------------------------------------- */
  /*  Global keyframes (injected once)                                 */
  /* ---------------------------------------------------------------- */
  const keyframesCSS = useMemo(() => `
    @keyframes spin { to { transform: rotate(360deg); } }
    @keyframes shimmer { 0% { transform: translateX(-100%); } 100% { transform: translateX(350%); } }
    @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
  `, []);

  /* ---------------------------------------------------------------- */
  /*  Render                                                          */
  /* ---------------------------------------------------------------- */

  if (loading) {
    return (
      <>
        <style>{keyframesCSS}</style>
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          height: 'calc(100vh - 5rem)', gap: '0.5rem', color: t.textMuted, fontSize: '0.875rem',
          background: t.bg,
        }}>
          <Spinner color={t.textMuted} /> Loading build…
        </div>
      </>
    );
  }

  if (error) {
    return (
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        height: 'calc(100vh - 5rem)', gap: '1rem', background: t.bg,
      }}>
        <div style={{
          width: 48, height: 48, borderRadius: '50%', background: '#fef2f2',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '1.25rem', color: '#dc2626',
        }}>✗</div>
        <p style={{ color: '#dc2626', fontSize: '0.875rem', margin: 0 }}>{error}</p>
        <a href="/build" style={{ fontSize: '0.8125rem', color: t.accent, textDecoration: 'underline' }}>← Start a new build</a>
      </div>
    );
  }

  if (!build) return null;
  const isTerminal = build.status === 'succeeded' || build.status === 'failed';

  return (
    <>
      <style>{keyframesCSS}</style>
      <div style={{
        display: 'flex', height: 'calc(100vh - 5rem)', gap: 0,
        fontFamily: 'system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", sans-serif',
        background: t.bg, color: t.text,
      }}>
        {/* ── Tasks sidebar ─────────────────────────────── */}
        <div style={{
          width: tasksSidebarOpen ? 220 : 44, flexShrink: 0, background: t.bgSurface,
          borderRight: `1px solid ${t.border}`, display: 'flex', flexDirection: 'column',
          overflow: 'hidden', transition: 'width 0.2s ease',
        }}>
          <div style={{
            padding: tasksSidebarOpen ? '0.625rem 0.75rem' : '0.625rem 0',
            borderBottom: `1px solid ${t.border}`, background: t.bgElevated,
            display: 'flex', alignItems: 'center',
            justifyContent: tasksSidebarOpen ? 'space-between' : 'center', minHeight: 40,
          }}>
            {tasksSidebarOpen && (
              <span style={{ fontSize: '0.6875rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: t.textMuted }}>Builds</span>
            )}
            <button onClick={() => setTasksSidebarOpen(!tasksSidebarOpen)} style={{
              background: 'none', border: 'none', cursor: 'pointer', padding: '0.25rem',
              color: t.textMuted, fontSize: '0.875rem', lineHeight: 1,
            }} title={tasksSidebarOpen ? 'Collapse' : 'Expand'}>
              {tasksSidebarOpen ? '◀' : '▶'}
            </button>
          </div>

          {tasksSidebarOpen && (
            <div style={{ flex: 1, overflowY: 'auto' }}>
              {allBuilds.map((b) => {
                const isActive = b.id === buildId;
                return (
                  <a key={b.id} href={`/build/${b.id}`} style={{
                    display: 'flex', flexDirection: 'column', gap: '0.125rem',
                    padding: '0.5rem 0.75rem', textDecoration: 'none',
                    borderBottom: `1px solid ${t.borderSubtle}`,
                    background: isActive ? t.bgActive : 'transparent',
                    borderLeft: isActive ? `3px solid ${t.accent}` : '3px solid transparent',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                      <span style={{
                        width: 7, height: 7, borderRadius: '50%', flexShrink: 0,
                        background: b.status === 'succeeded' ? '#16a34a' : b.status === 'failed' ? '#dc2626' : b.status === 'running' ? '#eab308' : t.textMuted,
                      }} />
                      <span style={{
                        fontSize: '0.75rem', fontWeight: isActive ? 600 : 400,
                        color: t.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1,
                      }}>{b.appName}</span>
                    </div>
                    <span style={{ fontSize: '0.625rem', color: t.textMuted, paddingLeft: '1.125rem' }}>
                      {formatRelativeTime(b.createdAt)}
                    </span>
                  </a>
                );
              })}
              {allBuilds.length === 0 && (
                <div style={{ padding: '1rem 0.75rem', fontSize: '0.75rem', color: t.textMuted, textAlign: 'center' }}>No builds yet</div>
              )}
            </div>
          )}

          {tasksSidebarOpen && (
            <a href="/build" style={{
              padding: '0.625rem 0.75rem', borderTop: `1px solid ${t.border}`,
              fontSize: '0.75rem', color: t.textSecondary, textDecoration: 'none',
              display: 'flex', alignItems: 'center', gap: '0.375rem', fontWeight: 500,
            }}>
              <span style={{ fontSize: '1rem', lineHeight: 1 }}>+</span> New Build
            </a>
          )}
        </div>

        {/* ── Chat panel ───────────────────────────────── */}
        <div style={{
          flex: '0 0 360px', maxWidth: '360px', display: 'flex',
          flexDirection: 'column', borderRight: `1px solid ${t.border}`,
          background: t.bg,
        }}>
          {/* Header */}
          <div style={{ padding: '0.625rem 0.75rem', borderBottom: `1px solid ${t.border}`, background: t.bgSurface }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                {filesReady && (
                  <a href={`/build/${buildId}/code`} style={{
                    fontSize: '0.6875rem', color: t.textSecondary, background: t.bgElevated,
                    padding: '0.2rem 0.625rem', borderRadius: '9999px', textDecoration: 'none',
                    fontWeight: 500, border: `1px solid ${t.border}`,
                  }}>&lt;/&gt; Code</a>
                )}
                {deployedUrl && (
                  <a href={deployedUrl} target="_blank" rel="noopener noreferrer" style={{
                    fontSize: '0.6875rem', color: t.accentText, background: t.accent,
                    padding: '0.2rem 0.625rem', borderRadius: '9999px', textDecoration: 'none', fontWeight: 500,
                  }}>Open App ↗</a>
                )}
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.25rem' }}>
              <h2 style={{
                fontSize: '0.9375rem', fontWeight: 600, color: t.text, margin: 0,
                letterSpacing: '-0.01em', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>{build.appName}</h2>
              <span style={{
                fontSize: '0.625rem', fontWeight: 600, padding: '0.1rem 0.5rem',
                borderRadius: '9999px', textTransform: 'uppercase', letterSpacing: '0.05em',
                flexShrink: 0, ...statusBadge(build.status),
              }}>{build.status}</span>
            </div>
          </div>

          {/* Chat thread */}
          <div style={{
            flex: 1, overflowY: 'auto', padding: '0.75rem',
            display: 'flex', flexDirection: 'column', gap: '0.5rem',
          }}>
            {chatMessages.map((msg) => (
              <div key={msg.id} style={{ maxWidth: '95%', alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start' }}>
                {msg.runningStep ? (
                  <RunningStepCard step={msg.runningStep} t={t} />
                ) : msg.codeSnippet ? (
                  <CodeSnippetCard snippet={msg.codeSnippet} t={t} />
                ) : msg.role === 'user' ? (
                  <div style={{
                    background: t.userBubbleBg, color: t.userBubbleText, padding: '0.5rem 0.75rem',
                    borderRadius: '0.75rem 0.75rem 0.25rem 0.75rem', fontSize: '0.8125rem',
                    lineHeight: 1.6, wordBreak: 'break-word',
                  }}>{msg.content}</div>
                ) : (
                  <div style={{
                    background: t.assistantBubbleBg, color: t.assistantBubbleText, padding: '0.5rem 0.75rem',
                    borderRadius: '0.75rem 0.75rem 0.75rem 0.25rem', fontSize: '0.8125rem',
                    lineHeight: 1.6, whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                  }}>{msg.content}</div>
                )}
              </div>
            ))}
            <div ref={chatEndRef} />
          </div>

          {/* Chat input */}
          {isTerminal && (
            <div style={{ padding: '0.625rem', borderTop: `1px solid ${t.border}`, background: t.bg }}>
              <div style={{ border: `1px solid ${t.border}`, borderRadius: '0.75rem', overflow: 'hidden', background: t.bgInput }}>
                <textarea ref={textareaRef} value={chatInput} onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={handleKeyDown} placeholder="Describe changes or new features…" rows={2} disabled={rebuilding}
                  style={{
                    width: '100%', border: 'none', outline: 'none', resize: 'none',
                    padding: '0.5rem 0.75rem 0.25rem', fontSize: '0.8125rem', lineHeight: 1.5,
                    fontFamily: 'inherit', background: 'transparent', color: t.text,
                    boxSizing: 'border-box', opacity: rebuilding ? 0.5 : 1,
                  }}
                />
                <div style={{ padding: '0.25rem 0.75rem 0.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '0.6875rem', color: t.textMuted }}>Enter to rebuild</span>
                  <button onClick={handleRebuild} disabled={!chatInput.trim() || rebuilding} aria-label="Rebuild" style={{
                    width: '1.5rem', height: '1.5rem', borderRadius: '9999px', border: 'none',
                    background: !chatInput.trim() || rebuilding ? t.bgElevated : t.accent,
                    color: t.accentText, cursor: !chatInput.trim() || rebuilding ? 'default' : 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0,
                  }}>
                    {rebuilding ? <Spinner color={t.accentText} /> : (
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="12" y1="19" x2="12" y2="5" /><polyline points="5 12 12 5 19 12" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ── BuildStudio ─────────────────────────────── */}
        <div style={{
          flex: 1, borderRadius: '0 0.75rem 0.75rem 0',
          display: 'flex', flexDirection: 'column', overflow: 'hidden',
          border: `1px solid ${t.border}`, borderLeft: 'none',
        }}>
          <BuildStudio
            buildId={buildId}
            onDeployed={handleDeployed}
            onFilesReady={handleFilesReady}
            onStepUpdate={handleStepUpdate}
          />
        </div>
      </div>
    </>
  );
}

/* ------------------------------------------------------------------ */
/*  Running Step Card (animated)                                       */
/* ------------------------------------------------------------------ */

function RunningStepCard({ step, t }: { step: { stage: string; stepIndex: number }; t: ThemeTokens }) {
  return (
    <div style={{
      background: t.codeBg, borderRadius: '0.5rem', overflow: 'hidden',
      border: `1px solid ${t.codeBorder}`, fontSize: '0.75rem',
    }}>
      <div style={{ padding: '0.5rem 0.625rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <span style={{
          display: 'inline-block', width: '0.625rem', height: '0.625rem',
          border: '1.5px solid #eab308', borderTopColor: 'transparent',
          borderRadius: '50%', animation: 'spin 0.6s linear infinite',
        }} />
        <span style={{ color: '#fbbf24', fontWeight: 600, fontSize: '0.6875rem' }}>
          Step {step.stepIndex + 1}/{TOTAL_PIPELINE_STEPS}
        </span>
        <span style={{ color: t.codeTextMuted, fontSize: '0.6875rem' }}>{step.stage}</span>
      </div>
      <div style={{ height: 2, background: t.codeBorder, overflow: 'hidden' }}>
        <div style={{
          height: '100%', width: '40%', background: 'linear-gradient(90deg, transparent, #eab308, transparent)',
          animation: 'shimmer 1.5s ease-in-out infinite',
        }} />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Code Snippet Card (with copy button)                               */
/* ------------------------------------------------------------------ */

function CodeSnippetCard({
  snippet, t,
}: {
  snippet: NonNullable<ChatMessage['codeSnippet']>;
  t: ThemeTokens;
}) {
  const [copied, setCopied] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const isError = snippet.status === 'error';

  function handleCopy() {
    if (!snippet.code) return;
    navigator.clipboard.writeText(snippet.code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }).catch(() => {});
  }

  return (
    <div style={{
      background: t.codeBg, borderRadius: '0.5rem', overflow: 'hidden',
      border: `1px solid ${isError ? '#7f1d1d' : t.codeBorder}`, fontSize: '0.75rem',
      maxWidth: '100%',
    }}>
      {/* Header */}
      <div style={{
        padding: '0.375rem 0.625rem', background: isError ? '#7f1d1d' : t.codeHeaderBg,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.25rem',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', minWidth: 0 }}>
          <span style={{
            width: 7, height: 7, borderRadius: '50%', flexShrink: 0,
            background: isError ? '#f87171' : '#4ade80',
          }} />
          <span style={{ color: t.codeTextMuted, fontSize: '0.625rem', flexShrink: 0 }}>
            {snippet.stepIndex + 1}/{TOTAL_PIPELINE_STEPS}
          </span>
          <span style={{
            color: t.codeText, fontWeight: 600, fontSize: '0.6875rem',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>{snippet.stage}</span>
        </div>
        <span style={{ color: t.codeTextMuted, fontSize: '0.625rem', flexShrink: 0 }}>
          {(snippet.elapsed / 1000).toFixed(1)}s
        </span>
      </div>

      {/* Detail line */}
      <div style={{
        padding: '0.375rem 0.625rem',
        fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace',
        color: isError ? '#fca5a5' : '#a3e635', lineHeight: 1.5, fontSize: '0.6875rem',
      }}>
        <span style={{ color: t.codeTextMuted }}>{'> '}</span>
        {isError ? '✗ ' : '✓ '}{snippet.detail}
      </div>

      {/* Code preview */}
      {snippet.code && (
        <>
          <div
            onClick={() => setExpanded(!expanded)}
            style={{
              padding: '0.25rem 0.625rem', borderTop: `1px solid ${t.codeBorder}`,
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              cursor: 'pointer', userSelect: 'none',
            }}
          >
            <span style={{ color: t.codeTextMuted, fontSize: '0.625rem' }}>
              {snippet.codeFile && <span style={{ color: t.codeTextMuted, opacity: 0.7 }}>{snippet.codeFile} </span>}
              {expanded ? '▼' : '▶'} Preview
            </span>
            <button
              onClick={(e) => { e.stopPropagation(); handleCopy(); }}
              style={{
                background: 'none', border: `1px solid ${t.codeBorder}`, borderRadius: '0.25rem',
                padding: '0.125rem 0.375rem', color: copied ? '#4ade80' : t.codeTextMuted,
                fontSize: '0.625rem', cursor: 'pointer', transition: 'color 0.15s',
              }}
            >{copied ? '✓ Copied' : 'Copy'}</button>
          </div>
          {expanded && (
            <div style={{
              padding: '0.5rem 0.625rem', borderTop: `1px solid ${t.codeBorder}`,
              fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace',
              fontSize: '0.6875rem', lineHeight: 1.6, color: t.codeText,
              maxHeight: 300, overflowY: 'auto', whiteSpace: 'pre', overflowX: 'auto',
            }}>{snippet.code}</div>
          )}
        </>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                           */
/* ------------------------------------------------------------------ */

function getLangFromPath(path: string): string {
  if (path.endsWith('.tsx') || path.endsWith('.ts')) return 'typescript';
  if (path.endsWith('.jsx') || path.endsWith('.js')) return 'javascript';
  if (path.endsWith('.css')) return 'css';
  if (path.endsWith('.json')) return 'json';
  return 'text';
}

function Spinner({ color = 'currentColor' }: { color?: string }) {
  return (
    <span style={{
      display: 'inline-block', width: '0.75rem', height: '0.75rem',
      border: `1.5px solid ${color}`, borderTopColor: 'transparent',
      borderRadius: '50%', animation: 'spin 0.6s linear infinite',
    }} />
  );
}

function formatRelativeTime(dateStr: string): string {
  const diffMs = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diffMs / 60000);
  const hrs = Math.floor(diffMs / 3600000);
  const days = Math.floor(diffMs / 86400000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  if (hrs < 24) return `${hrs}h ago`;
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}
