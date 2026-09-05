/**
 * CodeViewer — Full-page file tree + code editor with edit/save/rebuild + GitHub.
 *
 * Standalone component used by /build/[buildId]/code page.
 *
 *   ┌────────────┬──────────────────────────────┐
 *   │  File Tree  │   Code Editor (tabbed)       │
 *   │             │   ┌ editable ─────────────┐  │
 *   │             │   │                       │  │
 *   │             │   └───── Save / Rebuild ──┘  │
 *   └────────────┴──────────────────────────────┘
 *   │             GitHub: Push / Pull             │
 *   └────────────────────────────────────────────┘
 *
 * Features:
 *   - Auto dark/light theme (system preference)
 *   - Editable code with save + rebuild
 *   - GitHub connect: push code to repo, pull latest from main
 */
'use client';

import { useEffect, useState, useCallback, useRef } from 'react';

/* ------------------------------------------------------------------ */
/*  Theme system                                                       */
/* ------------------------------------------------------------------ */

interface ThemeTokens {
  bg: string;
  bgSurface: string;
  bgElevated: string;
  bgHover: string;
  bgActive: string;
  text: string;
  textSecondary: string;
  textMuted: string;
  border: string;
  borderSubtle: string;
  accent: string;
  accentText: string;
  editorBg: string;
  editorText: string;
  editorLineNum: string;
  editorActiveLine: string;
}

const LIGHT: ThemeTokens = {
  bg: '#ffffff',
  bgSurface: '#fafafa',
  bgElevated: '#f5f5f5',
  bgHover: '#f0f0f0',
  bgActive: '#e5e5e5',
  text: '#0a0a0a',
  textSecondary: '#525252',
  textMuted: '#a3a3a3',
  border: '#e5e5e5',
  borderSubtle: '#f0f0f0',
  accent: '#0a0a0a',
  accentText: '#ffffff',
  editorBg: '#1e1e1e',
  editorText: '#d4d4d4',
  editorLineNum: '#525252',
  editorActiveLine: '#2a2d2e',
};

const DARK: ThemeTokens = {
  bg: '#0a0a0a',
  bgSurface: '#141414',
  bgElevated: '#1a1a1a',
  bgHover: '#222222',
  bgActive: '#2a2a2a',
  text: '#e5e5e5',
  textSecondary: '#a3a3a3',
  textMuted: '#666666',
  border: '#2a2a2a',
  borderSubtle: '#1f1f1f',
  accent: '#e5e5e5',
  accentText: '#0a0a0a',
  editorBg: '#111111',
  editorText: '#d4d4d4',
  editorLineNum: '#444444',
  editorActiveLine: '#1a1a1a',
};

function useTheme(): ThemeTokens {
  const [isDark, setIsDark] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    setIsDark(mq.matches);
    const h = (e: MediaQueryListEvent) => setIsDark(e.matches);
    mq.addEventListener('change', h);
    return () => mq.removeEventListener('change', h);
  }, []);
  return isDark ? DARK : LIGHT;
}

/* ------------------------------------------------------------------ */
/*  Types                                                             */
/* ------------------------------------------------------------------ */

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

interface CodeViewerProps {
  buildId: string;
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
/*  Syntax highlighting (lightweight)                                  */
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

  const keywords = /\b(import|export|from|const|let|var|function|return|if|else|async|await|class|extends|interface|type|new|throw|try|catch|default|switch|case|break|for|while|of|in|as|typeof|void|null|undefined|true|false)\b/g;
  const strings = /('(?:[^'\\]|\\.)*'|"(?:[^"\\]|\\.)*"|`(?:[^`\\]|\\.)*`)/g;
  const comments = /(\/\/.*$|\/\*[\s\S]*?\*\/)/gm;
  const jsx = /(<\/?[A-Z][A-Za-z0-9.]*)/g;

  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  const allMatches: Array<{ index: number; length: number; type: string; text: string }> = [];

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
    parts.push(<span key={`m-${m.index}`} style={{ color }}>{m.text}</span>);
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

