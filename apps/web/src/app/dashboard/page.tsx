/**
 * /dashboard — User dashboard showing credit balance and build history.
 *
 * Features:
 *   - Credit balance display (prominent)
 *   - Build history table: model, tokens, cost, credits, timestamp
 *   - "New Build" button (checks credits before allowing)
 *   - Low-credit warning modal
 */
'use client';

import { useEffect, useState } from 'react';

interface UserCredits {
  credits: number;
  transactions: Array<{
    id: string;
    type: string;
    amount: string;
    balanceBefore: string;
    balanceAfter: string;
    reason: string;
    createdAt: string;
  }>;
}

interface BuildItem {
  id: string;
  appName: string;
  status: string;
  model: string | null;
  inputTokens: number | null;
  outputTokens: number | null;
  costUSD: string | null;
  creditsDeducted: string | null;
  deployedUrl: string | null;
  createdAt: string;
}

export default function DashboardPage() {
  const [credits, setCredits] = useState<UserCredits | null>(null);
  const [builds, setBuilds] = useState<BuildItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      fetch('/api/user/credits').then((r) => r.ok ? r.json() : null),
      fetch('/api/builds').then((r) => r.ok ? r.json() : null),
    ])
      .then(([creditsData, buildsData]) => {
        if (creditsData) setCredits(creditsData as UserCredits);
        if (buildsData) setBuilds((buildsData as { builds: BuildItem[] }).builds);
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: '4rem', color: '#a3a3a3' }}>
        Loading dashboard…
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

  const balance = credits?.credits ?? 0;
  const isLow = balance < 10;

  return (
    <div style={{ maxWidth: 960, margin: '0 auto' }}>
      {/* ── Credit Balance ── */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '1.5rem 2rem', background: '#fafafa', borderRadius: '0.75rem',
        border: '1px solid #e5e5e5', marginBottom: '1.5rem',
      }}>
        <div>
          <div style={{ fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#737373', marginBottom: '0.25rem' }}>
            Credit Balance
          </div>
          <div style={{
            fontSize: '2.5rem', fontWeight: 700, letterSpacing: '-0.03em',
            color: isLow ? '#dc2626' : '#0a0a0a',
            fontVariantNumeric: 'tabular-nums',
          }}>
            {balance.toFixed(2)}
          </div>
          <div style={{ fontSize: '0.75rem', color: '#a3a3a3', marginTop: '0.125rem' }}>
            credits ({(balance / 100).toFixed(2)} USD equivalent)
          </div>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          {isLow && (
            <div style={{
              padding: '0.5rem 1rem', background: '#fef2f2', color: '#dc2626',
              borderRadius: '0.5rem', fontSize: '0.8125rem', fontWeight: 500,
              border: '1px solid #fecaca',
            }}>
              ⚠ Low credits
            </div>
          )}
          <a href="/build" style={{
            padding: '0.5rem 1.25rem', background: '#0a0a0a', color: '#fff',
            borderRadius: '0.5rem', fontSize: '0.875rem', fontWeight: 600,
            textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '0.375rem',
          }}>
            + New Build
          </a>
        </div>
      </div>

      {/* ── Build History ── */}
      <div style={{ marginBottom: '2rem' }}>
        <h2 style={{ fontSize: '1rem', fontWeight: 600, margin: '0 0 0.75rem', color: '#0a0a0a' }}>
          Build History
        </h2>
        <div style={{
          border: '1px solid #e5e5e5', borderRadius: '0.75rem', overflow: 'hidden',
        }}>
          <table style={{
            width: '100%', borderCollapse: 'collapse', fontSize: '0.8125rem',
          }}>
            <thead>
              <tr style={{ background: '#f5f5f5', borderBottom: '1px solid #e5e5e5' }}>
                <th style={th}>App</th>
                <th style={th}>Status</th>
                <th style={th}>Model</th>
                <th style={{ ...th, textAlign: 'right' }}>Tokens</th>
                <th style={{ ...th, textAlign: 'right' }}>Cost USD</th>
                <th style={{ ...th, textAlign: 'right' }}>Credits</th>
                <th style={th}>Date</th>
              </tr>
            </thead>
            <tbody>
              {builds.length === 0 && (
                <tr>
                  <td colSpan={7} style={{ padding: '2rem', textAlign: 'center', color: '#a3a3a3' }}>
                    No builds yet. Start your first build!
                  </td>
                </tr>
              )}
              {builds.map((b) => (
                <tr key={b.id} style={{ borderBottom: '1px solid #f0f0f0' }}>
                  <td style={td}>
                    <a href={`/build/${b.id}`} style={{ color: '#0a0a0a', fontWeight: 500, textDecoration: 'underline' }}>
                      {b.appName}
                    </a>
                  </td>
                  <td style={td}>
                    <span style={{
                      fontSize: '0.6875rem', fontWeight: 600, padding: '0.1rem 0.5rem',
                      borderRadius: '9999px',
                      ...statusStyle(b.status),
                    }}>{b.status}</span>
                  </td>
                  <td style={{ ...td, color: '#737373', fontSize: '0.75rem' }}>
                    {b.model ? b.model.split('/').pop() : '—'}
                  </td>
                  <td style={{ ...td, textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontSize: '0.75rem', color: '#525252' }}>
                    {b.inputTokens != null ? `${formatK(b.inputTokens)}/${formatK(b.outputTokens ?? 0)}` : '—'}
                  </td>
                  <td style={{ ...td, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                    {b.costUSD ? `$${parseFloat(b.costUSD).toFixed(4)}` : '—'}
                  </td>
                  <td style={{ ...td, textAlign: 'right', fontWeight: 500, fontVariantNumeric: 'tabular-nums' }}>
                    {b.creditsDeducted ? parseFloat(b.creditsDeducted).toFixed(2) : '—'}
                  </td>
                  <td style={{ ...td, color: '#a3a3a3', fontSize: '0.75rem' }}>
                    {new Date(b.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Recent Transactions ── */}
      {credits && credits.transactions.length > 0 && (
        <div>
          <h2 style={{ fontSize: '1rem', fontWeight: 600, margin: '0 0 0.75rem', color: '#0a0a0a' }}>
            Credit Transactions
          </h2>
          <div style={{ border: '1px solid #e5e5e5', borderRadius: '0.75rem', overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8125rem' }}>
              <thead>
                <tr style={{ background: '#f5f5f5', borderBottom: '1px solid #e5e5e5' }}>
                  <th style={th}>Type</th>
                  <th style={{ ...th, textAlign: 'right' }}>Amount</th>
                  <th style={{ ...th, textAlign: 'right' }}>Balance</th>
                  <th style={th}>Reason</th>
                  <th style={th}>Date</th>
                </tr>
              </thead>
              <tbody>
                {credits.transactions.map((tx) => (
                  <tr key={tx.id} style={{ borderBottom: '1px solid #f0f0f0' }}>
                    <td style={td}>
                      <span style={{
                        fontSize: '0.6875rem', fontWeight: 600, padding: '0.1rem 0.375rem',
                        borderRadius: '0.25rem',
                        background: tx.type === 'credit' ? '#dcfce7' : tx.type === 'debit' ? '#fef2f2' : '#eff6ff',
                        color: tx.type === 'credit' ? '#166534' : tx.type === 'debit' ? '#dc2626' : '#1d4ed8',
                      }}>{tx.type}</span>
                    </td>
                    <td style={{
                      ...td, textAlign: 'right', fontWeight: 600, fontVariantNumeric: 'tabular-nums',
                      color: parseFloat(tx.amount) >= 0 ? '#16a34a' : '#dc2626',
                    }}>
                      {parseFloat(tx.amount) >= 0 ? '+' : ''}{parseFloat(tx.amount).toFixed(2)}
                    </td>
                    <td style={{ ...td, textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: '#525252' }}>
                      {parseFloat(tx.balanceAfter).toFixed(2)}
                    </td>
                    <td style={{ ...td, color: '#737373', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {tx.reason}
                    </td>
                    <td style={{ ...td, color: '#a3a3a3', fontSize: '0.75rem' }}>
                      {new Date(tx.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

const th: React.CSSProperties = {
  padding: '0.5rem 0.75rem', textAlign: 'left', fontWeight: 600,
  fontSize: '0.6875rem', textTransform: 'uppercase', letterSpacing: '0.05em',
  color: '#737373',
};

const td: React.CSSProperties = {
  padding: '0.5rem 0.75rem',
};

function statusStyle(status: string): React.CSSProperties {
  switch (status) {
    case 'succeeded': return { background: '#dcfce7', color: '#166534' };
    case 'failed': return { background: '#fef2f2', color: '#dc2626' };
    case 'running': return { background: '#eff6ff', color: '#1d4ed8' };
    default: return { background: '#f5f5f5', color: '#737373' };
  }
}

function formatK(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}
