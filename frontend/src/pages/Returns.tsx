import { useEffect, useState } from 'react';
import { api } from '../api';
import type { TaxReturn, Taxpayer } from '../types';
import { StatusBadge } from '../components/Badges';

const card = {
  background: '#fff',
  borderRadius: 12,
  padding: '20px 24px',
  boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
  border: '1px solid #e5e7eb',
};

const emptyForm = {
  taxpayer_id: 0, tax_year: new Date().getFullYear(),
  gross_income: 0, declared_deductions: 0, taxable_income: 0, tax_paid: 0,
  num_dependents: 0, business_expenses: 0, charitable_donations: 0,
  filing_date: new Date().toISOString().slice(0, 10),
};

type FormData = typeof emptyForm;

const NUM_FIELDS: { key: keyof FormData; label: string }[] = [
  { key: 'gross_income',         label: 'Gross Income ($)'       },
  { key: 'declared_deductions',  label: 'Declared Deductions ($)' },
  { key: 'taxable_income',       label: 'Taxable Income ($)'      },
  { key: 'tax_paid',             label: 'Tax Paid ($)'            },
  { key: 'business_expenses',    label: 'Business Expenses ($)'   },
  { key: 'charitable_donations', label: 'Charitable Donations ($)'},
  { key: 'num_dependents',       label: 'Number of Dependents'    },
];