export function CodeViewer({ buildId }: CodeViewerProps) {
  const t = useTheme();

  const [files, setFiles] = useState<FileEntry[]>([]);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [openTabs, setOpenTabs] = useState<string[]>([]);
  const [expandedDirs, setExpandedDirs] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Edit state
  const [editMode, setEditMode] = useState(false);
  const [editContent, setEditContent] = useState('');
  const [modifiedFiles, setModifiedFiles] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // GitHub state
  const [githubRepo, setGithubRepo] = useState('');
  const [githubBranch, setGithubBranch] = useState('main');
  const [githubPanelOpen, setGithubPanelOpen] = useState(false);
  const [githubStatus, setGithubStatus] = useState<string | null>(null);
  const [githubLoading, setGithubLoading] = useState(false);

  const fetchFiles = useCallback(async () => {
    try {
      const res = await fetch(`/api/builds/${buildId}/files`);
      if (!res.ok) {
        setError(res.status === 404 ? 'Build not found' : `Failed to load files (${res.status})`);
        return;
      }
      const data = (await res.json()) as { files: FileEntry[] };
      if (data.files.length === 0) {
        setError('No files available for this build yet');
        return;
      }
      setFiles(data.files);

      const mainFile = data.files.find((f) =>
        f.path === 'src/app/page.tsx' ||
        f.path.endsWith('/page.tsx') ||
        f.path.endsWith('page.tsx'),
      ) ?? data.files[0];
      if (mainFile) {
        setSelectedFile(mainFile.path);
        setOpenTabs([mainFile.path]);
        const dirs = new Set<string>();
        data.files.forEach((f) => {
          const parts = f.path.split('/');
          for (let i = 1; i < parts.length; i++) {
            dirs.add(parts.slice(0, i).join('/'));
          }
        });
        setExpandedDirs(dirs);
      }
    } catch {
      setError('Failed to fetch files');
    } finally {
      setLoading(false);
    }
  }, [buildId]);

  useEffect(() => { fetchFiles(); }, [fetchFiles]);

  const selectedContent = files.find((f) => f.path === selectedFile)?.content ?? '';

  // Sync edit content when switching files or entering edit mode
  useEffect(() => {
    if (editMode && selectedFile) {
      const file = files.find((f) => f.path === selectedFile);
      if (file) setEditContent(file.content);
    }
  }, [editMode, selectedFile, files]);

  function handleFileClick(path: string) {
    // Save current edits before switching
    if (editMode && selectedFile && editContent !== selectedContent) {
      applyEdit(selectedFile, editContent);
    }
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

  function applyEdit(path: string, content: string) {
    setFiles((prev) => prev.map((f) => f.path === path ? { ...f, content } : f));
    setModifiedFiles((prev) => new Set(prev).add(path));
  }

  function handleEditChange(value: string) {
    setEditContent(value);
    if (selectedFile) {
      applyEdit(selectedFile, value);
    }
  }

  async function handleSave() {
    if (saving || modifiedFiles.size === 0) return;
    setSaving(true);
    setSaveStatus(null);

    try {
      const res = await fetch(`/api/builds/${buildId}/files`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ files }),
      });

      if (!res.ok) throw new Error(await res.text());
      setModifiedFiles(new Set());
      setSaveStatus('Saved successfully');
      setTimeout(() => setSaveStatus(null), 3000);
    } catch (err) {
      setSaveStatus(`Error: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setSaving(false);
    }
  }

  async function handleRebuild() {
    // Save first, then redirect to create a new build with the same spec
    await handleSave();
    setSaveStatus('Redirecting to rebuild…');
    try {
      const buildRes = await fetch(`/api/builds/${buildId}`);
      if (!buildRes.ok) throw new Error('Failed to fetch build');
      const buildData = (await buildRes.json()) as { prompt: string | null; appName: string };
      const rebuildPrompt = `${buildData.prompt ?? ''}\n\n[Rebuild with edited source files from build ${buildId}]`;
      const res = await fetch('/api/builds', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: rebuildPrompt, appName: buildData.appName }),
      });
      if (!res.ok) throw new Error(await res.text());
      const { buildId: newBuildId } = (await res.json()) as { buildId: string };
      window.location.href = `/build/${newBuildId}`;
    } catch (err) {
      setSaveStatus(`Rebuild error: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  /* ── GitHub operations ── */

  async function handleGithubPush() {
    if (!githubRepo.trim() || githubLoading) return;
    setGithubLoading(true);
    setGithubStatus(null);

    try {
      const res = await fetch(`/api/builds/${buildId}/github`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'push',
          repo: githubRepo.trim(),
          branch: githubBranch.trim() || 'main',
          files,
        }),
      });

      if (!res.ok) {
        const errData = (await res.json()) as { error: string };
        throw new Error(errData.error || `Push failed (${res.status})`);
      }

      const data = (await res.json()) as { commitUrl?: string; message: string };
      setGithubStatus(`✓ ${data.message}${data.commitUrl ? `\n${data.commitUrl}` : ''}`);
    } catch (err) {
      setGithubStatus(`✗ ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setGithubLoading(false);
    }
  }

  async function handleGithubPull() {
    if (!githubRepo.trim() || githubLoading) return;
    setGithubLoading(true);
    setGithubStatus(null);

    try {
      const res = await fetch(`/api/builds/${buildId}/github`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'pull',
          repo: githubRepo.trim(),
          branch: githubBranch.trim() || 'main',
        }),
      });

      if (!res.ok) {
        const errData = (await res.json()) as { error: string };
        throw new Error(errData.error || `Pull failed (${res.status})`);
      }

      const data = (await res.json()) as { files: FileEntry[]; message: string };
      setFiles(data.files);
      setModifiedFiles(new Set());
      setGithubStatus(`✓ ${data.message}`);

      // Re-save to DB
      await fetch(`/api/builds/${buildId}/files`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ files: data.files }),
      });
    } catch (err) {
      setGithubStatus(`✗ ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setGithubLoading(false);
    }
  }

  /* ── Keyboard shortcut: Cmd/Ctrl+S to save ── */
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault();
        handleSave();
      }
    }
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [files, modifiedFiles]);

  const fileTree = buildFileTree(files);

  /* ── Loading / Error ── */
  if (loading) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        height: '100%', background: t.editorBg, color: t.textMuted,
        fontSize: '0.8125rem', gap: '0.5rem',
      }}>
        <Spinner color={t.textMuted} /> Loading files…
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        height: '100%', background: t.bg, color: t.textMuted, fontSize: '0.875rem', gap: '0.75rem',
      }}>
        <span style={{ fontSize: '2rem' }}>📂</span>
        <span>{error}</span>
        <a href={`/build/${buildId}`} style={{ fontSize: '0.8125rem', color: t.accent, textDecoration: 'underline' }}>← Back to build</a>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: t.bg }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* ── LEFT: File Tree ─────────────────────────────── */}
        <div style={{
          width: 240, flexShrink: 0, background: t.bgSurface,
          borderRight: `1px solid ${t.border}`, display: 'flex', flexDirection: 'column', overflow: 'hidden',
        }}>
          <div style={{
            padding: '0.625rem 0.75rem', borderBottom: `1px solid ${t.border}`, background: t.bgElevated,
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}>
            <div style={{ fontSize: '0.6875rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: t.textMuted }}>
              Explorer
            </div>
            <span style={{ fontSize: '0.6875rem', color: t.textMuted }}>{files.length} files</span>
          </div>

          <div style={{ flex: 1, overflowY: 'auto', padding: '0.25rem 0' }}>
            {fileTree.children.map((node) => (
              <FileTreeNodeView
                key={node.path} node={node} depth={0}
                selectedFile={selectedFile} expandedDirs={expandedDirs}
                modifiedFiles={modifiedFiles} t={t}
                onFileClick={handleFileClick} onToggleDir={toggleDir}
              />
            ))}
          </div>

          <div style={{ padding: '0.625rem 0.75rem', borderTop: `1px solid ${t.border}`, fontSize: '0.75rem' }}>
            <a href={`/build/${buildId}`} style={{ color: t.textSecondary, textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
              ← Back to build
            </a>
          </div>
        </div>

        {/* ── RIGHT: Code Editor ──────────────────────────── */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>
          {/* Tab bar + toolbar */}
          <div style={{
            display: 'flex', alignItems: 'stretch', borderBottom: `1px solid ${t.border}`,
            background: t.bgElevated, minHeight: 36,
          }}>
            {/* Tabs */}
            <div style={{ display: 'flex', flex: 1, overflowX: 'auto' }}>
              {openTabs.map((tab) => {
                const isActive = tab === selectedFile;
                const isModified = modifiedFiles.has(tab);
                const fileName = tab.split('/').pop() ?? tab;
                return (
                  <div
                    key={tab} onClick={() => handleFileClick(tab)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '0.375rem',
                      padding: '0 0.75rem', fontSize: '0.75rem', cursor: 'pointer',
                      borderRight: `1px solid ${t.border}`,
                      background: isActive ? t.bg : 'transparent',
                      color: isActive ? t.text : t.textMuted,
                      fontWeight: isActive ? 500 : 400, whiteSpace: 'nowrap',
                      position: 'relative',
                      ...(isActive ? { borderBottom: `2px solid ${t.accent}` } : {}),
                    }}
                  >
                    <FileIcon path={tab} />
                    {fileName}
                    {isModified && <span style={{ color: '#eab308', fontSize: '0.75rem', marginLeft: -2 }}>●</span>}
                    <button
                      onClick={(e) => { e.stopPropagation(); handleCloseTab(tab); }}
                      style={{
                        background: 'none', border: 'none', padding: '0 0.125rem',
                        cursor: 'pointer', color: t.textMuted, fontSize: '0.875rem',
                        lineHeight: 1, opacity: isActive ? 1 : 0,
                      }}
                    >×</button>
                  </div>
                );
              })}
            </div>

            {/* Toolbar buttons */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', padding: '0 0.5rem', flexShrink: 0 }}>
              <button
                onClick={() => setEditMode(!editMode)}
                style={{
                  padding: '0.25rem 0.5rem', fontSize: '0.6875rem', fontWeight: 500,
                  border: `1px solid ${t.border}`, borderRadius: '0.25rem', cursor: 'pointer',
                  background: editMode ? t.accent : 'transparent',
                  color: editMode ? t.accentText : t.textSecondary,
                  transition: 'all 0.15s',
                }}
              >{editMode ? '✎ Editing' : '✎ Edit'}</button>

              {modifiedFiles.size > 0 && (
                <>
                  <button
                    onClick={handleSave} disabled={saving}
                    style={{
                      padding: '0.25rem 0.5rem', fontSize: '0.6875rem', fontWeight: 600,
                      border: 'none', borderRadius: '0.25rem', cursor: saving ? 'default' : 'pointer',
                      background: '#16a34a', color: '#ffffff', opacity: saving ? 0.6 : 1,
                    }}
                  >{saving ? 'Saving…' : `Save (${modifiedFiles.size})`}</button>
                  <button
                    onClick={handleRebuild}
                    style={{
                      padding: '0.25rem 0.5rem', fontSize: '0.6875rem', fontWeight: 600,
                      border: 'none', borderRadius: '0.25rem', cursor: 'pointer',
                      background: '#1d4ed8', color: '#ffffff',
                    }}
                  >Rebuild</button>
                </>
              )}

              <button
                onClick={() => setGithubPanelOpen(!githubPanelOpen)}
                style={{
                  padding: '0.25rem 0.5rem', fontSize: '0.6875rem', fontWeight: 500,
                  border: `1px solid ${t.border}`, borderRadius: '0.25rem', cursor: 'pointer',
                  background: githubPanelOpen ? t.bgActive : 'transparent',
                  color: t.textSecondary,
                  display: 'flex', alignItems: 'center', gap: '0.25rem',
                }}
              >
                <GithubIcon size={12} />
                GitHub
              </button>
            </div>
          </div>

          {/* Save status */}
          {saveStatus && (
            <div style={{
              padding: '0.25rem 0.75rem', fontSize: '0.6875rem', fontWeight: 500,
              background: saveStatus.startsWith('Error') ? '#fef2f2' : '#f0fdf4',
              color: saveStatus.startsWith('Error') ? '#dc2626' : '#166534',
              borderBottom: `1px solid ${t.border}`,
            }}>{saveStatus}</div>
          )}

          {/* GitHub panel */}
          {githubPanelOpen && (
            <div style={{
              padding: '0.5rem 0.75rem', borderBottom: `1px solid ${t.border}`,
              background: t.bgSurface, display: 'flex', flexDirection: 'column', gap: '0.375rem',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                <GithubIcon size={14} />
                <span style={{ fontSize: '0.6875rem', fontWeight: 600, color: t.text }}>GitHub Integration</span>
              </div>
              <div style={{ display: 'flex', gap: '0.375rem', alignItems: 'center', flexWrap: 'wrap' }}>
                <input
                  value={githubRepo} onChange={(e) => setGithubRepo(e.target.value)}
                  placeholder="owner/repo" spellCheck={false}
                  style={{
                    flex: '1 1 160px', padding: '0.3rem 0.5rem', fontSize: '0.75rem',
                    border: `1px solid ${t.border}`, borderRadius: '0.25rem',
                    background: t.bgElevated, color: t.text, outline: 'none',
                    fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, monospace',
                  }}
                />
                <input
                  value={githubBranch} onChange={(e) => setGithubBranch(e.target.value)}
                  placeholder="branch" spellCheck={false}
                  style={{
                    width: 90, padding: '0.3rem 0.5rem', fontSize: '0.75rem',
                    border: `1px solid ${t.border}`, borderRadius: '0.25rem',
                    background: t.bgElevated, color: t.text, outline: 'none',
                    fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, monospace',
                  }}
                />
                <button
                  onClick={handleGithubPush} disabled={githubLoading || !githubRepo.trim()}
                  style={{
                    padding: '0.3rem 0.625rem', fontSize: '0.6875rem', fontWeight: 600,
                    border: 'none', borderRadius: '0.25rem', cursor: githubLoading ? 'default' : 'pointer',
                    background: '#16a34a', color: '#fff', opacity: githubLoading || !githubRepo.trim() ? 0.5 : 1,
                  }}
                >↑ Push</button>
                <button
                  onClick={handleGithubPull} disabled={githubLoading || !githubRepo.trim()}
                  style={{
                    padding: '0.3rem 0.625rem', fontSize: '0.6875rem', fontWeight: 600,
                    border: 'none', borderRadius: '0.25rem', cursor: githubLoading ? 'default' : 'pointer',
                    background: '#1d4ed8', color: '#fff', opacity: githubLoading || !githubRepo.trim() ? 0.5 : 1,
                  }}
                >↓ Pull</button>
              </div>
              {githubStatus && (
                <div style={{
                  fontSize: '0.6875rem', color: githubStatus.startsWith('✗') ? '#dc2626' : '#16a34a',
                  whiteSpace: 'pre-wrap', lineHeight: 1.4,
                }}>{githubStatus}</div>
              )}
            </div>
          )}

          {/* Code body */}
          <div style={{
            flex: 1, overflow: 'auto', background: t.editorBg,
            fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace',
            fontSize: '0.8125rem', lineHeight: 1.7,
          }}>
            {selectedFile && selectedContent ? (
              editMode ? (
                /* ── Edit mode: textarea ── */
                <div style={{ display: 'flex', minHeight: '100%' }}>
                  <div style={{
                    padding: '0.75rem 0.5rem 0.75rem 0.75rem', textAlign: 'right',
                    color: t.editorLineNum, userSelect: 'none', flexShrink: 0, minWidth: 44,
                  }}>
                    {(editContent || selectedContent).split('\n').map((_, i) => (
                      <div key={i} style={{ lineHeight: 1.7 }}>{i + 1}</div>
                    ))}
                  </div>
                  <textarea
                    ref={textareaRef}
                    value={editContent || selectedContent}
                    onChange={(e) => handleEditChange(e.target.value)}
                    spellCheck={false}
                    style={{
                      flex: 1, margin: 0, padding: '0.75rem 1rem 0.75rem 0.5rem',
                      background: 'transparent', color: t.editorText, border: 'none',
                      outline: 'none', resize: 'none',
                      fontFamily: 'inherit', fontSize: 'inherit', lineHeight: 'inherit',
                      whiteSpace: 'pre', tabSize: 2, minHeight: '100%',
                      caretColor: '#fbbf24',
                    }}
                    onKeyDown={(e) => {
                      // Tab support
                      if (e.key === 'Tab') {
                        e.preventDefault();
                        const ta = e.currentTarget;
                        const start = ta.selectionStart;
                        const end = ta.selectionEnd;
                        const val = ta.value;
                        handleEditChange(val.substring(0, start) + '  ' + val.substring(end));
                        requestAnimationFrame(() => { ta.selectionStart = ta.selectionEnd = start + 2; });
                      }
                    }}
                  />
                </div>
              ) : (
                /* ── Read mode: highlighted ── */
                <div style={{ display: 'flex', minWidth: 'max-content' }}>
                  <div style={{
                    padding: '0.75rem 0.5rem 0.75rem 0.75rem', textAlign: 'right',
                    color: t.editorLineNum, userSelect: 'none', flexShrink: 0, minWidth: 44,
                  }}>
                    {selectedContent.split('\n').map((_, i) => (
                      <div key={i}>{i + 1}</div>
                    ))}
                  </div>
                  <pre style={{
                    margin: 0, padding: '0.75rem 1rem 0.75rem 0.5rem',
                    color: t.editorText, flexGrow: 1, whiteSpace: 'pre', tabSize: 2,
                  }}>
                    {selectedContent.split('\n').map((line, i) => (
                      <div key={i}>{highlightLine(line, getLanguage(selectedFile))}</div>
                    ))}
                  </pre>
                </div>
              )
            ) : (
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                height: '100%', color: t.editorLineNum, fontSize: '0.8125rem',
              }}>
                Select a file to view its code
              </div>
            )}
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
  node, depth, selectedFile, expandedDirs, modifiedFiles, t,
  onFileClick, onToggleDir,
}: {
  node: FileTreeNode;
  depth: number;
  selectedFile: string | null;
  expandedDirs: Set<string>;
  modifiedFiles: Set<string>;
  t: ThemeTokens;
  onFileClick: (path: string) => void;
  onToggleDir: (path: string) => void;
}) {
  const isExpanded = expandedDirs.has(node.path);
  const isSelected = node.path === selectedFile;
  const isModified = modifiedFiles.has(node.path);

  if (node.isFile) {
    return (
      <div
        onClick={() => onFileClick(node.path)}
        style={{
          display: 'flex', alignItems: 'center', gap: '0.25rem',
          padding: '0.2rem 0.5rem 0.2rem',
          paddingLeft: `${depth * 0.75 + 0.75}rem`,
          cursor: 'pointer', fontSize: '0.75rem',
          color: isSelected ? t.text : t.textSecondary,
          background: isSelected ? t.bgActive : 'transparent',
          fontWeight: isSelected ? 500 : 400,
        }}
      >
        <FileIcon path={node.path} />
        {node.name}
        {isModified && <span style={{ color: '#eab308', fontSize: '0.5rem', marginLeft: 2 }}>●</span>}
      </div>
    );
  }

  return (
    <>
      <div
        onClick={() => onToggleDir(node.path)}
        style={{
          display: 'flex', alignItems: 'center', gap: '0.25rem',
          padding: '0.2rem 0.5rem 0.2rem',
          paddingLeft: `${depth * 0.75 + 0.5}rem`,
          cursor: 'pointer', fontSize: '0.75rem',
          color: t.textSecondary, fontWeight: 500,
        }}
      >
        <span style={{ fontSize: '0.625rem', width: '0.75rem', textAlign: 'center', flexShrink: 0 }}>
          {isExpanded ? '▼' : '▶'}
        </span>
        {node.name}/
      </div>
      {isExpanded && node.children.map((child) => (
        <FileTreeNodeView
          key={child.path} node={child} depth={depth + 1}
          selectedFile={selectedFile} expandedDirs={expandedDirs}
          modifiedFiles={modifiedFiles} t={t}
          onFileClick={onFileClick} onToggleDir={onToggleDir}
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

function GithubIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="currentColor" style={{ flexShrink: 0 }}>
      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
    </svg>
  );
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
