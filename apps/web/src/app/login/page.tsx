/**
 * /login — Sign-in page with GitHub OAuth and admin credentials.
 *
 * Two sign-in methods:
 *   1. "Sign in with GitHub" — redirects to /api/auth/signin/github
 *   2. Admin credentials — email + password form → POST /api/auth/admin-login
 *
 * After sign-in, redirects to /dashboard (or callbackUrl if present).
 *
 * If the admin's `mustChangePassword` is true, shows the password
 * change form before redirecting.
 */
'use client';

import { useState } from 'react';
import { useSearchParams } from 'next/navigation';

export default function LoginPage() {
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get('callbackUrl') ?? '/dashboard';

  const [showAdmin, setShowAdmin] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Change password state
  const [mustChange, setMustChange] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  async function handleAdminLogin(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch('/api/auth/admin-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = (await res.json()) as {
        user?: { id: string; role: string };
        mustChangePassword?: boolean;
        error?: string;
      };

      if (!res.ok) {
        setError(data.error ?? 'Login failed');
        return;
      }

      if (data.mustChangePassword) {
        setMustChange(true);
        return;
      }

      window.location.href = callbackUrl;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setLoading(false);
    }
  }

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (newPassword.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword: password, newPassword }),
      });

      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? 'Failed to change password');
        return;
      }

      window.location.href = callbackUrl;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed');
    } finally {
      setLoading(false);
    }
  }

  const s = styles;

  return (
    <div style={s.container}>
      <div style={s.card}>
        <div style={s.logo}>NoSoftware</div>
        <p style={s.subtitle}>AI App Builder Platform</p>

        {mustChange ? (
          /* ── Change password form ── */
          <form onSubmit={handleChangePassword} style={s.form}>
            <div style={s.warning}>
              ⚠ You must change your password before continuing.
            </div>
            <input
              type="password" value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="New password (min 8 chars)"
              required minLength={8} style={s.input}
            />
            <input
              type="password" value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Confirm new password"
              required minLength={8} style={s.input}
            />
            {error && <div style={s.error}>{error}</div>}
            <button type="submit" disabled={loading} style={s.primaryBtn}>
              {loading ? 'Changing…' : 'Change Password & Continue'}
            </button>
          </form>
        ) : showAdmin ? (
          /* ── Admin credentials form ── */
          <form onSubmit={handleAdminLogin} style={s.form}>
            <input
              type="email" value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email" required style={s.input}
            />
            <input
              type="password" value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password" required style={s.input}
            />
            {error && <div style={s.error}>{error}</div>}
            <button type="submit" disabled={loading} style={s.primaryBtn}>
              {loading ? 'Signing in…' : 'Sign in'}
            </button>
            <button type="button" onClick={() => setShowAdmin(false)} style={s.linkBtn}>
              ← Back to sign-in options
            </button>
          </form>
        ) : (
          /* ── Sign-in options ── */
          <div style={s.form}>
            <a href={`/api/auth/signin/github?callbackUrl=${encodeURIComponent(callbackUrl)}`} style={s.githubBtn}>
              <GithubIcon />
              Sign in with GitHub
            </a>
            <div style={s.divider}>
              <span style={s.dividerLine} />
              <span style={s.dividerText}>or</span>
              <span style={s.dividerLine} />
            </div>
            <button onClick={() => setShowAdmin(true)} style={s.secondaryBtn}>
              Sign in with email
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function GithubIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 16 16" fill="currentColor">
      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
    </svg>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    minHeight: 'calc(100vh - 5rem)',
  },
  card: {
    width: '100%', maxWidth: 400, padding: '2.5rem 2rem',
    textAlign: 'center',
  },
  logo: {
    fontSize: '1.5rem', fontWeight: 700, letterSpacing: '-0.03em',
    color: '#0a0a0a', marginBottom: '0.25rem',
  },
  subtitle: {
    fontSize: '0.875rem', color: '#737373', margin: '0 0 2rem',
  },
  form: {
    display: 'flex', flexDirection: 'column', gap: '0.75rem',
  },
  input: {
    width: '100%', padding: '0.625rem 0.75rem', fontSize: '0.875rem',
    border: '1px solid #e5e5e5', borderRadius: '0.5rem', outline: 'none',
    boxSizing: 'border-box',
    fontFamily: 'inherit',
  },
  primaryBtn: {
    padding: '0.625rem', fontSize: '0.875rem', fontWeight: 600,
    background: '#0a0a0a', color: '#ffffff', border: 'none',
    borderRadius: '0.5rem', cursor: 'pointer',
    fontFamily: 'inherit',
  },
  secondaryBtn: {
    padding: '0.625rem', fontSize: '0.875rem', fontWeight: 500,
    background: 'transparent', color: '#525252',
    border: '1px solid #e5e5e5', borderRadius: '0.5rem', cursor: 'pointer',
    fontFamily: 'inherit',
  },
  githubBtn: {
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    gap: '0.5rem', padding: '0.625rem', fontSize: '0.875rem', fontWeight: 600,
    background: '#24292f', color: '#ffffff', border: 'none',
    borderRadius: '0.5rem', cursor: 'pointer', textDecoration: 'none',
    fontFamily: 'inherit',
  },
  linkBtn: {
    background: 'none', border: 'none', color: '#737373',
    fontSize: '0.8125rem', cursor: 'pointer', fontFamily: 'inherit',
  },
  divider: {
    display: 'flex', alignItems: 'center', gap: '0.75rem',
    margin: '0.25rem 0',
  },
  dividerLine: {
    flex: 1, height: 1, background: '#e5e5e5',
  },
  dividerText: {
    fontSize: '0.75rem', color: '#a3a3a3', textTransform: 'uppercase',
    letterSpacing: '0.05em',
  },
  error: {
    fontSize: '0.8125rem', color: '#dc2626', background: '#fef2f2',
    padding: '0.5rem 0.75rem', borderRadius: '0.375rem',
    textAlign: 'left',
  },
  warning: {
    fontSize: '0.8125rem', color: '#92400e', background: '#fffbeb',
    padding: '0.625rem 0.75rem', borderRadius: '0.375rem',
    border: '1px solid #fde68a',
  },
};
