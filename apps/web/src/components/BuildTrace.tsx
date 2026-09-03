/**
 * BuildTrace — real-time pipeline build progress via SSE.
 *
 * Layout:
 *   - Top: horizontal step progress indicators (dots with labels)
 *   - Main: terminal-style scrolling log output
 *
 * Connects to GET /api/builds/:buildId/stream, parses incoming BuildEvent
 * objects. Closes the EventSource automatically when the pipeline emits a
 * terminal event (step=pipeline, status=done|error) or on unmount.
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
}

interface LogEntry {
  timestamp: number;
  step: string;
  status: BuildEvent['status'];
  detail: string;
  elapsed_ms: number;
}

interface BuildTraceProps {
  buildId: string;
  onDeployed?: (url: string) => void;
}

export function BuildTrace({ buildId, onDeployed }: BuildTraceProps) {
  const [steps, setSteps] = useState<StepState[]>([]);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [connected, setConnected] = useState(false);
  const [done, setDone] = useState(false);
  const [failed, setFailed] = useState(false);
  const esRef = useRef<EventSource | null>(null);
  const logEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll terminal
  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  useEffect(() => {
    const es = new EventSource(`/api/builds/${buildId}/stream`);
    esRef.current = es;
    setConnected(true);

    es.onmessage = (e: MessageEvent) => {
      const event = JSON.parse(e.data as string) as BuildEvent;

      // Update step state
      setSteps((prev) => {
        const idx = prev.findIndex((s) => s.step === event.step);
        const next: StepState = { ...event };
        if (idx === -1) return [...prev, next];
        const updated = [...prev];
        updated[idx] = next;
        return updated;
      });

      // Add to terminal log
      setLogs((prev) => [
        ...prev,
        {
          timestamp: Date.now(),
          step: event.step,
          status: event.status,
          detail: event.detail,
          elapsed_ms: event.elapsed_ms,
        },
      ]);

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
        if (event.status === 'error') setFailed(true);
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
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        <div
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#a3a3a3',
            gap: '0.5rem',
            fontSize: '0.875rem',
          }}
        >
          <Spinner /> Connecting to build…
        </div>
      </div>
    );
  }

  // Filter out the top-level "pipeline" step from the progress bar
  const pipelineSteps = steps.filter((s) => s.step !== 'pipeline');
  const currentStepIndex = pipelineSteps.findIndex((s) => s.status === 'running');
  const completedCount = pipelineSteps.filter((s) => s.status === 'done').length;
  const totalVisible = pipelineSteps.length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* ── Step progress bar (top) ── */}
      <div
        style={{
          padding: '1rem 1.25rem 0.75rem',
          borderBottom: '1px solid #e5e5e5',
          background: '#ffffff',
        }}
      >
        {/* Progress header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '0.75rem',
          }}
        >
          <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#0a0a0a' }}>
            {done
              ? failed
                ? 'Build Failed'
                : 'Build Complete'
              : 'Building…'}
          </span>
          <span style={{ fontSize: '0.75rem', color: '#a3a3a3' }}>
            {completedCount}/{totalVisible} steps
          </span>
        </div>

        {/* Step dots */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.25rem',
            overflowX: 'auto',
          }}
        >
          {pipelineSteps.map((s, i) => {
            const isActive = s.status === 'running';
            const isDone = s.status === 'done';
            const isError = s.status === 'error';
            const isWarning = s.status === 'warning';

            return (
              <div
                key={s.step}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.25rem',
                  flex: '0 0 auto',
                }}
              >
                {/* Dot */}
                <div
                  title={formatStepName(s.step)}
                  style={{
                    width: isActive ? '1.5rem' : '0.5rem',
                    height: '0.5rem',
                    borderRadius: isActive ? '0.25rem' : '50%',
                    background: isError
                      ? '#dc2626'
                      : isWarning
                        ? '#d97706'
                        : isDone
                          ? '#16a34a'
                          : isActive
                            ? '#0a0a0a'
                            : '#e5e5e5',
                    transition: 'all 0.3s ease',
                    ...(isActive
                      ? { animation: 'pulse 1.5s ease-in-out infinite' }
                      : {}),
                  }}
                />
                {/* Connector line */}
                {i < pipelineSteps.length - 1 && (
                  <div
                    style={{
                      width: '0.5rem',
                      height: '1px',
                      background: isDone ? '#16a34a' : '#e5e5e5',
                    }}
                  />
                )}
              </div>
            );
          })}
        </div>

        {/* Current step label */}
        {!done && currentStepIndex >= 0 && (
          <div
            style={{
              marginTop: '0.5rem',
              fontSize: '0.6875rem',
              color: '#737373',
              display: 'flex',
              alignItems: 'center',
              gap: '0.375rem',
            }}
          >
            <Spinner />
            {formatStepName(pipelineSteps[currentStepIndex]!.step)}
            <span style={{ color: '#d4d4d4' }}>·</span>
            <span>{(pipelineSteps[currentStepIndex]!.elapsed_ms / 1000).toFixed(1)}s</span>
          </div>
        )}
      </div>

      {/* ── Terminal log output ── */}
      <div
        style={{
          flex: 1,
          background: '#0a0a0a',
          padding: '1rem',
          overflowY: 'auto',
          fontFamily:
            'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace',
          fontSize: '0.75rem',
          lineHeight: 1.8,
          color: '#a3a3a3',
        }}
      >
        {/* Terminal header */}
        <div style={{ color: '#525252', marginBottom: '0.5rem', userSelect: 'none' }}>
          $ nosoftware build --id {buildId.slice(0, 8)}
        </div>

        {logs.map((log, i) => (
          <div key={i} style={{ display: 'flex', gap: '0.5rem' }}>
            {/* Status indicator */}
            <span
              style={{
                color:
                  log.status === 'error'
                    ? '#ef4444'
                    : log.status === 'done'
                      ? '#22c55e'
                      : log.status === 'warning'
                        ? '#eab308'
                        : '#3b82f6',
                flexShrink: 0,
              }}
            >
              {log.status === 'error'
                ? '✗'
                : log.status === 'done'
                  ? '✓'
                  : log.status === 'warning'
                    ? '⚠'
                    : '▸'}
            </span>

            {/* Timestamp */}
            <span style={{ color: '#525252', flexShrink: 0 }}>
              [{(log.elapsed_ms / 1000).toFixed(1)}s]
            </span>

            {/* Step name */}
            <span
              style={{
                color:
                  log.status === 'running'
                    ? '#e5e5e5'
                    : log.status === 'error'
                      ? '#ef4444'
                      : log.status === 'done'
                        ? '#737373'
                        : '#d4d4d4',
                fontWeight: log.status === 'running' ? 500 : 400,
                flexShrink: 0,
              }}
            >
              {formatStepName(log.step)}
            </span>

            {/* Detail */}
            {log.detail && log.step !== 'pipeline' && (
              <span style={{ color: '#525252' }}>
                — {log.detail}
              </span>
            )}
          </div>
        ))}

        {/* Done / failed message */}
        {done && (
          <div style={{ marginTop: '0.75rem' }}>
            <div
              style={{
                color: failed ? '#ef4444' : '#22c55e',
                fontWeight: 500,
              }}
            >
              {failed ? '✗ Build failed' : '✓ Build complete — deploying…'}
            </div>
          </div>
        )}

        {/* Blinking cursor */}
        {!done && (
          <span
            style={{
              display: 'inline-block',
              width: '0.5rem',
              height: '1rem',
              background: '#737373',
              animation: 'blink 1s step-end infinite',
              verticalAlign: 'bottom',
              marginTop: '0.25rem',
            }}
          />
        )}

        <div ref={logEndRef} />
      </div>
    </div>
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

function formatStepName(step: string): string {
  return step
    .replace(/-/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}
