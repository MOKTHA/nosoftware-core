/**
 * /build — Prompt-driven build page.
 *
 * UI modeled on vercel-labs/coding-agent-template:
 *   - "Hey NXT, build anything" hero prompt
 *   - "+ Start Building" and "View Projects" CTA buttons
 *   - Centered rounded prompt form with textarea + circular submit
 *   - Conversational thread with sticky user cards
 *   - Split panel during build (trace left, preview right)
 */
'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';

/* ------------------------------------------------------------------ */
/*  Types                                                             */
/* ------------------------------------------------------------------ */

interface QuestionOption {
  label: string;
  description: string;
}

interface ClarifyingQuestion {
  id: string;
  question: string;
  options: QuestionOption[];
}

interface AnalysisResult {
  score: number;
  message: string;
  questions: ClarifyingQuestion[];
  readyToBuild: boolean;
  appName: string;
}

interface Message {
  role: 'user' | 'assistant';
  content: string;
  analysis?: AnalysisResult;
}

/* ------------------------------------------------------------------ */
/*  Rotating words for hero                                           */
/* ------------------------------------------------------------------ */

/* ------------------------------------------------------------------ */
/*  Component                                                         */
/* ------------------------------------------------------------------ */

export default function BuildPage() {
  const router = useRouter();
  const [messages, setMessages] = useState<Message[]>([]);
  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [answers, setAnswers] = useState<Array<{ question: string; answer: string }>>([]);
  const [selectedOptions, setSelectedOptions] = useState<Record<string, string>>({});
  const [customInputs, setCustomInputs] = useState<Record<string, string>>({});

  // Build state
  const [buildLoading, setBuildLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const threadRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    threadRef.current?.scrollTo({ top: threadRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, analysis]);

  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  /* ---------------------------------------------------------------- */
  /*  Submit initial prompt                                           */
  /* ---------------------------------------------------------------- */

  async function handleSubmitPrompt() {
    if (!prompt.trim() || loading) return;

    const userMsg = prompt.trim();
    setPrompt('');
    setMessages((prev) => [...prev, { role: 'user', content: userMsg }]);
    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/prompt/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: userMsg, answers }),
      });

      if (!res.ok) {
        const body = await res.text();
        throw new Error(body);
      }

      const result = (await res.json()) as AnalysisResult;
      setAnalysis(result);
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: result.message, analysis: result },
      ]);
      setSelectedOptions({});
      setCustomInputs({});
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  /* ---------------------------------------------------------------- */
  /*  Submit answers to clarifying questions                          */
  /* ---------------------------------------------------------------- */

  async function handleSubmitAnswers() {
    if (!analysis || loading) return;

    const newAnswers: Array<{ question: string; answer: string }> = [];
    for (const q of analysis.questions) {
      const selected = selectedOptions[q.id];
      const custom = customInputs[q.id]?.trim();
      const answer = custom || selected;
      if (answer) {
        newAnswers.push({ question: q.question, answer });
      }
    }

    if (newAnswers.length === 0) return;

    const allAnswers = [...answers, ...newAnswers];
    setAnswers(allAnswers);

    const answerText = newAnswers.map((a) => a.answer).join(', ');
    setMessages((prev) => [...prev, { role: 'user', content: answerText }]);
    setLoading(true);

    try {
      const originalPrompt = messages.find((m) => m.role === 'user')?.content ?? '';

      const res = await fetch('/api/prompt/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: originalPrompt, answers: allAnswers }),
      });

      if (!res.ok) throw new Error(await res.text());

      const result = (await res.json()) as AnalysisResult;
      setAnalysis(result);
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: result.message, analysis: result },
      ]);
      setSelectedOptions({});
      setCustomInputs({});
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  /* ---------------------------------------------------------------- */
  /*  Start build                                                     */
  /* ---------------------------------------------------------------- */

  async function handleStartBuild() {
    if (buildLoading) return;
    setBuildLoading(true);
    setError(null);

    try {
      const originalPrompt = messages.find((m) => m.role === 'user')?.content ?? '';
      const fullPrompt = answers.length
        ? `${originalPrompt}\n\nAdditional details:\n${answers.map((a) => `- ${a.question}: ${a.answer}`).join('\n')}`
        : originalPrompt;

      const res = await fetch('/api/builds', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: fullPrompt,
          appName: analysis?.appName ?? 'My App',
        }),
      });

      if (!res.ok) throw new Error(await res.text());

      const { buildId } = (await res.json()) as { buildId: string };
      // Navigate to the persistent build URL
      router.push(`/build/${buildId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setBuildLoading(false);
    }
  }

  /* ---------------------------------------------------------------- */
  /*  Keyboard handler                                                */
  /* ---------------------------------------------------------------- */

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSubmitPrompt();
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [prompt, loading],
  );

  /* ---------------------------------------------------------------- */
  /*  Render                                                          */
  /* ---------------------------------------------------------------- */

  const showPromptInput = !buildLoading;
  const showBuildButton = analysis?.readyToBuild && !buildLoading;
  const showQuestions =
    analysis && !analysis.readyToBuild && !buildLoading && analysis.questions.length > 0;
  const isInitial = messages.length === 0;

  /* ── Full-screen transition when build is starting ── */
  if (buildLoading) {
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          height: 'calc(100vh - 5rem)',
          gap: '1.25rem',
          fontFamily:
            'system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", sans-serif',
          animation: 'fadeIn 0.3s ease-out',
        }}
      >
        {/* Animated rings */}
        <div style={{ position: 'relative', width: 64, height: 64 }}>
          <span
            style={{
              position: 'absolute',
              inset: 0,
              border: '2px solid #e5e5e5',
              borderTopColor: '#0a0a0a',
              borderRadius: '50%',
              animation: 'spin 0.8s linear infinite',
            }}
          />
          <span
            style={{
              position: 'absolute',
              inset: 8,
              border: '2px solid #e5e5e5',
              borderBottomColor: '#0a0a0a',
              borderRadius: '50%',
              animation: 'spin 1.2s linear infinite reverse',
            }}
          />
          <span
            style={{
              position: 'absolute',
              inset: 16,
              border: '2px solid #e5e5e5',
              borderTopColor: '#0a0a0a',
              borderRadius: '50%',
              animation: 'spin 1.6s linear infinite',
            }}
          />
        </div>
        <div style={{ textAlign: 'center' }}>
          <p
            style={{
              fontSize: '1.125rem',
              fontWeight: 600,
              color: '#0a0a0a',
              margin: '0 0 0.375rem',
            }}
          >
            Creating &ldquo;{analysis?.appName ?? 'your app'}&rdquo;
          </p>
          <p style={{ fontSize: '0.8125rem', color: '#737373', margin: 0 }}>
            Setting up the build pipeline…
          </p>
        </div>
        {error && (
          <p style={{ color: '#dc2626', fontSize: '0.8125rem', marginTop: '0.5rem' }}>
            {error}
          </p>
        )}
      </div>
    );
  }

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
      {/* ── Conversation panel ─────────────────────────────── */}
      <div
        style={{
          flex: '1',
          display: 'flex',
          flexDirection: 'column',
          maxWidth: '780px',
          margin: '0 auto',
          padding: '0 1rem',
        }}
      >
        {/* ── Hero (initial state — matches coding-agent-template) ── */}
        {isInitial && (
          <div
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              paddingBottom: '2rem',
            }}
          >
            {/* Title */}
            <h1
              style={{
                fontSize: '2.25rem',
                fontWeight: 500,
                letterSpacing: '-0.02em',
                color: '#0a0a0a',
                textAlign: 'center',
                margin: '0 0 2.5rem',
                lineHeight: 1.3,
              }}
            >
              What do you want to Build?
            </h1>

            {/* CTA buttons */}
            <div
              style={{
                display: 'flex',
                gap: '0.75rem',
                marginBottom: '2.5rem',
              }}
            >
              <button
                onClick={() => textareaRef.current?.focus()}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  padding: '0.625rem 1.25rem',
                  background: '#0a0a0a',
                  color: '#fafafa',
                  border: 'none',
                  borderRadius: '0.5rem',
                  fontSize: '0.875rem',
                  fontWeight: 500,
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                }}
              >
                <span style={{ fontSize: '1rem' }}>+</span>
                Start Building
                <span style={{ fontSize: '0.875rem' }}>→</span>
              </button>
              <a
                href="/projects"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  padding: '0.625rem 1.25rem',
                  background: '#ffffff',
                  color: '#0a0a0a',
                  border: '1px solid #e5e5e5',
                  borderRadius: '0.5rem',
                  fontSize: '0.875rem',
                  fontWeight: 500,
                  cursor: 'pointer',
                  textDecoration: 'none',
                  fontFamily: 'inherit',
                }}
              >
                {/* Calendar/grid icon */}
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <rect x="3" y="3" width="7" height="7" />
                  <rect x="14" y="3" width="7" height="7" />
                  <rect x="3" y="14" width="7" height="7" />
                  <rect x="14" y="14" width="7" height="7" />
                </svg>
                View Projects
              </a>
            </div>
          </div>
        )}

        {/* ── Message thread ── */}
        {messages.length > 0 && (
          <div
            ref={threadRef}
            style={{
              flex: 1,
              overflowY: 'auto',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.375rem',
              paddingTop: '1rem',
              paddingBottom: '0.75rem',
            }}
          >
            {messages.map((msg, i) => (
              <div key={i}>
                {msg.role === 'user' ? (
                  /* ── User message (sticky card) ── */
                  <div
                    style={{
                      position: 'sticky',
                      top: 0,
                      zIndex: 10,
                      background: '#ffffff',
                      border: '1px solid #e5e5e5',
                      borderRadius: '0.75rem',
                      padding: '0.75rem 1rem',
                      fontSize: '0.875rem',
                      lineHeight: 1.7,
                      color: '#0a0a0a',
                      boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
                    }}
                  >
                    {msg.content}
                  </div>
                ) : (
                  /* ── Assistant message ── */
                  <div
                    style={{
                      padding: '0.75rem 1rem',
                      fontSize: '0.875rem',
                      lineHeight: 1.7,
                      color: '#525252',
                    }}
                  >
                    {msg.analysis && (
                      <div
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.5rem',
                          marginBottom: '0.5rem',
                        }}
                      >
                        <span
                          style={{
                            fontSize: '0.75rem',
                            fontWeight: 600,
                            padding: '0.125rem 0.625rem',
                            borderRadius: '9999px',
                            background:
                              msg.analysis.score >= 60 ? '#dcfce7' : '#fef3c7',
                            color:
                              msg.analysis.score >= 60 ? '#166534' : '#92400e',
                          }}
                        >
                          {msg.analysis.score}%
                          {msg.analysis.score >= 60 ? ' Ready' : ''}
                        </span>
                      </div>
                    )}
                    <div>{msg.content}</div>
                  </div>
                )}
              </div>
            ))}

            {loading && (
              <div
                style={{
                  padding: '0.75rem 1rem',
                  fontSize: '0.875rem',
                  color: '#a3a3a3',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                }}
              >
                <Spinner /> Analyzing…
              </div>
            )}
          </div>
        )}

        {/* ── Clarifying questions ── */}
        {showQuestions && (
          <div
            style={{
              background: '#ffffff',
              border: '1px solid #e5e5e5',
              borderRadius: '0.75rem',
              padding: '1rem',
              marginBottom: '0.75rem',
            }}
          >
            {analysis!.questions.map((q) => (
              <div key={q.id} style={{ marginBottom: '1rem' }}>
                <p
                  style={{
                    fontWeight: 500,
                    fontSize: '0.875rem',
                    margin: '0 0 0.5rem',
                    color: '#0a0a0a',
                  }}
                >
                  {q.question}
                </p>
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.375rem',
                  }}
                >
                  {q.options.map((opt) => {
                    const isSelected = selectedOptions[q.id] === opt.label;
                    return (
                      <label
                        key={opt.label}
                        style={{
                          display: 'flex',
                          alignItems: 'flex-start',
                          gap: '0.5rem',
                          padding: '0.5rem 0.75rem',
                          borderRadius: '0.625rem',
                          cursor: 'pointer',
                          border: `1px solid ${isSelected ? '#0a0a0a' : '#e5e5e5'}`,
                          background: isSelected ? '#f5f5f5' : 'transparent',
                          transition: 'all 0.15s',
                        }}
                      >
                        <input
                          type="radio"
                          name={q.id}
                          checked={isSelected}
                          onChange={() => {
                            setSelectedOptions((prev) => ({
                              ...prev,
                              [q.id]: opt.label,
                            }));
                            setCustomInputs((prev) => ({ ...prev, [q.id]: '' }));
                          }}
                          style={{ marginTop: '0.15rem', accentColor: '#0a0a0a' }}
                        />
                        <div>
                          <span
                            style={{
                              fontSize: '0.8125rem',
                              fontWeight: 500,
                              color: '#0a0a0a',
                            }}
                          >
                            {opt.label}
                          </span>
                          <span
                            style={{
                              fontSize: '0.75rem',
                              color: '#737373',
                              marginLeft: '0.5rem',
                            }}
                          >
                            {opt.description}
                          </span>
                        </div>
                      </label>
                    );
                  })}
                  <input
                    type="text"
                    placeholder="Other…"
                    value={customInputs[q.id] ?? ''}
                    onChange={(e) => {
                      setCustomInputs((prev) => ({
                        ...prev,
                        [q.id]: e.target.value,
                      }));
                      if (e.target.value) {
                        setSelectedOptions((prev) => ({ ...prev, [q.id]: '' }));
                      }
                    }}
                    style={{
                      padding: '0.5rem 0.75rem',
                      borderRadius: '0.625rem',
                      border: '1px solid #e5e5e5',
                      fontSize: '0.8125rem',
                      outline: 'none',
                      fontFamily: 'inherit',
                    }}
                  />
                </div>
              </div>
            ))}
            <button
              onClick={handleSubmitAnswers}
              disabled={loading}
              style={{
                padding: '0.5rem 1.25rem',
                background: '#0a0a0a',
                color: '#fafafa',
                border: 'none',
                borderRadius: '9999px',
                fontSize: '0.8125rem',
                fontWeight: 500,
                cursor: loading ? 'default' : 'pointer',
                opacity: loading ? 0.5 : 1,
                fontFamily: 'inherit',
              }}
            >
              Submit
            </button>
          </div>
        )}

        {/* ── Build button ── */}
        {showBuildButton && (
          <div style={{ marginBottom: '0.75rem', textAlign: 'center' }}>
            <button
              onClick={handleStartBuild}
              disabled={buildLoading}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.5rem',
                padding: '0.625rem 1.5rem',
                background: buildLoading ? '#a3a3a3' : '#0a0a0a',
                color: '#fafafa',
                border: 'none',
                borderRadius: '0.5rem',
                fontSize: '0.875rem',
                fontWeight: 500,
                cursor: buildLoading ? 'default' : 'pointer',
                fontFamily: 'inherit',
                letterSpacing: '-0.01em',
              }}
            >
              {buildLoading ? (
                <>
                  <Spinner /> Starting…
                </>
              ) : (
                <>
                  <span>+</span> Build &ldquo;{analysis?.appName}&rdquo; <span>→</span>
                </>
              )}
            </button>
          </div>
        )}

        {/* ── Prompt input (coding-agent-template style) ── */}
        {showPromptInput && (
          <div
            style={{
              border: '1px solid #e5e5e5',
              borderRadius: '1rem',
              boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
              overflow: 'hidden',
              background: 'rgba(245,245,245,0.3)',
              maxWidth: '672px',
              width: '100%',
              alignSelf: 'center',
            }}
          >
            <textarea
              ref={textareaRef}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Describe what you want the AI agent to do..."
              rows={2}
              style={{
                width: '100%',
                border: 'none',
                outline: 'none',
                resize: 'none',
                padding: '1rem 1rem 0.5rem',
                fontSize: '1rem',
                lineHeight: 1.6,
                fontFamily: 'inherit',
                background: 'transparent',
                color: '#0a0a0a',
                boxSizing: 'border-box',
              }}
            />
            {/* Bottom toolbar */}
            <div
              style={{
                padding: '0.5rem 1rem 0.75rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              {/* Left side — model info */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem',
                  fontSize: '0.8125rem',
                  color: '#737373',
                }}
              >
                {/* Claude icon (asterisk/spark) */}
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.375rem',
                    color: '#0a0a0a',
                    fontWeight: 500,
                  }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
                  </svg>
                  Claude
                </span>
                <span style={{ color: '#d4d4d4' }}>·</span>
                <span>Sonnet 4</span>
              </div>

              {/* Right side — action icons + submit */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                {/* Globe icon */}
                <button
                  type="button"
                  style={{
                    width: '2rem',
                    height: '2rem',
                    borderRadius: '9999px',
                    border: 'none',
                    background: 'transparent',
                    color: '#a3a3a3',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: 0,
                  }}
                  title="Web search"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="2" y1="12" x2="22" y2="12" />
                    <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
                  </svg>
                </button>
                {/* Settings icon */}
                <button
                  type="button"
                  style={{
                    width: '2rem',
                    height: '2rem',
                    borderRadius: '9999px',
                    border: 'none',
                    background: 'transparent',
                    color: '#a3a3a3',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: 0,
                  }}
                  title="Settings"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="3" />
                    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
                  </svg>
                </button>
                {/* Submit button */}
                <button
                  onClick={handleSubmitPrompt}
                  disabled={!prompt.trim() || loading}
                  aria-label="Submit"
                  style={{
                    width: '2rem',
                    height: '2rem',
                    borderRadius: '9999px',
                    border: 'none',
                    background:
                      !prompt.trim() || loading ? '#e5e5e5' : '#0a0a0a',
                    color: '#fafafa',
                    cursor: !prompt.trim() || loading ? 'default' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    transition: 'background 0.15s',
                    padding: 0,
                    marginLeft: '0.25rem',
                  }}
                >
                  {loading ? (
                    <Spinner />
                  ) : (
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <line x1="12" y1="19" x2="12" y2="5" />
                      <polyline points="5 12 12 5 19 12" />
                    </svg>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {error && (
          <p
            style={{
              color: '#dc2626',
              fontSize: '0.8125rem',
              marginTop: '0.5rem',
              textAlign: 'center',
            }}
          >
            {error}
          </p>
        )}
      </div>

    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Spinner                                                           */
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
