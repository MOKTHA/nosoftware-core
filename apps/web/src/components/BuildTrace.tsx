/**
 * BuildTrace — real-time pipeline build progress via SSE.
 *
 * Connects to GET /api/builds/:buildId/stream, parses incoming BuildEvent
 * objects, and renders each stage as an expandable row with a status icon.
 *
 * Closes the EventSource automatically when the pipeline emits a terminal
 * event (step=pipeline, status=done|error) or on unmount.
 */
'use client';

import { useEffect, useRef, useState } from 'react';

interface BuildEvent {
  step: string;
  status: 'running' | 'done' | 'warning' | 'error';
  detail: string;
  elapsed_ms: number;
}

interface StepState {
  step: string;
  status: BuildEvent['status'];
  detail: string;
  elapsed_ms: number;
  expanded: boolean;
}

interface BuildTraceProps {
  buildId: string;
  onDeployed?: (url: string) => void;
}

export function BuildTrace({ buildId, onDeployed }: BuildTraceProps) {
  const [steps, setSteps] = useState<StepState[]>([]);
  const [connected, setConnected] = useState(false);
  const [done, setDone] = useState(false);
  const esRef = useRef<EventSource | null>(null);

  useEffect(() => {
    const es = new EventSource(`/api/builds/${buildId}/stream`);
    esRef.current = es;
    setConnected(true);

    es.onmessage = (e: MessageEvent) => {
      const event = JSON.parse(e.data as string) as BuildEvent;

      setSteps((prev) => {
        const idx = prev.findIndex((s) => s.step === event.step);
        const next: StepState = {
          ...event,
          expanded: event.status === 'running' || event.status === 'error',
        };
        if (idx === -1) return [...prev, next];
        const updated = [...prev];
        updated[idx] = next;
        return updated;
      });

      // Notify parent when a deployed URL is received
      if (
        event.step === 'pipeline' &&
        event.status === 'done' &&
        event.detail.startsWith('https://')
      ) {
        onDeployed?.(event.detail);
      }

      if (
        event.step === 'pipeline' &&
        (event.status === 'done' || event.status === 'error')
      ) {
        setDone(true);
        es.close();
      }
    };

    es.onerror = () => {
      setConnected(false);
      es.close();
    };

    return () => {
      es.close();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps -- onDeployed is stable (arrow in parent)
  }, [buildId]);

  if (!connected && steps.length === 0) {
    return <p style={{ fontSize: '0.875rem', color: '#999' }}>Connecting…</p>;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', fontSize: '0.875rem', fontFamily: 'monospace' }}>
      {steps.map((s) => (
        <div key={s.step} style={{ display: 'flex', flexDirection: 'column' }}>
          <button
            onClick={() =>
              setSteps((prev) =>
                prev.map((p) =>
                  p.step === s.step ? { ...p, expanded: !p.expanded } : p,
                ),
              )
            }
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              textAlign: 'left',
              padding: '0.125rem 0',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: 'inherit',
              font: 'inherit',
            }}
          >
            <StatusIcon status={s.status} />
            <span
              style={{
                color:
                  s.status === 'error'
                    ? '#ef4444'
                    : s.status === 'done'
                      ? '#888'
                      : '#111',
              }}
            >
              {formatStepName(s.step)}
            </span>
            <span
              style={{
                marginLeft: 'auto',
                color: '#999',
                fontSize: '0.75rem',
              }}
            >
              {(s.elapsed_ms / 1000).toFixed(1)}s
            </span>
          </button>
          {s.expanded && s.detail && (
            <p
              style={{
                paddingLeft: '1.5rem',
                fontSize: '0.75rem',
                color: '#888',
                paddingBottom: '0.25rem',
                margin: 0,
              }}
            >
              {s.detail}
            </p>
          )}
        </div>
      ))}
      {done && (
        <p style={{ fontSize: '0.75rem', color: '#999', marginTop: '0.5rem' }}>
          {steps.some((s) => s.status === 'error')
            ? 'Build failed.'
            : 'Build complete.'}
        </p>
      )}
    </div>
  );
}

function StatusIcon({ status }: { status: BuildEvent['status'] }) {
  if (status === 'running') return <Spinner />;
  if (status === 'done')
    return <span style={{ color: '#22c55e' }}>✓</span>;
  if (status === 'warning')
    return <span style={{ color: '#eab308' }}>⚠</span>;
  return <span style={{ color: '#ef4444' }}>✗</span>;
}

function Spinner() {
  return (
    <span
      style={{
        display: 'inline-block',
        width: '0.75rem',
        height: '0.75rem',
        border: '1.5px solid #111',
        borderTopColor: 'transparent',
        borderRadius: '50%',
        animation: 'spin 0.6s linear infinite',
      }}
    />
  );
}

function formatStepName(step: string): string {
  return step
    .replace(/-/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}
