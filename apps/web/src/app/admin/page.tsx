/**
 * /admin — Admin dashboard for platform management.
 *
 * Features:
 *   - System metrics (total users, builds, credits issued/spent)
 *   - User management table with search, credit adjustment
 *   - Platform configuration panel (creditsPerUSD, minCreditsForBuild, feeMultiplier)
 *   - CSV export of user list
 */
'use client';

import { useEffect, useState, useCallback, useRef } from 'react';

// ── Types ──

interface Stats {
  totalUsers: number;
  totalBuilds: number;
  totalCreditsIssued: number;
  totalCreditsSpent: number;
}

interface AdminUser {
  id: string;
  email: string;
  name: string | null;
  image: string | null;
  role: string;
  credits: string;
  status: string;
  createdAt: string;
}

interface Config {
  creditsPerUSD: number;
  minCreditsForBuild: number;
  platformFeeMultiplier: number;
}

// ── Component ──

export default function AdminPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [totalUsers, setTotalUsers] = useState(0);
  const [config, setConfig] = useState<Config | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);

  // Credit adjustment modal
  const [adjustUser, setAdjustUser] = useState<AdminUser | null>(null);
  const [adjustAmount, setAdjustAmount] = useState('');
  const [adjustReason, setAdjustReason] = useState('');
  const [adjusting, setAdjusting] = useState(false);
  const [adjustError, setAdjustError] = useState<string | null>(null);

  // Config editing
  const [editConfig, setEditConfig] = useState<Config | null>(null);
  const [savingConfig, setSavingConfig] = useState(false);
  const [configMsg, setConfigMsg] = useState<string | null>(null);

  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const LIMIT = 20;

  const fetchUsers = useCallback(async (q: string, offset: number) => {
    try {
      const params = new URLSearchParams({ limit: String(LIMIT), offset: String(offset) });
      if (q) params.set('search', q);
      const res = await fetch(`/api/admin/users?${params}`);
      if (!res.ok) throw new Error('Failed to load users');
      const data = (await res.json()) as { users: AdminUser[]; total: number };
      setUsers(data.users);
      setTotalUsers(data.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed');
    }
  }, []);

  useEffect(() => {
    Promise.all([
      fetch('/api/admin/stats').then((r) => r.ok ? r.json() as Promise<Stats> : null),
      fetch('/api/admin/users?limit=20').then((r) => r.ok ? r.json() as Promise<{ users: AdminUser[]; total: number }> : null),
      fetch('/api/admin/config').then((r) => r.ok ? r.json() as Promise<Config> : null),
    ])
      .then(([statsData, usersData, configData]) => {
        if (statsData) setStats(statsData);
        if (usersData) {
          setUsers(usersData.users);
          setTotalUsers(usersData.total);
        }
        if (configData) {
          setConfig(configData);
          setEditConfig(configData);
        }
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed'))
      .finally(() => setLoading(false));
  }, []);

  // Debounced search
  function handleSearch(value: string) {
    setSearch(value);
    setPage(0);
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(() => fetchUsers(value, 0), 300);
  }

  function handlePage(newPage: number) {
    setPage(newPage);
    fetchUsers(search, newPage * LIMIT);
  }

  // Credit adjustment
  async function submitAdjustment() {
    if (!adjustUser) return;
    const amount = parseFloat(adjustAmount);
    if (isNaN(amount) || amount === 0) {
      setAdjustError('Enter a non-zero amount');
      return;
    }
    if (!adjustReason.trim()) {
      setAdjustError('Reason is required');
      return;
    }

    setAdjusting(true);
    setAdjustError(null);
    try {
      const res = await fetch(`/api/admin/users/${adjustUser.id}/credits`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount, reason: adjustReason.trim() }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string; balanceAfter?: number };
      if (!res.ok) {
        setAdjustError(data.error ?? 'Failed');
        return;
      }
      // Update local state
      setUsers((prev) =>
        prev.map((u) =>
          u.id === adjustUser.id ? { ...u, credits: (data.balanceAfter ?? 0).toFixed(2) } : u,
        ),
      );
      setAdjustUser(null);
      setAdjustAmount('');
      setAdjustReason('');
      // Refresh stats
      fetch('/api/admin/stats')
        .then((r) => r.ok ? r.json() as Promise<Stats> : null)
        .then((s) => { if (s) setStats(s); });
    } catch (err) {
      setAdjustError(err instanceof Error ? err.message : 'Failed');
    } finally {
      setAdjusting(false);
    }
  }

  // Save config
  async function saveConfig() {
    if (!editConfig) return;
    setSavingConfig(true);
    setConfigMsg(null);
    try {
      const res = await fetch('/api/admin/config', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editConfig),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok) {
        setConfigMsg(`Error: ${data.error ?? 'Failed'}`);
        return;
      }
      setConfig(editConfig);
      setConfigMsg('Saved');
      setTimeout(() => setConfigMsg(null), 2000);
    } catch (err) {
      setConfigMsg(`Error: ${err instanceof Error ? err.message : 'Failed'}`);
    } finally {
      setSavingConfig(false);
    }
  }

  // CSV export
  function exportCSV() {
    const header = 'ID,Email,Name,Role,Credits,Status,Created\n';
    const rows = users
      .map(
        (u) =>
          `${u.id},${u.email},"${(u.name ?? '').replace(/"/g, '""')}",${u.role},${u.credits},${u.status},${u.createdAt}`,
      )
      .join('\n');
    const blob = new Blob([header + rows], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `nosoftware-users-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: '4rem', color: '#a3a3a3' }}>
        Loading admin dashboard…
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ textAlign: 'center', padding: '4rem', color: '#dc2626' }}>
        {error}
      </div>
    );
  }

  const totalPages = Math.ceil(totalUsers / LIMIT);

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
        <h1 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0, letterSpacing: '-0.02em' }}>
          Admin Dashboard
        </h1>
        <span style={{ fontSize: '0.75rem', color: '#a3a3a3' }}>
          nosoftware.app
        </span>
      </div>

      {/* ── System Metrics ── */}
      {stats && (
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.75rem', marginBottom: '1.5rem',
        }}>
          <MetricCard label="Total Users" value={stats.totalUsers} />
          <MetricCard label="Total Builds" value={stats.totalBuilds} />
          <MetricCard label="Credits Issued" value={stats.totalCreditsIssued.toFixed(0)} />
          <MetricCard label="Credits Spent" value={stats.totalCreditsSpent.toFixed(0)} />
        </div>
      )}

      {/* ── User Management ── */}
      <div style={{ marginBottom: '2rem' }}>
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem',
        }}>
          <h2 style={{ fontSize: '1rem', fontWeight: 600, margin: 0 }}>Users</h2>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <input
              type="text"
              placeholder="Search users…"
              value={search}
              onChange={(e) => handleSearch(e.target.value)}
              style={{
                padding: '0.375rem 0.625rem', fontSize: '0.8125rem',
                border: '1px solid #e5e5e5', borderRadius: '0.375rem', outline: 'none',
                width: 200, fontFamily: 'inherit',
              }}
            />
            <button onClick={exportCSV} style={btnSecondary}>
              ↓ CSV
            </button>
          </div>
        </div>

        <div style={{ border: '1px solid #e5e5e5', borderRadius: '0.75rem', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8125rem' }}>
            <thead>
              <tr style={{ background: '#f5f5f5', borderBottom: '1px solid #e5e5e5' }}>
                <th style={thStyle}>User</th>
                <th style={thStyle}>Role</th>
                <th style={{ ...thStyle, textAlign: 'right' }}>Credits</th>
                <th style={thStyle}>Status</th>
                <th style={thStyle}>Joined</th>
                <th style={{ ...thStyle, textAlign: 'center' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.length === 0 && (
                <tr>
                  <td colSpan={6} style={{ padding: '2rem', textAlign: 'center', color: '#a3a3a3' }}>
                    No users found.
                  </td>
                </tr>
              )}
              {users.map((u) => (
                <tr key={u.id} style={{ borderBottom: '1px solid #f0f0f0' }}>
                  <td style={tdStyle}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      {u.image ? (
                        <img
                          src={u.image} alt=""
                          style={{ width: 24, height: 24, borderRadius: '50%' }}
                        />
                      ) : (
                        <div style={{
                          width: 24, height: 24, borderRadius: '50%', background: '#e5e5e5',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: '0.625rem', fontWeight: 600, color: '#737373',
                        }}>
                          {(u.name ?? u.email)?.[0]?.toUpperCase() ?? '?'}
                        </div>
                      )}
                      <div>
                        <div style={{ fontWeight: 500, fontSize: '0.8125rem' }}>{u.name ?? '—'}</div>
                        <div style={{ fontSize: '0.6875rem', color: '#a3a3a3' }}>{u.email}</div>
                      </div>
                    </div>
                  </td>
                  <td style={tdStyle}>
                    <span style={{
                      fontSize: '0.6875rem', fontWeight: 600, padding: '0.1rem 0.375rem',
                      borderRadius: '0.25rem',
                      background: u.role === 'admin' ? '#eff6ff' : '#f5f5f5',
                      color: u.role === 'admin' ? '#1d4ed8' : '#737373',
                    }}>{u.role}</span>
                  </td>
                  <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 500, fontVariantNumeric: 'tabular-nums' }}>
                    {parseFloat(u.credits).toFixed(2)}
                  </td>
                  <td style={tdStyle}>
                    <span style={{
                      fontSize: '0.6875rem', fontWeight: 600, padding: '0.1rem 0.375rem',
                      borderRadius: '0.25rem',
                      ...statusBadge(u.status),
                    }}>{u.status}</span>
                  </td>
                  <td style={{ ...tdStyle, color: '#a3a3a3', fontSize: '0.75rem' }}>
                    {new Date(u.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </td>
                  <td style={{ ...tdStyle, textAlign: 'center' }}>
                    <button
                      onClick={() => {
                        setAdjustUser(u);
                        setAdjustAmount('');
                        setAdjustReason('');
                        setAdjustError(null);
                      }}
                      style={{
                        padding: '0.25rem 0.5rem', fontSize: '0.6875rem', fontWeight: 500,
                        background: 'transparent', border: '1px solid #e5e5e5',
                        borderRadius: '0.25rem', cursor: 'pointer', fontFamily: 'inherit',
                        color: '#525252',
                      }}
                    >
                      Adjust credits
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div style={{
            display: 'flex', justifyContent: 'center', gap: '0.5rem',
            marginTop: '0.75rem', fontSize: '0.8125rem',
          }}>
            <button
              disabled={page === 0}
              onClick={() => handlePage(page - 1)}
              style={{ ...btnSecondary, opacity: page === 0 ? 0.4 : 1 }}
            >
              ← Prev
            </button>
            <span style={{ padding: '0.375rem 0.5rem', color: '#737373' }}>
              Page {page + 1} of {totalPages}
            </span>
            <button
              disabled={page >= totalPages - 1}
              onClick={() => handlePage(page + 1)}
              style={{ ...btnSecondary, opacity: page >= totalPages - 1 ? 0.4 : 1 }}
            >
              Next →
            </button>
          </div>
        )}
      </div>

      {/* ── Platform Configuration ── */}
      {editConfig && (
        <div style={{
          padding: '1.25rem 1.5rem', background: '#fafafa', borderRadius: '0.75rem',
          border: '1px solid #e5e5e5', marginBottom: '2rem',
        }}>
          <h2 style={{ fontSize: '1rem', fontWeight: 600, margin: '0 0 1rem' }}>
            Platform Configuration
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem' }}>
            <ConfigField
              label="Credits per USD"
              value={editConfig.creditsPerUSD}
              onChange={(v) => setEditConfig({ ...editConfig, creditsPerUSD: v })}
              help="1 USD = N credits"
            />
            <ConfigField
              label="Min Credits for Build"
              value={editConfig.minCreditsForBuild}
              onChange={(v) => setEditConfig({ ...editConfig, minCreditsForBuild: v })}
              help="Minimum balance to start a build"
            />
            <ConfigField
              label="Platform Fee Multiplier"
              value={editConfig.platformFeeMultiplier}
              onChange={(v) => setEditConfig({ ...editConfig, platformFeeMultiplier: v })}
              help="1.33 = 33% markup over raw cost"
            />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginTop: '1rem' }}>
            <button onClick={saveConfig} disabled={savingConfig} style={btnPrimary}>
              {savingConfig ? 'Saving…' : 'Save Configuration'}
            </button>
            {configMsg && (
              <span style={{
                fontSize: '0.8125rem',
                color: configMsg.startsWith('Error') ? '#dc2626' : '#16a34a',
              }}>
                {configMsg}
              </span>
            )}
          </div>
        </div>
      )}

      {/* ── Credit Adjustment Modal ── */}
      {adjustUser && (
        <div
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 1000,
          }}
          onClick={() => setAdjustUser(null)}
        >
          <div
            style={{
              background: '#fff', borderRadius: '0.75rem', padding: '1.5rem',
              width: 400, maxWidth: '90vw',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ fontSize: '1rem', fontWeight: 600, margin: '0 0 0.25rem' }}>
              Adjust Credits
            </h3>
            <p style={{ fontSize: '0.8125rem', color: '#737373', margin: '0 0 1rem' }}>
              {adjustUser.name ?? adjustUser.email} — current balance: {parseFloat(adjustUser.credits).toFixed(2)}
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
              <input
                type="number"
                step="0.01"
                value={adjustAmount}
                onChange={(e) => setAdjustAmount(e.target.value)}
                placeholder="Amount (positive = add, negative = deduct)"
                style={inputStyle}
              />
              <input
                type="text"
                value={adjustReason}
                onChange={(e) => setAdjustReason(e.target.value)}
                placeholder="Reason (required)"
                style={inputStyle}
              />
              {adjustError && (
                <div style={{ fontSize: '0.8125rem', color: '#dc2626', background: '#fef2f2', padding: '0.375rem 0.625rem', borderRadius: '0.25rem' }}>
                  {adjustError}
                </div>
              )}
              <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.25rem' }}>
                <button onClick={submitAdjustment} disabled={adjusting} style={btnPrimary}>
                  {adjusting ? 'Processing…' : 'Apply'}
                </button>
                <button onClick={() => setAdjustUser(null)} style={btnSecondary}>
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Sub-components ──

function MetricCard({ label, value }: { label: string; value: number | string }) {
  return (
    <div style={{
      padding: '1rem 1.25rem', background: '#fafafa', borderRadius: '0.75rem',
      border: '1px solid #e5e5e5',
    }}>
      <div style={{
        fontSize: '0.6875rem', fontWeight: 600, textTransform: 'uppercase',
        letterSpacing: '0.05em', color: '#737373', marginBottom: '0.25rem',
      }}>
        {label}
      </div>
      <div style={{
        fontSize: '1.75rem', fontWeight: 700, letterSpacing: '-0.03em',
        fontVariantNumeric: 'tabular-nums',
      }}>
        {typeof value === 'number' ? value.toLocaleString() : value}
      </div>
    </div>
  );
}

function ConfigField({
  label, value, onChange, help,
}: {
  label: string; value: number; onChange: (v: number) => void; help: string;
}) {
  return (
    <div>
      <label style={{ fontSize: '0.75rem', fontWeight: 600, color: '#525252', display: 'block', marginBottom: '0.25rem' }}>
        {label}
      </label>
      <input
        type="number"
        step="0.01"
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
        style={{
          width: '100%', padding: '0.5rem 0.625rem', fontSize: '0.875rem',
          border: '1px solid #d4d4d4', borderRadius: '0.375rem', outline: 'none',
          fontFamily: 'inherit', boxSizing: 'border-box',
          fontVariantNumeric: 'tabular-nums',
        }}
      />
      <div style={{ fontSize: '0.6875rem', color: '#a3a3a3', marginTop: '0.25rem' }}>
        {help}
      </div>
    </div>
  );
}

// ── Styles ──

const thStyle: React.CSSProperties = {
  padding: '0.5rem 0.75rem', textAlign: 'left', fontWeight: 600,
  fontSize: '0.6875rem', textTransform: 'uppercase', letterSpacing: '0.05em',
  color: '#737373',
};

const tdStyle: React.CSSProperties = {
  padding: '0.5rem 0.75rem',
};

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '0.5rem 0.625rem', fontSize: '0.875rem',
  border: '1px solid #e5e5e5', borderRadius: '0.375rem', outline: 'none',
  fontFamily: 'inherit', boxSizing: 'border-box',
};

const btnPrimary: React.CSSProperties = {
  padding: '0.5rem 1rem', fontSize: '0.8125rem', fontWeight: 600,
  background: '#0a0a0a', color: '#fff', border: 'none',
  borderRadius: '0.375rem', cursor: 'pointer', fontFamily: 'inherit',
};

const btnSecondary: React.CSSProperties = {
  padding: '0.375rem 0.75rem', fontSize: '0.8125rem', fontWeight: 500,
  background: 'transparent', color: '#525252',
  border: '1px solid #e5e5e5', borderRadius: '0.375rem', cursor: 'pointer',
  fontFamily: 'inherit',
};

function statusBadge(status: string): React.CSSProperties {
  switch (status) {
    case 'active': return { background: '#dcfce7', color: '#166534' };
    case 'suspended': return { background: '#fef2f2', color: '#dc2626' };
    case 'invited': return { background: '#eff6ff', color: '#1d4ed8' };
    default: return { background: '#f5f5f5', color: '#737373' };
  }
}
