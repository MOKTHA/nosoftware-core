/**
 * BuildStudio — IDE-like build progress UI.
 *
 * Replaces the terminal-style BuildTrace with a layout matching
 * the NoSoftware design mockup:
 *
 *   ┌────────────┬─────────────────┬──────────────┐
 *   │  File Tree  │   Code Editor   │ Live Preview │
 *   │             │                 │──────────────│
 *   │             │                 │ Agent Status │
 *   │             │                 │              │
 *   │  DEPLOYED   │                 │              │
 *   └────────────┴─────────────────┴──────────────┘
 *
 * Connects to SSE stream for real-time progress, populates file tree
 * from events, and shows code + preview once deployed.
 */
'use client';

import { useEffect, useRef, useState, useCallback } from 'react';

/* ------------------------------------------------------------------ */
/*  Types                                                             */
/* ------------------------------------------------------------------ */

interface BuildEvent {
  step: string;
  status: 'running' | 'done' | 'warning' | 'error';
  detail: string;
  elapsed_ms: number;
  files?: Array<{ path: string; content: string }>;
}

interface StepState {
  step: string;
  status: BuildEvent['status'];
  detail: string;
  elapsed_ms: number;
}

interface FileEntry {
  path: string;
  content: string;
}

interface FileTreeNode {
  name: string;
  path: string;
  children: FileTreeNode[];
  isFile: boolean;
}

interface BuildStudioProps {
  buildId: string;
  onDeployed?: (url: string) => void;
}

/* ------------------------------------------------------------------ */
/*  File Tree helpers                                                  */
/* ------------------------------------------------------------------ */

function buildFileTree(files: FileEntry[]): FileTreeNode {
  const root: FileTreeNode = { name: '', path: '', children: [], isFile: false };

  for (const file of files) {
    const parts = file.path.split('/');
    let current = root;

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i]!;
      const isLast = i === parts.length - 1;
      const currentPath = parts.slice(0, i + 1).join('/');

      let child = current.children.find((c) => c.name === part);
      if (!child) {
        child = { name: part, path: currentPath, children: [], isFile: isLast };
        current.children.push(child);
      }
      current = child;
    }
  }

  // Sort: directories first, then files, alphabetically
  function sortTree(node: FileTreeNode) {
    node.children.sort((a, b) => {
      if (a.isFile !== b.isFile) return a.isFile ? 1 : -1;
      return a.name.localeCompare(b.name);
    });
    node.children.forEach(sortTree);
  }
  sortTree(root);

  return root;
}

/* ------------------------------------------------------------------ */
/*  Syntax highlighting (simple, lightweight)                          */
/* ------------------------------------------------------------------ */

function getLanguage(path: string): string {
  if (path.endsWith('.tsx') || path.endsWith('.ts')) return 'typescript';
  if (path.endsWith('.jsx') || path.endsWith('.js')) return 'javascript';
  if (path.endsWith('.css')) return 'css';
  if (path.endsWith('.json')) return 'json';
  if (path.endsWith('.sql')) return 'sql';
  if (path.endsWith('.md')) return 'markdown';
  return 'text';
}

function highlightLine(line: string, lang: string): React.ReactNode {
  if (lang === 'json' || lang === 'text' || lang === 'markdown' || lang === 'sql') {
    return <span>{line}</span>;
  }

  // Simple keyword-based highlighting for TS/JS
  const keywords = /\b(import|export|from|const|let|var|function|return|if|else|async|await|class|extends|interface|type|new|throw|try|catch|default|switch|case|break|for|while|of|in|as|typeof|void|null|undefined|true|false)\b/g;
  const strings = /('(?:[^'\\]|\\.)*'|"(?:[^"\\]|\\.)*"|`(?:[^`\\]|\\.)*`)/g;
  const comments = /(\/\/.*$|\/\*[\s\S]*?\*\/)/gm;
  const jsx = /(<\/?[A-Z][A-Za-z0-9.]*)/g;

  // Split and reconstruct with spans
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  const allMatches: Array<{ index: number; length: number; type: string; text: string }> = [];

  // Collect all matches
  for (const regex of [comments, strings, keywords, jsx]) {
    regex.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = regex.exec(line)) !== null) {
      allMatches.push({
        index: m.index,
        length: m[0].length,
        type: regex === keywords ? 'kw' : regex === strings ? 'str' : regex === comments ? 'cmt' : 'jsx',
        text: m[0],
      });
    }
  }

  // Sort by position, remove overlaps
  allMatches.sort((a, b) => a.index - b.index);
  const filtered: typeof allMatches = [];
  let maxEnd = 0;
  for (const m of allMatches) {
    if (m.index >= maxEnd) {
      filtered.push(m);
      maxEnd = m.index + m.length;
    }
  }

  for (const m of filtered) {
    if (m.index > lastIndex) {
      parts.push(<span key={`t-${lastIndex}`}>{line.slice(lastIndex, m.index)}</span>);
    }
    const color = m.type === 'kw' ? '#c678dd' : m.type === 'str' ? '#98c379' : m.type === 'cmt' ? '#5c6370' : '#e5c07b';
    parts.push(
      <span key={`m-${m.index}`} style={{ color }}>
        {m.text}
      </span>,
    );
    lastIndex = m.index + m.length;
  }
  if (lastIndex < line.length) {
    parts.push(<span key={`t-${lastIndex}`}>{line.slice(lastIndex)}</span>);
  }

  return parts.length ? <>{parts}</> : <span>{line}</span>;
}

