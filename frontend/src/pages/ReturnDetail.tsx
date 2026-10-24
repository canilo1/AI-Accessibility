import { useEffect, useState } from 'react';
import { api } from '../api';
import type { TaxReturn, FraudAnalysisResult } from '../types';
import { SeverityBadge, StatusBadge, RiskScore } from '../components/Badges';

const card = {
  background: '#fff',
  borderRadius: 12,
  padding: '20px 24px',
  boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
  border: '1px solid #e5e7eb',
};

function Row({ label, value }: { label: string; value: string | number }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #f3f4f6' }}>
      <span style={{ color: '#6b7280', fontSize: 13 }}>{label}</span>
      <span style={{ fontWeight: 600, fontSize: 13 }}>{value}</span>
    </div>
  );
}

const SEVERITY_BORDER: Record<string, string> = {
  critical: '#fca5a5', high: '#fdba74', medium: '#fcd34d', low: '#86efac',
};
const SEVERITY_BG: Record<string, string> = {
  critical: '#fef2f2', high: '#fff7ed', medium: '#fffbeb', low: '#f0fdf4',
};

export function ReturnDetail({ returnId, onBack }: { returnId: number; onBack: () => void }) {
  const [data, setData]             = useState<TaxReturn | null>(null);
  const [analysis, setAnalysis]     = useState<FraudAnalysisResult | null>(null);
  const [analyzing, setAnalyzing]   = useState(false);
  const [investigator, setInvestigator] = useState('');
  const [actionNotes, setActionNotes]   = useState('');
  const [appealText, setAppealText]     = useState('');
  const [showAppealForm, setShowAppealForm] = useState(false);
  const [appealError, setAppealError]   = useState('');
  const [appealSuccess, setAppealSuccess] = useState('');
  const [error, setError]           = useState('');

  const load = async () => {
    try {
      const r = await api.getReturn(returnId);
      setData(r);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error');
    }
  };

  useEffect(() => { load(); }, [returnId]);

  const handleAnalyze = async () => {
    setAnalyzing(true);
    setAnalysis(null);
    try {
      const result = await api.analyzeReturn(returnId);
      setAnalysis(result);
      load();
    } finally {
      setAnalyzing(false);
    }
  };

  const handleAction = async (action: string) => {
    try {
      await api.actionReturn(returnId, action, investigator || 'Investigator', actionNotes);
      load();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error');
    }
  };

  const handleAppeal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!data || !appealText.trim()) return;
    setAppealError('');
    try {
      await api.createAppeal({ tax_return_id: returnId, taxpayer_id: data.taxpayer_id, statement: appealText });
      setAppealSuccess('Appeal submitted successfully. An investigator will review it.');
      setAppealText('');
      setShowAppealForm(false);
    } catch (err: unknown) {
      setAppealError(err instanceof Error ? err.message : 'Error submitting appeal');
    }
  };

  if (error) return <p style={{ color: '#dc2626' }}>Error: {error}</p>;
  if (!data) return <p style={{ color: '#6b7280' }}>Loading…</p>;

  const flags = analysis?.flags ?? data.flags ?? [];
  const riskScore = analysis?.risk_score ?? null;
  const riskLevel = analysis?.risk_level ?? null;
  const summary   = analysis?.summary ?? null;

  const canQueue    = data.status === 'flagged';
  const canApprove  = data.status === 'needs_review';
  const canDismiss  = data.status === 'needs_review' || data.status === 'flagged';
  const canClose    = data.status === 'approved_for_audit' || data.status === 'dismissed';
  const canAppeal   = ['flagged', 'needs_review', 'approved_for_audit'].includes(data.status);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <button onClick={onBack} style={{ padding: '6px 14px', borderRadius: 8, border: '1px solid #d1d5db', background: '#fff', cursor: 'pointer', fontSize: 13 }}>
          ← Back
        </button>
        <h2 style={{ margin: 0, fontSize: 22, fontWeight: 800 }}>
          Return #{data.id} — {data.taxpayer_name} ({data.tax_year})
        </h2>
        <StatusBadge status={data.status} />
      </div>

      {/* Responsible AI notice */}
      <div style={{ padding: '10px 16px', background: '#eff6ff', borderRadius: 8, border: '1px solid #bfdbfe', fontSize: 13, color: '#1e40af', lineHeight: 1.6 }}>
        <strong>⚖️ Important:</strong> This system flags patterns that <em>may</em> warrant review. It does not determine guilt or initiate action automatically.
        Every flagged return requires an investigator to review and approve before any action is taken. Taxpayers have the right to appeal.
      </div>

      <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
        {/* Financial details */}
        <div style={{ ...card, flex: 1, minWidth: 280 }}>
          <h3 style={{ margin: '0 0 12px', fontSize: 15, fontWeight: 700 }}>Financial Details</h3>
          <Row label="Taxpayer"             value={data.taxpayer_name ?? '—'} />
          <Row label="TIN"                  value={data.taxpayer_tin ?? '—'} />
          <Row label="Tax Year"             value={data.tax_year} />
          <Row label="Filing Date"          value={data.filing_date} />
          <Row label="Gross Income"         value={`$${data.gross_income.toLocaleString()}`} />
          <Row label="Declared Deductions"  value={`$${data.declared_deductions.toLocaleString()}`} />
          <Row label="Taxable Income"       value={`$${data.taxable_income.toLocaleString()}`} />
          <Row label="Tax Paid"             value={`$${data.tax_paid.toLocaleString()}`} />
          <Row label="Business Expenses"    value={`$${data.business_expenses.toLocaleString()}`} />
          <Row label="Charitable Donations" value={`$${data.charitable_donations.toLocaleString()}`} />
          <Row label="Dependents"           value={data.num_dependents} />
          <div style={{ marginTop: 14, paddingTop: 10, borderTop: '1px solid #e5e7eb' }}>
            <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 6 }}>Income source matching</div>
            {(data.third_party_income_records ?? []).length === 0 ? (
              <p style={{ margin: 0, color: '#6b7280', fontSize: 12 }}>No third-party records attached.</p>
            ) : (
              <>
                {(data.third_party_income_records ?? []).map((record, index) => (
                  <Row key={`${record.source_type}-${record.payer_name}-${index}`} label={`${record.source_type} · ${record.payer_name}`} value={`$${record.reported_income.toLocaleString()}`} />
                ))}
                <Row label="Total reported by sources" value={`$${(data.third_party_income_records ?? []).reduce((total, record) => total + record.reported_income, 0).toLocaleString()}`} />
              </>
            )}
          </div>
          {data.actioned_by && (
            <>
              <Row label="Last actioned by" value={data.actioned_by} />
              <Row label="Actioned at"      value={data.actioned_at?.slice(0, 10) ?? ''} />
            </>
          )}
          {data.notes && (
            <div style={{ marginTop: 12, padding: '8px 12px', background: '#f9fafb', borderRadius: 6, fontSize: 13, color: '#374151' }}>
              <strong>Notes:</strong> {data.notes}
            </div>
          )}
        </div>

        {/* Risk analysis & workflow */}
        <div style={{ ...card, flex: 1, minWidth: 280 }}>
          <h3 style={{ margin: '0 0 12px', fontSize: 15, fontWeight: 700 }}>Review Signals</h3>

          {riskScore !== null && (
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 13, color: '#6b7280', marginBottom: 6 }}>Rule score · not a probability</div>
              <RiskScore score={riskScore} />
              {riskLevel && <div style={{ marginTop: 6 }}><SeverityBadge severity={riskLevel} /></div>}
            </div>
          )}

          {summary && (
            <div style={{ marginBottom: 16, padding: '10px 14px', background: '#f9fafb', borderRadius: 8, fontSize: 13, color: '#374151', lineHeight: 1.7 }}>
              {summary}
            </div>
          )}

          {/* Analysis button */}
          <button onClick={handleAnalyze} disabled={analyzing}
            style={{ marginBottom: 16, padding: '7px 16px', borderRadius: 8, border: 'none', background: '#2563eb', color: '#fff', fontWeight: 700, cursor: 'pointer' }}>
            {analyzing ? 'Analyzing…' : '🔍 Run Analysis'}
          </button>

          {/* Investigator workflow */}
          {(canQueue || canApprove || canDismiss || canClose) && (
            <div style={{ borderTop: '1px solid #e5e7eb', paddingTop: 16, marginBottom: 16 }}>
              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10, color: '#374151' }}>👤 Investigator Actions</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 10 }}>
                <input value={investigator} onChange={(e) => setInvestigator(e.target.value)}
                  placeholder="Your name (required for audit trail)"
                  style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid #d1d5db', fontSize: 13 }} />
                <textarea value={actionNotes} onChange={(e) => setActionNotes(e.target.value)}
                  placeholder="Add notes (optional)…" rows={2}
                  style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid #d1d5db', fontSize: 13, resize: 'vertical' }} />
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {canQueue && (
                  <button onClick={() => handleAction('queue_review')}
                    style={{ padding: '6px 12px', borderRadius: 7, border: '1px solid #ca8a04', color: '#ca8a04', cursor: 'pointer', background: '#fefce8', fontWeight: 600, fontSize: 13 }}>
                    📋 Queue for Review
                  </button>
                )}
                {canApprove && (
                  <button onClick={() => handleAction('approve_audit')}
                    style={{ padding: '6px 12px', borderRadius: 7, border: '1px solid #ea580c', color: '#ea580c', cursor: 'pointer', background: '#fff7ed', fontWeight: 600, fontSize: 13 }}>
                    🔎 Approve for Audit
                  </button>
                )}
                {canDismiss && (
                  <button onClick={() => handleAction('dismiss')}
                    style={{ padding: '6px 12px', borderRadius: 7, border: '1px solid #16a34a', color: '#16a34a', cursor: 'pointer', background: '#f0fdf4', fontWeight: 600, fontSize: 13 }}>
                    ✔ Dismiss (No Action)
                  </button>
                )}
                {canClose && (
                  <button onClick={() => handleAction('close')}
                    style={{ padding: '6px 12px', borderRadius: 7, border: '1px solid #6b7280', color: '#6b7280', cursor: 'pointer', background: '#f3f4f6', fontWeight: 600, fontSize: 13 }}>
                    Close Case
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Flag list */}
          {flags.length === 0 ? (
            <p style={{ color: '#276b56', fontWeight: 600, margin: 0 }}>No configured review signals were triggered. This does not guarantee that the return is error-free or compliant.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {flags.map((flag, i) => (
                <div key={i} style={{
                  padding: 14,
                  borderRadius: 8,
                  border: `1px solid ${SEVERITY_BORDER[flag.severity] ?? '#e5e7eb'}`,
                  background: SEVERITY_BG[flag.severity] ?? '#f9fafb',
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                    <span style={{ fontWeight: 700, fontSize: 13 }}>{flag.rule_code}</span>
                    <SeverityBadge severity={flag.severity} />
                  </div>
                  <p style={{ margin: '0 0 6px', fontSize: 13, color: '#374151' }}><strong>Finding:</strong> {flag.description}</p>
                  {flag.plain_explanation && (
                    <p style={{ margin: 0, fontSize: 12, color: '#6b7280', lineHeight: 1.6, borderTop: '1px solid rgba(0,0,0,0.06)', paddingTop: 6 }}>
                      <strong>Plain-language explanation:</strong> {flag.plain_explanation}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Appeal section */}
      {canAppeal && (
        <div style={{ ...card, borderLeft: '4px solid #7c3aed' }}>
          <h3 style={{ margin: '0 0 8px', fontSize: 15, fontWeight: 700, color: '#7c3aed' }}>📩 Taxpayer Appeal</h3>
          <p style={{ margin: '0 0 12px', fontSize: 13, color: '#6b7280', lineHeight: 1.6 }}>
            If you believe this filing was flagged in error, you can submit a written explanation. An investigator will review your appeal before any action is taken.
          </p>
          {appealSuccess && <p style={{ color: '#16a34a', fontWeight: 600 }}>{appealSuccess}</p>}
          {!showAppealForm && !appealSuccess && (
            <button onClick={() => setShowAppealForm(true)}
              style={{ padding: '7px 16px', borderRadius: 8, border: '1px solid #7c3aed', color: '#7c3aed', cursor: 'pointer', background: '#f5f3ff', fontWeight: 600 }}>
              Submit an Appeal
            </button>
          )}
          {showAppealForm && (
            <form onSubmit={handleAppeal} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {appealError && <p style={{ color: '#dc2626', margin: 0 }}>{appealError}</p>}
              <textarea required value={appealText} onChange={(e) => setAppealText(e.target.value)}
                placeholder="Explain why you believe this filing is accurate. Include any supporting context, such as documentation or circumstances that explain the figures."
                rows={4} style={{ padding: '8px 12px', borderRadius: 6, border: '1px solid #d1d5db', fontSize: 13, resize: 'vertical' }} />
              <div style={{ display: 'flex', gap: 8 }}>
                <button type="submit"
                  style={{ padding: '7px 16px', borderRadius: 8, border: 'none', background: '#7c3aed', color: '#fff', fontWeight: 700, cursor: 'pointer' }}>
                  Submit Appeal
                </button>
                <button type="button" onClick={() => setShowAppealForm(false)}
                  style={{ padding: '7px 14px', borderRadius: 8, border: '1px solid #d1d5db', background: '#fff', cursor: 'pointer' }}>
                  Cancel
                </button>
              </div>
            </form>
          )}
        </div>
      )}
    </div>
  );
}
