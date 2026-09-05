/**
 * CodeViewer — Full-page file tree + code editor.
 *
 * Standalone component used by /build/[buildId]/code page.
 * Fetches files from the build API and renders an IDE-style layout:
 *
 *   ┌────────────┬──────────────────────────────┐
 *   │  File Tree  │   Code Editor (tabbed)       │
 *   │             │                              │
 *   │             │                              │
 *   └────────────┴──────────────────────────────┘
 */
'use client';

import { useEffect, useState, useCallback } from 'react';

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

export function CodeViewer({ buildId }: CodeViewerProps) {
  const [files, setFiles] = useState<FileEntry[]>([]);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [openTabs, setOpenTabs] = useState<string[]>([]);
  const [expandedDirs, setExpandedDirs] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
    } catch {
      setError('Failed to fetch files');
    } finally {
      setLoading(false);
    }
  }, [buildId]);

  useEffect(() => {
    fetchFiles();
  }, [fetchFiles]);

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

  /* ── Loading / Error states ── */
  if (loading) {
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
        <Spinner /> Loading files…
      </div>
    );
  }

  if (error) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100%',
        background: '#fafafa',
        color: '#737373',
        fontSize: '0.875rem',
        gap: '0.75rem',
      }}>
        <span style={{ fontSize: '2rem' }}>📂</span>
        <span>{error}</span>
        <a
          href={`/build/${buildId}`}
          style={{ fontSize: '0.8125rem', color: '#0a0a0a', textDecoration: 'underline' }}
        >
          ← Back to build
        </a>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', height: '100%', background: '#ffffff' }}>
      {/* ── LEFT: File Tree ─────────────────────────────── */}
      <div
        style={{
          width: 240,
          flexShrink: 0,
          background: '#fafafa',
          borderRight: '1px solid #e5e5e5',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '0.625rem 0.75rem',
            borderBottom: '1px solid #e5e5e5',
            background: '#f5f5f5',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
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
            Explorer
          </div>
          <span style={{ fontSize: '0.6875rem', color: '#a3a3a3' }}>
            {files.length} files
          </span>
        </div>

        {/* Tree body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '0.25rem 0' }}>
          {fileTree.children.map((node) => (
            <FileTreeNodeView
              key={node.path}
              node={node}
              depth={0}
              selectedFile={selectedFile}
              expandedDirs={expandedDirs}
              onFileClick={handleFileClick}
              onToggleDir={toggleDir}
            />
          ))}
        </div>

        {/* Back link */}
        <div
          style={{
            padding: '0.625rem 0.75rem',
            borderTop: '1px solid #e5e5e5',
            fontSize: '0.75rem',
          }}
        >
          <a
            href={`/build/${buildId}`}
            style={{
              color: '#525252',
              textDecoration: 'none',
              display: 'flex',
              alignItems: 'center',
              gap: '0.25rem',
            }}
          >
            ← Back to build
          </a>
        </div>
      </div>

      {/* ── RIGHT: Code Editor ──────────────────────────── */}
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
              Select a file to view its code
            </div>
          )}
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
          padding: '0.2rem 0.5rem 0.2rem',
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
          padding: '0.2rem 0.5rem 0.2rem',
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