/* ------------------------------------------------------------------ */
/*  Component                                                         */
/* ------------------------------------------------------------------ */

export function BuildStudio({ buildId, onDeployed }: BuildStudioProps) {
  const [steps, setSteps] = useState<StepState[]>([]);
  const [files, setFiles] = useState<FileEntry[]>([]);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [openTabs, setOpenTabs] = useState<string[]>([]);
  const [connected, setConnected] = useState(false);
  const [done, setDone] = useState(false);
  const [failed, setFailed] = useState(false);
  const [deployedUrl, setDeployedUrl] = useState<string | null>(null);
  const [expandedDirs, setExpandedDirs] = useState<Set<string>>(new Set());
  const [filesFetched, setFilesFetched] = useState(false);
  const esRef = useRef<EventSource | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Compute metrics from steps
  const pipelineSteps = steps.filter((s) => s.step !== 'pipeline' && s.step !== 'files-collected');
  const completedCount = pipelineSteps.filter((s) => s.status === 'done').length;
  const totalSteps = pipelineSteps.length;
  const currentStep = pipelineSteps.find((s) => s.status === 'running');
  const totalElapsed = steps.reduce((max, s) => Math.max(max, s.elapsed_ms), 0);

  // Fetch files from DB for completed/running builds
  const fetchFiles = useCallback(async () => {
    if (filesFetched) return;
    try {
      const res = await fetch(`/api/builds/${buildId}/files`);
      if (res.ok) {
        const data = (await res.json()) as { files: FileEntry[] };
        if (data.files.length > 0) {
          setFiles(data.files);
          setFilesFetched(true);
          // Auto-select the first meaningful file
          const mainFile = data.files.find((f) =>
            f.path === 'src/app/page.tsx' ||
            f.path.endsWith('/page.tsx') ||
            f.path.endsWith('page.tsx'),
          ) ?? data.files[0];
          if (mainFile) {
            setSelectedFile(mainFile.path);
            setOpenTabs([mainFile.path]);
            // Expand all directories
            const dirs = new Set<string>();
            data.files.forEach((f) => {
              const parts = f.path.split('/');
              for (let i = 1; i < parts.length; i++) {
                dirs.add(parts.slice(0, i).join('/'));
              }
            });
            setExpandedDirs(dirs);
          }
        }
      }
    } catch {
      // Non-critical
    }
  }, [buildId, filesFetched]);

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  // SSE connection
  useEffect(() => {
    const es = new EventSource(`/api/builds/${buildId}/stream`);
    esRef.current = es;
    setConnected(true);

    es.onmessage = (e: MessageEvent) => {
      const event = JSON.parse(e.data as string) as BuildEvent;

      // Handle replay-end marker
      if (event.step === '__replay' && event.detail === 'replay-end:poll') {
        es.close();
        startPolling();
        return;
      }

      // Capture file data from the files-collected event
      if (event.step === 'files-collected' && event.files && event.files.length > 0) {
        setFiles(event.files);
        setFilesFetched(true);
        const mainFile = event.files.find((f) =>
          f.path === 'src/app/page.tsx' ||
          f.path.endsWith('/page.tsx'),
        ) ?? event.files[0];
        if (mainFile) {
          setSelectedFile(mainFile.path);
          setOpenTabs([mainFile.path]);
          const dirs = new Set<string>();
          event.files.forEach((f) => {
            const parts = f.path.split('/');
            for (let i = 1; i < parts.length; i++) {
              dirs.add(parts.slice(0, i).join('/'));
            }
          });
          setExpandedDirs(dirs);
        }
        return; // Don't add to steps display
      }

      // Update step state
      setSteps((prev) => {
        const idx = prev.findIndex((s) => s.step === event.step);
        const next: StepState = {
          step: event.step,
          status: event.status,
          detail: event.detail,
          elapsed_ms: event.elapsed_ms,
        };
        if (idx === -1) return [...prev, next];
        const updated = [...prev];
        updated[idx] = next;
        return updated;
      });

      // Deployed URL
      if (
        event.step === 'pipeline' &&
        event.status === 'done' &&
        event.detail.startsWith('https://')
      ) {
        setDeployedUrl(event.detail);
        onDeployed?.(event.detail);
      }

      // Terminal state
      if (event.step === 'pipeline' && (event.status === 'done' || event.status === 'error')) {
        setDone(true);
        if (event.status === 'error') setFailed(true);
        es.close();
        // Fetch files from DB if we didn't get them from SSE
        fetchFiles();
      }
    };

    es.onerror = () => {
      setConnected(false);
      es.close();
    };

    return () => {
      es.close();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [buildId]);

  function startPolling() {
    if (pollRef.current) return;
    // Fetch files since build is already running
    fetchFiles();

    pollRef.current = setInterval(async () => {
      try {
        const res = await fetch(`/api/builds/${buildId}`);
        if (!res.ok) return;
        const data = (await res.json()) as {
          status: string;
          deployedUrl: string | null;
        };

        if (data.status === 'succeeded' || data.status === 'failed') {
          if (pollRef.current) clearInterval(pollRef.current);
          pollRef.current = null;
          setDone(true);
          if (data.status === 'failed') setFailed(true);
          if (data.status === 'succeeded' && data.deployedUrl) {
            setDeployedUrl(data.deployedUrl);
            onDeployed?.(data.deployedUrl);
          }
          fetchFiles();
        }
      } catch {
        // retry
      }
    }, 3000);
  }

  // File tree
  const fileTree = buildFileTree(files);
  const selectedContent = files.find((f) => f.path === selectedFile)?.content ?? '';

  function handleFileClick(path: string) {
    setSelectedFile(path);
    if (!openTabs.includes(path)) {
      setOpenTabs((prev) => [...prev, path]);
    }
  }

  function handleCloseTab(path: string) {
    setOpenTabs((prev) => {
      const next = prev.filter((p) => p !== path);
      if (selectedFile === path) {
        setSelectedFile(next[next.length - 1] ?? null);
      }
      return next;
    });
  }

  function toggleDir(path: string) {
    setExpandedDirs((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  }

  // Compute progress percentage
  const progress = totalSteps > 0 ? (completedCount / totalSteps) * 100 : 0;

  /* ── Loading state ── */
  if (!connected && steps.length === 0) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100%',
        background: '#1e1e1e',
        color: '#a3a3a3',
        fontSize: '0.8125rem',
        gap: '0.5rem',
      }}>
        <Spinner /> Connecting to build…
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', height: '100%', background: '#ffffff' }}>
      {/* ── LEFT: File Tree ─────────────────────────────── */}
      <div
        style={{
          width: 190,
          flexShrink: 0,
          background: '#fafafa',
          borderRight: '1px solid #e5e5e5',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {/* File tree header */}
        <div
          style={{
            padding: '0.625rem 0.75rem',
            borderBottom: '1px solid #e5e5e5',
            background: '#f5f5f5',
          }}
        >
          <div
            style={{
              fontSize: '0.6875rem',
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              color: '#737373',
            }}
          >
            Files
          </div>
        </div>

        {/* File tree body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '0.25rem 0' }}>
          {files.length === 0 ? (
            <div
              style={{
                padding: '1rem 0.75rem',
                fontSize: '0.75rem',
                color: '#a3a3a3',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '0.5rem',
              }}
            >
              {done ? (
                <span style={{ color: '#737373' }}>
                  {failed ? 'Build failed' : 'File data not available for this build'}
                </span>
              ) : (
                <>
                  <Spinner />
                  <span>Generating files…</span>
                </>
              )}
            </div>
          ) : (
            fileTree.children.map((node) => (
              <FileTreeNodeView
                key={node.path}
                node={node}
                depth={0}
                selectedFile={selectedFile}
                expandedDirs={expandedDirs}
                onFileClick={handleFileClick}
                onToggleDir={toggleDir}
              />
            ))
          )}
        </div>

        {/* Status indicator */}
        <div
          style={{
            padding: '0.625rem 0.75rem',
            borderTop: '1px solid #e5e5e5',
            display: 'flex',
            alignItems: 'center',
            gap: '0.375rem',
            fontSize: '0.6875rem',
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
          }}
        >
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              background: failed ? '#dc2626' : done ? '#16a34a' : '#eab308',
              flexShrink: 0,
              ...(!(done || failed) ? { animation: 'pulse 1.5s ease-in-out infinite' } : {}),
            }}
          />
          <span style={{ color: failed ? '#dc2626' : done ? '#16a34a' : '#525252' }}>
            {failed ? 'Failed' : done ? 'Deployed' : 'Building…'}
          </span>
        </div>
      </div>

      {/* ── CENTER: Code Editor ─────────────────────────── */}
      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          minWidth: 0,
        }}
      >
        {/* Tab bar */}
        <div
          style={{
            display: 'flex',
            alignItems: 'stretch',
            borderBottom: '1px solid #e5e5e5',
            background: '#f5f5f5',
            overflowX: 'auto',
            minHeight: 36,
          }}
        >
          {openTabs.map((tab) => {
            const isActive = tab === selectedFile;
            const fileName = tab.split('/').pop() ?? tab;
            return (
              <div
                key={tab}
                onClick={() => setSelectedFile(tab)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.375rem',
                  padding: '0 0.75rem',
                  fontSize: '0.75rem',
                  cursor: 'pointer',
                  borderRight: '1px solid #e5e5e5',
                  background: isActive ? '#ffffff' : 'transparent',
                  color: isActive ? '#0a0a0a' : '#737373',
                  fontWeight: isActive ? 500 : 400,
                  whiteSpace: 'nowrap',
                  position: 'relative',
                  ...(isActive ? { borderBottom: '2px solid #0a0a0a' } : {}),
                }}
              >
                <FileIcon path={tab} />
                {fileName}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleCloseTab(tab);
                  }}
                  style={{
                    background: 'none',
                    border: 'none',
                    padding: '0 0.125rem',
                    cursor: 'pointer',
                    color: '#a3a3a3',
                    fontSize: '0.875rem',
                    lineHeight: 1,
                    opacity: isActive ? 1 : 0,
                  }}
                >
                  ×
                </button>
              </div>
            );
          })}
        </div>

        {/* Code body */}
        <div
          style={{
            flex: 1,
            overflow: 'auto',
            background: '#1e1e1e',
            fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace',
            fontSize: '0.8125rem',
            lineHeight: 1.7,
          }}
        >
          {selectedFile && selectedContent ? (
            <div style={{ display: 'flex', minWidth: 'max-content' }}>
              {/* Line numbers */}
              <div
                style={{
                  padding: '0.75rem 0.5rem 0.75rem 0.75rem',
                  textAlign: 'right',
                  color: '#525252',
                  userSelect: 'none',
                  flexShrink: 0,
                  minWidth: 44,
                }}
              >
                {selectedContent.split('\n').map((_, i) => (
                  <div key={i}>{i + 1}</div>
                ))}
              </div>

              {/* Code content */}
              <pre
                style={{
                  margin: 0,
                  padding: '0.75rem 1rem 0.75rem 0.5rem',
                  color: '#d4d4d4',
                  flexGrow: 1,
                  whiteSpace: 'pre',
                  tabSize: 2,
                }}
              >
                {selectedContent.split('\n').map((line, i) => (
                  <div key={i}>{highlightLine(line, getLanguage(selectedFile))}</div>
                ))}
              </pre>
            </div>
          ) : (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                height: '100%',
                color: '#525252',
                fontSize: '0.8125rem',
              }}
            >
              {files.length === 0
                ? (
                  <div style={{ textAlign: 'center' }}>
                    {done ? (
                      <>
                        <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>
                          {failed ? '✗' : '✓'}
                        </div>
                        <div>
                          {failed
                            ? 'Build failed'
                            : 'Build complete — file data not stored for this build'}
                        </div>
                        {deployedUrl && (
                          <a
                            href={deployedUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{
                              display: 'inline-block',
                              marginTop: '0.75rem',
                              padding: '0.375rem 1rem',
                              background: '#0a0a0a',
                              color: '#fafafa',
                              borderRadius: '0.375rem',
                              fontSize: '0.8125rem',
                              fontWeight: 500,
                              textDecoration: 'none',
                            }}
                          >
                            Open App ↗
                          </a>
                        )}
                      </>
                    ) : (
                      <>
                        <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>⚡</div>
                        <div>Generating your app…</div>
                        <div style={{ fontSize: '0.75rem', color: '#737373', marginTop: '0.25rem' }}>
                          Files will appear as they&apos;re created
                        </div>
                      </>
                    )}
                  </div>
                )
                : 'Select a file to view its code'
              }
            </div>
          )}
        </div>
      </div>

      {/* ── RIGHT: Preview + Agent Status ─────────────── */}
      <div
        style={{
          width: 280,
          flexShrink: 0,
          borderLeft: '1px solid #e5e5e5',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {/* Live Preview */}
        <div
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            borderBottom: '1px solid #e5e5e5',
          }}
        >
          <div
            style={{
              padding: '0.5rem 0.75rem',
              borderBottom: '1px solid #e5e5e5',
              fontSize: '0.6875rem',
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              color: '#737373',
              background: '#f5f5f5',
            }}
          >
            Live Preview
          </div>

          <div style={{ flex: 1, background: '#f5f5f5', position: 'relative', overflow: 'hidden' }}>
            {deployedUrl ? (
              <>
                {/* Faux browser chrome */}
                <div
                  style={{
                    padding: '0.375rem 0.625rem',
                    background: '#e5e5e5',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.375rem',
                  }}
                >
                  {/* Traffic lights */}
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#ff5f57' }} />
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#febc2e' }} />
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#28c840' }} />
                  <div
                    style={{
                      flex: 1,
                      background: '#ffffff',
                      borderRadius: 4,
                      padding: '0.125rem 0.5rem',
                      fontSize: '0.625rem',
                      color: '#737373',
                      textOverflow: 'ellipsis',
                      overflow: 'hidden',
                      whiteSpace: 'nowrap',
                      marginLeft: '0.375rem',
                    }}
                  >
                    {deployedUrl}
                  </div>
                </div>
                <iframe
                  src={deployedUrl}
                  style={{ width: '100%', height: 'calc(100% - 28px)', border: 'none' }}
                  title="App preview"
                />
              </>
            ) : (
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  height: '100%',
                  gap: '0.5rem',
                  color: '#a3a3a3',
                }}
              >
                {/* Placeholder grid mockup */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 4, opacity: 0.3 }}>
                  {Array.from({ length: 6 }).map((_, i) => (
                    <div
                      key={i}
                      style={{
                        width: 56,
                        height: 40,
                        background: '#d4d4d4',
                        borderRadius: 4,
                      }}
                    />
                  ))}
                </div>
                <span style={{ fontSize: '0.6875rem', marginTop: '0.25rem' }}>
                  Preview available after deploy
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Agent Status Panel */}
        <div
          style={{
            padding: '0.75rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.5rem',
            background: '#ffffff',
            minHeight: 180,
          }}
        >
          <div
            style={{
              fontSize: '0.6875rem',
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              color: '#a3a3a3',
              marginBottom: '0.125rem',
            }}
          >
            No Software Agent
          </div>

          {/* Metric rows */}
          <AgentMetric
            color={completedCount >= 3 ? '#16a34a' : '#eab308'}
            label="Build progress"
            value={`${completedCount}/${totalSteps} stages`}
          />
          <AgentMetric
            color="#3b82f6"
            label="Files generated"
            value={files.length > 0 ? `${files.length} files` : '—'}
          />
          <AgentMetric
            color={currentStep ? '#eab308' : done ? '#16a34a' : '#a3a3a3'}
            label={currentStep ? getStepVerb(currentStep.step) : done ? 'Pipeline complete' : 'Waiting…'}
            value={
              totalElapsed > 0
                ? `${(totalElapsed / 1000).toFixed(0)}s`
                : '—'
            }
          />
          {deployedUrl && (
            <AgentMetric
              color="#16a34a"
              label="Deployed"
              value={
                <a
                  href={deployedUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: '#0a0a0a', textDecoration: 'underline', fontSize: '0.75rem' }}
                >
                  Open app ↗
                </a>
              }
            />
          )}

          {/* Progress bar */}
          <div
            style={{
              marginTop: 'auto',
              height: 6,
              background: '#f5f5f5',
              borderRadius: 3,
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                height: '100%',
                width: `${Math.min(progress, 100)}%`,
                background: failed ? '#dc2626' : done ? '#16a34a' : '#0a0a0a',
                borderRadius: 3,
                transition: 'width 0.5s ease',
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Sub-components                                                     */
/* ------------------------------------------------------------------ */

function FileTreeNodeView({
  node,
  depth,
  selectedFile,
  expandedDirs,
  onFileClick,
  onToggleDir,
}: {
  node: FileTreeNode;
  depth: number;
  selectedFile: string | null;
  expandedDirs: Set<string>;
  onFileClick: (path: string) => void;
  onToggleDir: (path: string) => void;
}) {
  const isExpanded = expandedDirs.has(node.path);
  const isSelected = node.path === selectedFile;

  if (node.isFile) {
    return (
      <div
        onClick={() => onFileClick(node.path)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.25rem',
          padding: '0.15rem 0.5rem 0.15rem',
          paddingLeft: `${depth * 0.75 + 0.75}rem`,
          cursor: 'pointer',
          fontSize: '0.75rem',
          color: isSelected ? '#0a0a0a' : '#525252',
          background: isSelected ? '#e5e5e5' : 'transparent',
          fontWeight: isSelected ? 500 : 400,
        }}
      >
        <FileIcon path={node.path} />
        {node.name}
      </div>
    );
  }

  return (
    <>
      <div
        onClick={() => onToggleDir(node.path)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.25rem',
          padding: '0.15rem 0.5rem 0.15rem',
          paddingLeft: `${depth * 0.75 + 0.5}rem`,
          cursor: 'pointer',
          fontSize: '0.75rem',
          color: '#525252',
          fontWeight: 500,
        }}
      >
        <span style={{ fontSize: '0.625rem', width: '0.75rem', textAlign: 'center', flexShrink: 0 }}>
          {isExpanded ? '▼' : '▶'}
        </span>
        {node.name}/
      </div>
      {isExpanded &&
        node.children.map((child) => (
          <FileTreeNodeView
            key={child.path}
            node={child}
            depth={depth + 1}
            selectedFile={selectedFile}
            expandedDirs={expandedDirs}
            onFileClick={onFileClick}
            onToggleDir={onToggleDir}
          />
        ))}
    </>
  );
}

