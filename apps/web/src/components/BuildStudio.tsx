/**
 * BuildStudio — Build progress + collapsible preview panel.
 *
 * Shows live preview (collapsible) and agent status during/after a build.
 * File tree + code editor live at /build/[buildId]/code.
 *
 * Connects to SSE stream for real-time progress and notifies parent
 * of step updates via onStepUpdate callback so the chat can show
 * Claude-style code snippets.
 */
'use client';

import { useEffect, useRef, useState } from 'react';

/* ------------------------------------------------------------------ */
/*  Types                                                             */
/* ------------------------------------------------------------------ */

export interface BuildEvent {
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

interface BuildStudioProps {
  buildId: string;
  onDeployed?: (url: string) => void;
  onFilesReady?: () => void;
  onStepUpdate?: (event: BuildEvent) => void;
}

/* ------------------------------------------------------------------ */
/*  Component                                                         */
/* ------------------------------------------------------------------ */

export function BuildStudio({ buildId, onDeployed, onFilesReady, onStepUpdate }: BuildStudioProps) {
  const [steps, setSteps] = useState<StepState[]>([]);
  const [fileCount, setFileCount] = useState(0);
  const [connected, setConnected] = useState(false);
  const [done, setDone] = useState(false);
  const [failed, setFailed] = useState(false);
  const [deployedUrl, setDeployedUrl] = useState<string | null>(null);
  const [previewCollapsed, setPreviewCollapsed] = useState(false);
  const esRef = useRef<EventSource | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Compute metrics from steps
  const pipelineSteps = steps.filter((s) => s.step !== 'pipeline' && s.step !== 'files-collected');
  const completedCount = pipelineSteps.filter((s) => s.status === 'done').length;
  const totalSteps = pipelineSteps.length;
  const currentStep = pipelineSteps.find((s) => s.status === 'running');
  const totalElapsed = steps.reduce((max, s) => Math.max(max, s.elapsed_ms), 0);

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

      // Capture file count from files-collected event
      if (event.step === 'files-collected' && event.files && event.files.length > 0) {
        setFileCount(event.files.length);
        onFilesReady?.();
        return;
      }

      // Notify parent of step updates (for chat code snippets)
      onStepUpdate?.(event);

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
        setPreviewCollapsed(false); // auto-expand on deploy
        onDeployed?.(event.detail);
      }

      // Terminal state
      if (event.step === 'pipeline' && (event.status === 'done' || event.status === 'error')) {
        setDone(true);
        if (event.status === 'error') setFailed(true);
        es.close();
        checkFiles();
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

  async function checkFiles() {
    try {
      const res = await fetch(`/api/builds/${buildId}/files`);
      if (res.ok) {
        const data = (await res.json()) as { files: Array<{ path: string; content: string }> };
        if (data.files.length > 0) {
          setFileCount(data.files.length);
          onFilesReady?.();
        }
      }
    } catch {
      // Non-critical
    }
  }

  function startPolling() {
    if (pollRef.current) return;
    checkFiles();

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
            setPreviewCollapsed(false);
            onDeployed?.(data.deployedUrl);
          }
          checkFiles();
        }
      } catch {
        // retry
      }
    }, 3000);
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
        background: '#fafafa',
        color: '#a3a3a3',
        fontSize: '0.8125rem',
        gap: '0.5rem',
      }}>
        <Spinner /> Connecting to build…
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#ffffff' }}>
      {/* ── TOP: Live Preview (collapsible) ───────────── */}
      <div
        style={{
          flex: previewCollapsed ? '0 0 auto' : 1,
          display: 'flex',
          flexDirection: 'column',
          borderBottom: '1px solid #e5e5e5',
          minHeight: 0,
          overflow: 'hidden',
        }}
      >
        {/* Preview header with collapse toggle */}
        <div
          onClick={() => setPreviewCollapsed(!previewCollapsed)}
          style={{
            padding: '0.5rem 0.75rem',
            borderBottom: previewCollapsed ? 'none' : '1px solid #e5e5e5',
            fontSize: '0.6875rem',
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            color: '#737373',
            background: '#f5f5f5',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            userSelect: 'none',
            flexShrink: 0,
          }}
        >
          <span>Live Preview</span>
          <span style={{ fontSize: '0.625rem', transition: 'transform 0.2s', transform: previewCollapsed ? 'rotate(-90deg)' : 'rotate(0)' }}>
            ▼
          </span>
        </div>

        {!previewCollapsed && (
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
        )}
      </div>

      {/* ── BOTTOM: Agent Status Panel ────────────────── */}
      <div
        style={{
          padding: '0.75rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.5rem',
          background: '#ffffff',
          minHeight: previewCollapsed ? 0 : 180,
          flexShrink: 0,
          flex: previewCollapsed ? 1 : undefined,
          overflow: previewCollapsed ? 'auto' : undefined,
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
          value={fileCount > 0 ? `${fileCount} files` : '—'}
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

        {/* View Code link */}
        {fileCount > 0 && (
          <a
            href={`/build/${buildId}/code`}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.375rem',
              padding: '0.5rem 0.75rem',
              background: '#f5f5f5',
              border: '1px solid #e5e5e5',
              borderRadius: '0.5rem',
              color: '#0a0a0a',
              fontSize: '0.8125rem',
              fontWeight: 500,
              textDecoration: 'none',
              cursor: 'pointer',
              marginTop: '0.25rem',
              transition: 'background 0.15s',
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="16 18 22 12 16 6" />
              <polyline points="8 6 2 12 8 18" />
            </svg>
            View Code
          </a>
        )}

        {/* Step log (visible when preview is collapsed) */}
        {previewCollapsed && pipelineSteps.length > 0 && (
          <div style={{ marginTop: '0.5rem', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <div style={{
              fontSize: '0.6875rem',
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              color: '#a3a3a3',
              marginBottom: '0.25rem',
            }}>
              Pipeline Steps
            </div>
            {pipelineSteps.map((s) => (
              <div key={s.step} style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', fontSize: '0.75rem' }}>
                <span style={{
                  width: 6,
                  height: 6,
                  borderRadius: '50%',
                  background: s.status === 'done' ? '#16a34a' : s.status === 'error' ? '#dc2626' : s.status === 'running' ? '#eab308' : '#a3a3a3',
                  flexShrink: 0,
                }} />
                <span style={{ color: '#525252', flex: 1 }}>{getStepVerb(s.step).replace('…', '')}</span>
                <span style={{ color: '#a3a3a3', fontSize: '0.6875rem' }}>{(s.elapsed_ms / 1000).toFixed(0)}s</span>
              </div>
            ))}
          </div>
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

        {/* Status indicator */}
        <div
          style={{
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
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Sub-components                                                     */
/* ------------------------------------------------------------------ */

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

export const STEP_VERBS: Record<string, string> = {
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
