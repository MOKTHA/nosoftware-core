/**
 * BuildTrace — real-time pipeline build progress via SSE.
 *
 * Layout:
 *   - Top: horizontal step progress indicators (dots with labels)
 *   - Main: terminal-style scrolling log output
 *
 * Connects to GET /api/builds/:buildId/stream, parses incoming BuildEvent
 * objects. Supports two modes:
 *   - Live: events arrive in real-time from a running pipeline
 *   - Replay: stored events arrive instantly from DB (after page refresh)
 *
 * When the stream sends a `__replay` event with detail "replay-end:poll",
 * the component switches to polling the build API for completion.
 *
 * Closes the EventSource automatically when the pipeline emits a
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
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Auto-scroll terminal
  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  useEffect(() => {
    const es = new EventSource(`/api/builds/${buildId}/stream`);
    esRef.current = es;
    setConnected(true);

    es.onmessage = (e: MessageEvent) => {
      const event = JSON.parse(e.data as string) as BuildEvent;

      // Handle replay-end marker: switch to polling mode
      if (event.step === '__replay' && event.detail === 'replay-end:poll') {
        es.close();
        startPolling();
        return;
      }

      // Update step state
      setSteps((prev) => {
        const idx = prev.findIndex((s) => s.step === event.step);
        const next: StepState = { ...event };
        if (idx === -1) return [...prev, next];
        const updated = [...prev];
        updated[idx] = next;
        return updated;
      });

      // Add to terminal log (skip duplicates from replay)
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

  /**
   * Poll the build API for completion when we can't reconnect to SSE
   * (build is already running from a prior connection).
   */
  function startPolling() {
    if (pollRef.current) return;
    pollRef.current = setInterval(async () => {
      try {
        const res = await fetch(`/api/builds/${buildId}`);
        if (!res.ok) return;
        const data = (await res.json()) as {
          status: string;
          deployedUrl: string | null;
          errorMessage: string | null;
        };

        if (data.status === 'succeeded' || data.status === 'failed') {
          if (pollRef.current) clearInterval(pollRef.current);
          pollRef.current = null;

          // Re-fetch the full event stream to get the final events
          try {
            const streamRes = await fetch(`/api/builds/${buildId}/stream`);
            if (streamRes.ok) {
              const text = await streamRes.text();
              const lines = text.split('\n');
              for (const line of lines) {
                if (!line.startsWith('data: ')) continue;
                const event = JSON.parse(line.slice(6)) as BuildEvent;
                if (event.step === '__replay') continue;

                // Only add events we don't already have
                setSteps((prev) => {
                  const idx = prev.findIndex((s) => s.step === event.step);
                  const next: StepState = { ...event };
                  if (idx === -1) return [...prev, next];
                  const updated = [...prev];
                  updated[idx] = next;
                  return updated;
                });
              }

              // Find and add the terminal event
              for (const line of lines) {
                if (!line.startsWith('data: ')) continue;
                const event = JSON.parse(line.slice(6)) as BuildEvent;
                if (event.step === '__replay') continue;
                if (event.step === 'pipeline' && (event.status === 'done' || event.status === 'error')) {
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
                  setDone(true);
                  if (event.status === 'error') setFailed(true);
                  if (event.status === 'done' && event.detail.startsWith('https://')) {
                    onDeployed?.(event.detail);
                  }
                }
              }
            }
          } catch {
            // Fallback: just mark done based on API response
            setDone(true);
            if (data.status === 'failed') setFailed(true);
            if (data.status === 'succeeded' && data.deployedUrl) {
              onDeployed?.(data.deployedUrl);
            }
          }
        }
      } catch {
        // Swallow poll errors — retry on next interval
      }
    }, 3000);
  }

  if (!connected && steps.length === 0) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        {/* Minimal progress header */}
        <div
          style={{
            padding: '1rem 1.25rem 0.75rem',
            borderBottom: '1px solid #e5e5e5',
            background: '#ffffff',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Spinner />
            <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#0a0a0a' }}>
              Connecting to build…
            </span>
          </div>
        </div>
        {/* Placeholder terminal */}
        <div
          style={{
            flex: 1,
            background: '#0a0a0a',
            padding: '1rem',
            fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace',
            fontSize: '0.75rem',
            lineHeight: 1.8,
            color: '#a3a3a3',
          }}
        >
          <div style={{ color: '#525252', marginBottom: '0.5rem', userSelect: 'none' }}>
            $ nosoftware build --id {buildId.slice(0, 8)}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ color: '#a3a3a3', animation: 'pulse-text 2s ease-in-out infinite' }}>
              Establishing connection…
            </span>
            <span
              style={{
                display: 'inline-block',
                width: '0.5rem',
                height: '1rem',
                background: '#737373',
                animation: 'blink 1s step-end infinite',
                verticalAlign: 'bottom',
              }}
            />
          </div>
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
                : '✓ Build Complete'
              : currentStepIndex >= 0
                ? getStepVerb(pipelineSteps[currentStepIndex]!.step)
                : pollRef.current
                  ? 'Build in progress…'
                  : 'Starting build…'}
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

        {/* Current step label — Claude-style verb phrase */}
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
            <span style={{ color: '#525252', fontWeight: 500 }}>
              {getStepVerb(pipelineSteps[currentStepIndex]!.step)}
            </span>
            <span style={{ color: '#d4d4d4' }}>·</span>
            <span>{(pipelineSteps[currentStepIndex]!.elapsed_ms / 1000).toFixed(1)}s</span>
          </div>
        )}

        {/* Polling indicator (for reconnected running builds) */}
        {!done && currentStepIndex < 0 && pollRef.current && (
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
            <span style={{ color: '#525252', fontWeight: 500 }}>
              Waiting for build to finish…
            </span>
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

            {/* Step name — use verb phrase for running steps */}
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
              {log.status === 'running'
                ? getStepVerb(log.step).replace(/…$/, '')
                : formatStepName(log.step)}
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

        {/* Active step indicator + blinking cursor */}
        {!done && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.25rem' }}>
            {/* Show what's currently happening */}
            {currentStepIndex >= 0 ? (
              <>
                <span style={{ color: '#3b82f6' }}>▸</span>
                <span style={{ color: '#3b82f6', animation: 'pulse-text 2s ease-in-out infinite' }}>
                  {getStepVerb(pipelineSteps[currentStepIndex]!.step)}
                </span>
              </>
            ) : pollRef.current ? (
              <>
                <span style={{ color: '#eab308' }}>◦</span>
                <span style={{ color: '#eab308', animation: 'pulse-text 2s ease-in-out infinite' }}>
                  Build running on server — waiting for update…
                </span>
              </>
            ) : logs.length === 0 ? (
              <>
                <span style={{ color: '#a3a3a3' }}>◦</span>
                <span style={{ color: '#a3a3a3', animation: 'pulse-text 2s ease-in-out infinite' }}>
                  Initializing pipeline…
                </span>
              </>
            ) : null}
            <span
              style={{
                display: 'inline-block',
                width: '0.5rem',
                height: '1rem',
                background: '#737373',
                animation: 'blink 1s step-end infinite',
                verticalAlign: 'bottom',
                flexShrink: 0,
              }}
            />
          </div>
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

/** Claude-style verbs for each pipeline stage — shown while running. */
const STEP_VERBS: Record<string, string> = {
  'normalize-spec': 'Parsing and normalizing your spec…',
  'resolve-blueprint-plan': 'Resolving blueprint architecture…',
  'generate-schema': 'Designing the database schema…',
  'generate-permissions': 'Wiring up roles and permissions…',
  'generate-backend': 'Generating API routes and services…',
  'generate-frontend': 'Crafting pages, forms, and components…',
  'generate-workflows': 'Orchestrating business workflows…',
  'generate-fixtures-tests': 'Seeding test data and writing tests…',
  'generate-deployment': 'Preparing deployment configuration…',
  'deploy-to-vercel': 'QA testing, building, and deploying…',
};

/** Returns a Claude-style active verb phrase for the current step. */
function getStepVerb(step: string): string {
  return STEP_VERBS[step] ?? `Working on ${formatStepName(step)}…`;
}
