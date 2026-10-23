import type { FraudFlag } from '../types';

const COLORS: Record<FraudFlag['severity'], string> = {
  critical: '#dc2626',
  high:     '#ea580c',
  medium:   '#d97706',
  low:      '#16a34a',
};

const BG: Record<FraudFlag['severity'], string> = {
  critical: '#fef2f2',
  high:     '#fff7ed',
  medium:   '#fffbeb',
  low:      '#f0fdf4',
};

export function SeverityBadge({ severity }: { severity: string }) {
  const s = severity as FraudFlag['severity'];
  return (
    <span style={{
      display: 'inline-block',
      padding: '2px 8px',
      borderRadius: 12,
      fontSize: 11,
      fontWeight: 700,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
      color: COLORS[s] ?? '#374151',
      background: BG[s] ?? '#f3f4f6',
      border: `1px solid ${COLORS[s] ?? '#d1d5db'}`,
    }}>
      {severity}
    </span>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const MAP: Record<string, { bg: string; color: string }> = {
    flagged:            { bg: '#fef2f2', color: '#dc2626' },
    cleared:            { bg: '#f0fdf4', color: '#16a34a' },
    pending:            { bg: '#eff6ff', color: '#2563eb' },
    needs_review:       { bg: '#fefce8', color: '#ca8a04' },
    approved_for_audit: { bg: '#fff7ed', color: '#ea580c' },
    dismissed:          { bg: '#f0fdf4', color: '#16a34a' },
    closed:             { bg: '#f3f4f6', color: '#6b7280' },
  };
  const style = MAP[status] ?? { bg: '#f3f4f6', color: '#374151' };
  return (
    <span style={{
      display: 'inline-block',
      padding: '2px 10px',
      borderRadius: 12,
      fontSize: 11,
      fontWeight: 700,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
      color: style.color,
      background: style.bg,
      border: `1px solid ${style.color}`,
    }}>
      {status}
    </span>
  );
}

export function RiskScore({ score }: { score: number }) {
  const color = score >= 70 ? '#dc2626' : score >= 45 ? '#ea580c' : score >= 20 ? '#d97706' : '#16a34a';
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <div style={{
        width: 100, height: 8, background: '#e5e7eb', borderRadius: 4, overflow: 'hidden',
      }}>
        <div style={{ width: `${score}%`, height: '100%', background: color, borderRadius: 4, transition: 'width 0.3s' }} />
      </div>
      <span style={{ fontWeight: 700, color, fontSize: 13 }}>{score}</span>
    </div>
  );
}
