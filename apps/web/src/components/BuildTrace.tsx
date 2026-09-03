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
    return (
      <div
        style={{
          fontSize: '0.875rem',
          color: '#a3a3a3',
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
        }}
      >
        <Spinner /> Connecting…
      </div>
    );
  }

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '0.125rem',
        fontSize: '0.8125rem',
        fontFamily:
          'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace',
      }}
    >
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
              padding: '0.25rem 0',
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
                    ? '#dc2626'
                    : s.status === 'done'
                      ? '#a3a3a3'
                      : '#0a0a0a',
                fontWeight: s.status === 'running' ? 500 : 400,
              }}
            >
              {formatStepName(s.step)}
            </span>
            <span
              style={{
                marginLeft: 'auto',
                color: '#a3a3a3',
                fontSize: '0.6875rem',
              }}
            >
              {(s.elapsed_ms / 1000).toFixed(1)}s
            </span>
          </button>
          {s.expanded && s.detail && (
            <p
              style={{
                paddingLeft: '1.5rem',
                fontSize: '0.6875rem',
                color: '#a3a3a3',
                paddingBottom: '0.25rem',
                margin: 0,
                lineHeight: 1.5,
              }}
            >
              {s.detail}
            </p>
          )}
        </div>
      ))}

      {done && (
        <div
          style={{
            marginTop: '0.5rem',
            fontSize: '0.75rem',
            fontWeight: 500,
            padding: '0.25rem 0.75rem',
            borderRadius: '9999px',
            display: 'inline-flex',
            alignSelf: 'flex-start',
            ...(steps.some((s) => s.status === 'error')
              ? { background: '#fef2f2', color: '#dc2626' }
              : { background: '#dcfce7', color: '#166534' }),
          }}
        >
          {steps.some((s) => s.status === 'error')
            ? 'Build failed'
            : 'Build complete'}
        </div>
      )}
    </div>
  );
}

function StatusIcon({ status }: { status: BuildEvent['status'] }) {
  if (status === 'running') return <Spinner />;
  if (status === 'done')
    return (
      <svg
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="#16a34a"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <polyline points="20 6 9 17 4 12" />
      </svg>
    );
  if (status === 'warning')
    return (
      <svg
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="#d97706"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
        <line x1="12" y1="9" x2="12" y2="13" />
        <line x1="12" y1="17" x2="12.01" y2="17" />
      </svg>
    );
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="#dc2626"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

function Spinner() {
  return (
    <span
      style={{
        display: 'inline-block',
        width: '0.875rem',
        height: '0.875rem',
        border: '1.5px solid #0a0a0a',
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
