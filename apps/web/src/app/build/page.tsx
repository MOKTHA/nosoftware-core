/**
 * /build — Build & deploy page for the Control Plane UI (Phase 6).
 *
 * Renders a "Start build" button that POST /api/builds, then streams
 * real-time pipeline progress via the BuildTrace component. When the
 * deploy-to-vercel stage completes, the right panel loads the live
 * app in an iframe and the URL appears as a link in the top bar.
 */
'use client';

import { useState } from 'react';
import { BuildTrace } from '@/components/BuildTrace';

export default function BuildPage() {
  const [buildId, setBuildId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deployedUrl, setDeployedUrl] = useState<string | null>(null);

  async function startBuild() {
    setLoading(true);
    setError(null);
    setDeployedUrl(null);
    try {
      const res = await fetch('/api/builds', { method: 'POST' });
      if (!res.ok) {
        const body = await res.text();
        throw new Error(`${res.status}: ${body}`);
      }
      const { buildId: id } = (await res.json()) as { buildId: string };
      setBuildId(id);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0, height: 'calc(100vh - 8rem)' }}>
      {/* Top bar — URL display */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0.5rem 0',
          marginBottom: '0.75rem',
          borderBottom: '1px solid #eaeaea',
          minHeight: '2rem',
        }}
      >
        <span style={{ fontWeight: 600, fontSize: '0.875rem', color: '#666' }}>
          NoSoftware.ai
        </span>
        {deployedUrl && (
          <a
            href={deployedUrl}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              fontSize: '0.8125rem',
              color: '#0070f3',
              textDecoration: 'none',
              fontFamily: 'monospace',
            }}
          >
            {deployedUrl} ↗
          </a>
        )}
      </div>

      {/* Main content — left panel + right panel */}
      <div style={{ display: 'flex', gap: '1.5rem', flex: 1, minHeight: 0 }}>
        {/* Left panel — build controls and trace (w-72 = 18rem) */}
        <div
          style={{
            width: '18rem',
            flexShrink: 0,
            display: 'flex',
            flexDirection: 'column',
            gap: '1rem',
            overflowY: 'auto',
          }}
        >
          <h2 style={{ fontSize: '1.25rem', margin: 0 }}>Build</h2>
          <p style={{ color: '#666', fontSize: '0.875rem', lineHeight: 1.5 }}>
            Trigger a pipeline build from the helpdesk ticketing fixture. Real-time
            stage progress streams via SSE below.
          </p>

          <button
            onClick={startBuild}
            disabled={loading || buildId !== null}
            style={{
              padding: '0.5rem 1rem',
              background: loading || buildId ? '#ccc' : '#0070f3',
              color: '#fff',
              border: 'none',
              borderRadius: '0.375rem',
              fontSize: '0.875rem',
              cursor: loading || buildId ? 'default' : 'pointer',
            }}
          >
            {loading
              ? 'Starting…'
              : buildId
                ? 'Building…'
                : 'Build helpdesk app'}
          </button>

          {error && (
            <p style={{ color: '#ef4444', fontSize: '0.875rem' }}>{error}</p>
          )}

          {buildId && (
            <BuildTrace
              buildId={buildId}
              onDeployed={(url) => setDeployedUrl(url)}
            />
          )}
        </div>

        {/* Right panel — iframe preview or placeholder */}
        <div
          style={{
            flex: 1,
            background: '#f5f5f5',
            borderRadius: '0.5rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: '24rem',
            overflow: 'hidden',
          }}
        >
          {deployedUrl ? (
            <iframe
              src={deployedUrl}
              style={{
                width: '100%',
                height: '100%',
                border: 'none',
                borderRadius: '0.5rem',
              }}
              title="Deployed app preview"
            />
          ) : (
            <p style={{ color: '#999', fontSize: '0.875rem' }}>
              App preview loads here after build
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