function FileIcon({ path }: { path: string }) {
  let color = '#737373';
  if (path.endsWith('.tsx') || path.endsWith('.ts')) color = '#3178c6';
  else if (path.endsWith('.css')) color = '#264de4';
  else if (path.endsWith('.json')) color = '#eab308';
  else if (path.endsWith('.sql')) color = '#e06c00';
  else if (path.endsWith('.md')) color = '#525252';

  return (
    <span style={{ width: 12, height: 12, flexShrink: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
      <svg width="10" height="12" viewBox="0 0 10 12" fill="none">
        <path d="M1 1h5l3 3v7H1V1z" stroke={color} strokeWidth="1" fill="none" />
        <path d="M6 1v3h3" stroke={color} strokeWidth="1" fill="none" />
      </svg>
    </span>
  );
}

function AgentMetric({
  color,
  label,
  value,
}: {
  color: string;
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
      <span
        style={{
          width: 8,
          height: 8,
          borderRadius: '50%',
          background: color,
          flexShrink: 0,
        }}
      />
      <span style={{ fontSize: '0.8125rem', color: '#0a0a0a', flex: 1 }}>
        {label}
      </span>
      <span style={{ fontSize: '0.75rem', color: '#737373', fontWeight: 500 }}>
        {value}
      </span>
    </div>
  );
}

function Spinner() {
  return (
    <span
      style={{
        display: 'inline-block',
        width: '0.75rem',
        height: '0.75rem',
        border: '1.5px solid currentColor',
        borderTopColor: 'transparent',
        borderRadius: '50%',
        animation: 'spin 0.6s linear infinite',
      }}
    />
  );
}

/* ------------------------------------------------------------------ */
/*  Step verbs                                                        */
/* ------------------------------------------------------------------ */

const STEP_VERBS: Record<string, string> = {
  'normalize-spec': 'Parsing spec…',
  'resolve-blueprint-plan': 'Resolving blueprint…',
  'generate-schema': 'Designing schema…',
  'generate-permissions': 'Wiring permissions…',
  'generate-backend': 'Generating API…',
  'generate-frontend': 'Crafting pages…',
  'generate-workflows': 'Building workflows…',
  'generate-fixtures-tests': 'Seeding test data…',
  'generate-deployment': 'Preparing deploy…',
  'deploy-to-vercel': 'Deploying…',
};

function getStepVerb(step: string): string {
  return STEP_VERBS[step] ?? step;
}
