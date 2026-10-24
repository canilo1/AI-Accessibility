import { useEffect, useState } from 'react';
import { api } from '../api';
import type { DashboardData } from '../types';
import { SeverityBadge, StatusBadge } from '../components/Badges';

const card = {
  background: '#fff',
  borderRadius: 12,
  padding: '20px 24px',
  boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
  border: '1px solid #e5e7eb',
};

function StatCard({ label, value, color, sub }: { label: string; value: number | string; color?: string; sub?: string }) {
  return (
    <div style={{ ...card, flex: 1, minWidth: 140 }}>
      <div style={{ fontSize: 28, fontWeight: 800, color: color ?? '#111827' }}>{value}</div>
      <div style={{ fontSize: 13, color: '#6b7280', marginTop: 4 }}>{label}</div>
      {sub && <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

function MetricBar({ label, value, max = 100, color }: { label: string; value: number; max?: number; color: string }) {
  const pct = Math.min(100, (value / max) * 100);
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, fontSize: 13 }}>
        <span style={{ color: '#374151' }}>{label}</span>
        <span style={{ fontWeight: 700, color }}>{value}%</span>
      </div>
      <div style={{ height: 8, background: '#f3f4f6', borderRadius: 4, overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: 4, transition: 'width 0.4s' }} />
      </div>
    </div>
  );
}