export function Returns({
  filterTaxpayerId,
  filterTaxpayerName,
  onViewDetail,
  onClearFilter,
}: {
  filterTaxpayerId?: number;
  filterTaxpayerName?: string;
  onViewDetail: (id: number) => void;
  onClearFilter: () => void;
}) {
  const [list, setList]           = useState<TaxReturn[]>([]);
  const [taxpayers, setTaxpayers] = useState<Taxpayer[]>([]);
  const [form, setForm]           = useState<FormData>(emptyForm);
  const [showForm, setShowForm]   = useState(false);
  const [error, setError]         = useState('');
  const [analyzing, setAnalyzing] = useState<number | null>(null);

  const load = () => {
    api.getReturns(filterTaxpayerId).then(setList).catch((e) => setError(e.message));
    api.getTaxpayers().then(setTaxpayers).catch(() => {});
  };

  useEffect(() => { load(); }, [filterTaxpayerId]);

  useEffect(() => {
    if (filterTaxpayerId) setForm((f) => ({ ...f, taxpayer_id: filterTaxpayerId }));
  }, [filterTaxpayerId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      await api.createReturn(form);
      setForm(emptyForm);
      setShowForm(false);
      load();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    }
  };

  const handleAnalyze = async (id: number) => {
    setAnalyzing(id);
    try {
      await api.analyzeReturn(id);
      load();
    } finally {
      setAnalyzing(null);
    }
  };

  const handleStatus = async (id: number, status: TaxReturn['status']) => {
    await api.updateReturnStatus(id, status);
    load();
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 22, fontWeight: 800 }}>
            Tax Returns {filterTaxpayerName ? `— ${filterTaxpayerName}` : ''}
          </h2>
          {filterTaxpayerId && (
            <button onClick={onClearFilter} style={{ marginTop: 4, fontSize: 12, color: '#6b7280', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}>
              ← Show all returns
            </button>
          )}
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          style={{ padding: '8px 18px', borderRadius: 8, border: 'none', background: '#2563eb', color: '#fff', fontWeight: 700, cursor: 'pointer' }}
        >
          {showForm ? 'Cancel' : '+ Add Return'}
        </button>
      </div>

      {showForm && (
        <div style={card}>
          <h3 style={{ margin: '0 0 16px', fontSize: 16, fontWeight: 700 }}>New Tax Return</h3>
          {error && <p style={{ color: '#dc2626', marginBottom: 12 }}>{error}</p>}
          <form onSubmit={handleSubmit} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 13 }}>
              <span style={{ fontWeight: 600 }}>Taxpayer</span>
              <select
                required
                value={form.taxpayer_id || ''}
                onChange={(e) => setForm((f) => ({ ...f, taxpayer_id: Number(e.target.value) }))}
                style={{ padding: '7px 10px', borderRadius: 6, border: '1px solid #d1d5db', fontSize: 13 }}
              >
                <option value="">— Select Taxpayer —</option>
                {taxpayers.map((t) => <option key={t.id} value={t.id}>{t.name} ({t.tin})</option>)}
              </select>
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 13 }}>
              <span style={{ fontWeight: 600 }}>Tax Year</span>
              <input type="number" required value={form.tax_year}
                onChange={(e) => setForm((f) => ({ ...f, tax_year: Number(e.target.value) }))}
                style={{ padding: '7px 10px', borderRadius: 6, border: '1px solid #d1d5db', fontSize: 13 }}
              />
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 13 }}>
              <span style={{ fontWeight: 600 }}>Filing Date</span>
              <input type="date" required value={form.filing_date}
                onChange={(e) => setForm((f) => ({ ...f, filing_date: e.target.value }))}
                style={{ padding: '7px 10px', borderRadius: 6, border: '1px solid #d1d5db', fontSize: 13 }}
              />
            </label>
            {NUM_FIELDS.map(({ key, label }) => (
              <label key={key} style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 13 }}>
                <span style={{ fontWeight: 600 }}>{label}</span>
                <input type="number" min={0} step="0.01" value={form[key]}
                  onChange={(e) => setForm((f) => ({ ...f, [key]: Number(e.target.value) }))}
                  style={{ padding: '7px 10px', borderRadius: 6, border: '1px solid #d1d5db', fontSize: 13 }}
                />
              </label>
            ))}
            <div style={{ gridColumn: '1 / -1', display: 'flex', gap: 8 }}>
              <button type="submit" style={{ padding: '8px 20px', borderRadius: 8, border: 'none', background: '#2563eb', color: '#fff', fontWeight: 700, cursor: 'pointer' }}>
                Submit & Analyze
              </button>
              <button type="button" onClick={() => setShowForm(false)}
                style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid #d1d5db', background: '#fff', cursor: 'pointer' }}>
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      <div style={card}>
        {list.length === 0 ? (
          <p style={{ color: '#6b7280', margin: 0 }}>No tax returns found.</p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #e5e7eb' }}>
                  {['Taxpayer', 'Year', 'Gross Income', 'Deductions', 'Tax Paid', 'Status', 'Actions'].map((h) => (
                    <th key={h} style={{ textAlign: 'left', padding: '8px 10px', color: '#6b7280', fontWeight: 600, whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {list.map((r) => (
                  <tr key={r.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                    <td style={{ padding: '8px 10px', fontWeight: 600 }}>{r.taxpayer_name ?? `#${r.taxpayer_id}`}</td>
                    <td style={{ padding: '8px 10px' }}>{r.tax_year}</td>
                    <td style={{ padding: '8px 10px' }}>${r.gross_income.toLocaleString()}</td>
                    <td style={{ padding: '8px 10px' }}>${r.declared_deductions.toLocaleString()}</td>
                    <td style={{ padding: '8px 10px' }}>${r.tax_paid.toLocaleString()}</td>
                    <td style={{ padding: '8px 10px' }}><StatusBadge status={r.status} /></td>
                    <td style={{ padding: '8px 10px', display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                      <button onClick={() => onViewDetail(r.id)}
                        style={{ fontSize: 12, padding: '3px 8px', borderRadius: 6, border: '1px solid #2563eb', color: '#2563eb', cursor: 'pointer', background: '#eff6ff' }}>
                        Detail
                      </button>
                      <button onClick={() => handleAnalyze(r.id)} disabled={analyzing === r.id}
                        style={{ fontSize: 12, padding: '3px 8px', borderRadius: 6, border: '1px solid #d1d5db', cursor: 'pointer', background: '#fff' }}>
                        {analyzing === r.id ? '…' : 'Re-analyze'}
                      </button>
                      {r.status === 'flagged' && (
                        <button onClick={() => handleStatus(r.id, 'needs_review')}
                          style={{ fontSize: 12, padding: '3px 8px', borderRadius: 6, border: '1px solid #ca8a04', color: '#ca8a04', cursor: 'pointer', background: '#fefce8' }}>
                          Queue Review
                        </button>
                      )}
                      {r.status === 'needs_review' && (
                        <button onClick={() => handleStatus(r.id, 'dismissed')}
                          style={{ fontSize: 12, padding: '3px 8px', borderRadius: 6, border: '1px solid #16a34a', color: '#16a34a', cursor: 'pointer', background: '#f0fdf4' }}>
                          Dismiss
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
