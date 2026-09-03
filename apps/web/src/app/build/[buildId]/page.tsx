/**
 * /build/[buildId] — Persistent build page.
 *
 * Each build gets its own URL so users can refresh and come back to
 * the same build. On load it fetches the build record to get metadata
 * (app name, prompt, status), then always mounts BuildTrace which
 * connects to the SSE stream endpoint. The stream route handles:
 *   - pending  → starts pipeline, streams live events
 *   - running  → replays stored events, then polls for completion
 *   - succeeded/failed → replays all stored events (instant replay)
 */
'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
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

/* ------------------------------------------------------------------ */
/*  Component                                                         */
/* ------------------------------------------------------------------ */

export default function BuildDetailPage() {
  const { buildId } = useParams<{ buildId: string }>();

  const [build, setBuild] = useState<BuildRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deployedUrl, setDeployedUrl] = useState<string | null>(null);

  const iframeRef = useRef<HTMLIFrameElement>(null);

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

      // If already deployed, show the preview immediately
      if (data.status === 'succeeded' && data.deployedUrl) {
        setDeployedUrl(data.deployedUrl);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [buildId]);

  useEffect(() => {
    fetchBuild();
  }, [fetchBuild]);

  /* ---------------------------------------------------------------- */
  /*  Deployed callback from BuildTrace                               */
  /* ---------------------------------------------------------------- */

  function handleDeployed(url: string) {
    setDeployedUrl(url);
    // Refresh the build record to get the latest status
    fetchBuild();
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
      {/* ── Left panel: build info ──────────────────────────────── */}
      <div
        style={{
          flex: '0 0 400px',
          maxWidth: '400px',
          display: 'flex',
          flexDirection: 'column',
          padding: '0 1rem 0 0',
        }}
      >
        {/* Build header */}
        <div style={{ padding: '1rem 0' }}>
          <a
            href="/build"
            style={{ fontSize: '0.75rem', color: '#737373' }}
          >
            ← New Build
          </a>

          <h2
            style={{
              fontSize: '1.25rem',
              fontWeight: 600,
              color: '#0a0a0a',
              margin: '0.5rem 0 0.5rem',
              letterSpacing: '-0.01em',
            }}
          >
            {build.appName}
          </h2>

          {/* Status badge */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span
              style={{
                fontSize: '0.6875rem',
                fontWeight: 600,
                padding: '0.125rem 0.625rem',
                borderRadius: '9999px',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                ...statusStyle(build.status),
              }}
            >
              {build.status}
            </span>
            <span style={{ fontSize: '0.75rem', color: '#a3a3a3' }}>
              {buildId.slice(0, 8)}
            </span>
          </div>
        </div>

        {/* Prompt */}
        {build.prompt && (
          <div
            style={{
              background: '#ffffff',
              border: '1px solid #e5e5e5',
              borderRadius: '0.75rem',
              padding: '0.75rem 1rem',
              fontSize: '0.8125rem',
              lineHeight: 1.7,
              color: '#525252',
              marginBottom: '1rem',
              maxHeight: '200px',
              overflowY: 'auto',
            }}
          >
            {build.prompt}
          </div>
        )}

        {/* Deployed URL link */}
        {deployedUrl && (
          <div style={{ marginTop: 'auto', paddingBottom: '1rem' }}>
            <a
              href={deployedUrl}
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
              Open App ↗
            </a>
          </div>
        )}
      </div>

      {/* ── Right panel: build trace / preview ─────────────────── */}
      <div
        style={{
          flex: 1,
          borderRadius: '0.75rem',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          border: '1px solid #e5e5e5',
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
          borderRadius: '0.75rem 0.75rem 0 0',
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