export function Dashboard({ onViewReturn }: { onViewReturn: (id: number) => void }) {
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api.getDashboard().then(setData).catch((e) => setError(e.message));
  }, []);

  if (error) return <p style={{ color: '#dc2626' }}>Error: {error}</p>;
  if (!data) return <p style={{ color: '#6b7280' }}>Loading dashboard…</p>;

  const { stats, recent_flags, severity_distribution, top_rules, fairness_metrics: fm } = data;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <h2 style={{ margin: 0, fontSize: 22, fontWeight: 800 }}>Overview</h2>

      {/* Stats row */}
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
        <StatCard label="Taxpayers"       value={stats.total_taxpayers} />
        <StatCard label="Tax Returns"     value={stats.total_returns} />
        <StatCard label="Flagged for Review" value={stats.flagged_returns} color="#a43d32" />
        <StatCard label="No Rule Signals" value={stats.cleared_returns} color="#16a34a" sub="not a compliance finding" />
        <StatCard label="Pending"         value={stats.pending_returns}  color="#2563eb" />
        <StatCard label="High-Severity Signals" value={stats.high_risk_count} color="#ea580c" />
      </div>

      <section style={{ ...card, borderLeft: '4px solid #276b56' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12, flexWrap: 'wrap' }}>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 750 }}>Synthetic rule benchmark</h3>
          <span style={{ color: '#64736a', fontSize: 12 }}>{data.synthetic_benchmark.total_cases} test cases · 4 business categories</span>
        </div>
        <p style={{ margin: '8px 0 16px', color: '#52645a', fontSize: 13, lineHeight: 1.6 }}>
          {data.synthetic_benchmark.interpretation} These benchmark cases are separate from live taxpayer records.
        </p>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', minWidth: 700, borderCollapse: 'collapse', fontSize: 12 }}>
            <thead><tr style={{ borderBottom: '1px solid #dfe5df' }}>
              {['Business category', 'Clean cases flagged', 'Synthetic false-positive rate', 'Injected patterns detected', 'Synthetic detection rate'].map((heading) => <th key={heading} style={{ padding: '8px 10px', color: '#64736a', textAlign: 'left', fontWeight: 650 }}>{heading}</th>)}
            </tr></thead>
            <tbody>{data.synthetic_benchmark.business_types.map((result) => (
              <tr key={result.business_type} style={{ borderBottom: '1px solid #edf0ed' }}>
                <td style={{ padding: '10px', fontWeight: 650 }}>{result.business_type.replace('_', ' ')}</td>
                <td style={{ padding: '10px' }}>{result.clean_cases_flagged}/{result.clean_cases}</td>
                <td style={{ padding: '10px' }}>{result.synthetic_false_positive_rate}%</td>
                <td style={{ padding: '10px' }}>{result.injected_pattern_cases_detected}/{result.injected_pattern_cases}</td>
                <td style={{ padding: '10px' }}>{result.synthetic_detection_rate}%</td>
              </tr>
            ))}</tbody>
          </table>
        </div>
        <p style={{ margin: '12px 0 0', color: '#52645a', fontSize: 12, lineHeight: 1.6 }}>
          This small, hand-authored set checks rule behavior only. It is not a production false-positive or fairness evaluation and does not establish that injected patterns are fraud.
        </p>
      </section>

      <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
        {/* Severity distribution */}
        <div style={{ ...card, flex: 1, minWidth: 260 }}>
          <h3 style={{ margin: '0 0 16px', fontSize: 15, fontWeight: 700 }}>Review Signal Severity</h3>
          {severity_distribution.map((s) => (
            <div key={s.severity} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
              <div style={{ width: 80 }}><SeverityBadge severity={s.severity} /></div>
              <div style={{ flex: 1, height: 12, background: '#f3f4f6', borderRadius: 6, overflow: 'hidden' }}>
                <div style={{
                  height: '100%',
                  width: `${Math.min(100, s.count * 8)}%`,
                  background: s.severity === 'critical' ? '#dc2626' : s.severity === 'high' ? '#ea580c' : s.severity === 'medium' ? '#d97706' : '#16a34a',
                  borderRadius: 6,
                }} />
              </div>
              <span style={{ fontSize: 13, fontWeight: 700, minWidth: 24, textAlign: 'right' }}>{s.count}</span>
            </div>
          ))}
        </div>

        {/* Top triggered rules */}
        <div style={{ ...card, flex: 2, minWidth: 320 }}>
          <h3 style={{ margin: '0 0 16px', fontSize: 15, fontWeight: 700 }}>Most Triggered Rules</h3>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #e5e7eb' }}>
                <th style={{ textAlign: 'left', padding: '4px 8px', color: '#6b7280', fontWeight: 600 }}>Rule</th>
                <th style={{ textAlign: 'left', padding: '4px 8px', color: '#6b7280', fontWeight: 600 }}>Severity</th>
                <th style={{ textAlign: 'right', padding: '4px 8px', color: '#6b7280', fontWeight: 600 }}>Count</th>
              </tr>
            </thead>
            <tbody>
              {top_rules.map((r) => (
                <tr key={r.rule_code} style={{ borderBottom: '1px solid #f3f4f6' }}>
                  <td style={{ padding: '6px 8px' }}>
                    <div style={{ fontWeight: 600 }}>{r.rule_code}</div>
                    <div style={{ color: '#6b7280', fontSize: 12 }}>{r.description.slice(0, 65)}…</div>
                  </td>
                  <td style={{ padding: '6px 8px' }}><SeverityBadge severity={r.severity} /></td>
                  <td style={{ padding: '6px 8px', textAlign: 'right', fontWeight: 700 }}>{r.occurrences}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Responsible AI Panel ────────────────────────────────────────────── */}
      <div style={{ ...card, borderLeft: '4px solid #2563eb' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
          <span style={{ fontSize: 20 }}>🤖</span>
          <h3 style={{ margin: 0, fontSize: 15, fontWeight: 800, color: '#1d4ed8' }}>Responsible AI — Fairness & Oversight Metrics</h3>
        </div>
        <p style={{ margin: '0 0 20px', fontSize: 13, color: '#6b7280', lineHeight: 1.6 }}>
          Live flag and review outcomes are descriptive operational metrics, not proof of fairness or false-positive rates.
          A high appeal overturn or dismissal rate may warrant rule review; small counts can be unstable.
        </p>
        <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
          {/* Oversight rates */}
          <div style={{ flex: 1, minWidth: 220 }}>
            <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 12, color: '#374151' }}>Human Oversight</div>
            <MetricBar label="Cases reviewed by a human" value={fm.human_oversight_rate} color="#2563eb" />
            <MetricBar label="Investigator dismissal rate" value={fm.investigator_dismissal_rate} color="#16a34a" />
            <MetricBar label="Appeal overturn rate" value={fm.appeal_overturn_rate} color="#ea580c" />
          </div>

          {/* Flag rate by business type */}
          <div style={{ flex: 1, minWidth: 220 }}>
            <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 12, color: '#374151' }}>Observed Flag Rate by Business Type</div>
            {fm.flag_rate_by_type.map((t) => (
              <div key={t.business_type} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, fontSize: 13 }}>
                <div style={{ width: 120, color: '#374151' }}>{t.business_type.replace('_', ' ')}</div>
                <div style={{ flex: 1, height: 8, background: '#f3f4f6', borderRadius: 4, overflow: 'hidden' }}>
                  <div style={{ width: `${t.rate}%`, height: '100%', background: '#6366f1', borderRadius: 4 }} />
                </div>
                <div style={{ width: 60, textAlign: 'right', fontWeight: 600 }}>
                  {t.rate}% <span style={{ color: '#9ca3af', fontWeight: 400 }}>({t.flagged}/{t.total})</span>
                </div>
              </div>
            ))}
            {fm.flag_rate_by_type.every((t) => t.total > 0) && (() => {
              const rates = fm.flag_rate_by_type.map((t) => t.rate);
              const max = Math.max(...rates);
              const min = Math.min(...rates.filter((r) => r > 0));
              const spread = max - min;
              return spread > 30 ? (
                <div style={{ marginTop: 8, padding: '8px 12px', background: '#fffbeb', border: '1px solid #fcd34d', borderRadius: 6, fontSize: 12, color: '#92400e' }}>
                  ⚠️ Flag rates vary significantly across business types ({spread.toFixed(0)}pp spread). Consider reviewing rules for bias.
                </div>
              ) : null;
            })()}
            <p style={{ margin: '10px 0 0', color: '#6b7280', fontSize: 11, lineHeight: 1.5 }}>Business type is not a demographic proxy. This prototype has no demographic labels and cannot assess racial disparities.</p>
          </div>

          {/* Appeals summary */}
          <div style={{ flex: 1, minWidth: 200 }}>
            <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 12, color: '#374151' }}>Appeals Summary</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              {[
                { label: 'Submitted', value: fm.appeals_summary.submitted, color: '#2563eb' },
                { label: 'Pending',   value: fm.appeals_summary.pending,   color: '#d97706' },
                { label: 'Accepted',  value: fm.appeals_summary.accepted,  color: '#16a34a' },
                { label: 'Rejected',  value: fm.appeals_summary.rejected,  color: '#dc2626' },
              ].map((s) => (
                <div key={s.label} style={{ background: '#f9fafb', borderRadius: 8, padding: '10px 14px', border: '1px solid #e5e7eb' }}>
                  <div style={{ fontSize: 22, fontWeight: 800, color: s.color }}>{s.value}</div>
                  <div style={{ fontSize: 11, color: '#6b7280' }}>{s.label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div style={{ marginTop: 16, padding: '10px 14px', background: '#eff6ff', borderRadius: 8, fontSize: 12, color: '#1e40af', lineHeight: 1.7 }}>
          <strong>⚖️ Responsible AI Principles applied:</strong> All flagged returns require human review before action is taken.
          Taxpayers may submit an appeal. No automated enforcement occurs — investigators make every final decision.
          This system identifies patterns that <em>may</em> warrant review; it does not determine guilt.
        </div>
      </div>

      {/* Recent flagged returns */}
      <div style={card}>
        <h3 style={{ margin: '0 0 16px', fontSize: 15, fontWeight: 700 }}>Returns Awaiting Review</h3>
        {recent_flags.length === 0
          ? <p style={{ color: '#6b7280', margin: 0 }}>No returns currently flagged for review.</p>
          : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #e5e7eb' }}>
                  {['Taxpayer', 'TIN', 'Year', 'Status', 'Max Severity', 'Flags', ''].map((h) => (
                    <th key={h} style={{ textAlign: 'left', padding: '4px 8px', color: '#6b7280', fontWeight: 600 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {recent_flags.map((f) => (
                  <tr key={f.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                    <td style={{ padding: '6px 8px', fontWeight: 600 }}>{f.taxpayer_name}</td>
                    <td style={{ padding: '6px 8px', fontFamily: 'monospace', fontSize: 12 }}>{f.tin}</td>
                    <td style={{ padding: '6px 8px' }}>{f.tax_year}</td>
                    <td style={{ padding: '6px 8px' }}><StatusBadge status={f.status} /></td>
                    <td style={{ padding: '6px 8px' }}>{f.max_severity ? <SeverityBadge severity={f.max_severity} /> : '—'}</td>
                    <td style={{ padding: '6px 8px', fontWeight: 700, color: '#dc2626' }}>{f.flag_count}</td>
                    <td style={{ padding: '6px 8px' }}>
                      <button onClick={() => onViewReturn(f.id)}
                        style={{ fontSize: 12, padding: '3px 10px', borderRadius: 6, border: '1px solid #d1d5db', cursor: 'pointer', background: '#fff' }}>
                        View
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )
        }
      </div>
    </div>
  );
}
