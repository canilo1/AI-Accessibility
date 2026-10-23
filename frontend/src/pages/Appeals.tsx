import { useEffect, useState } from 'react';
import { api } from '../api';
import type { Appeal } from '../types';
import { StatusBadge } from '../components/Badges';

const card = {
  background: '#fff',
  borderRadius: 12,
  padding: '20px 24px',
  boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
  border: '1px solid #e5e7eb',
};

export function Appeals({ onViewReturn }: { onViewReturn: (id: number) => void }) {
  const [list, setList]             = useState<Appeal[]>([]);
  const [selected, setSelected]     = useState<Appeal | null>(null);
  const [resolveStatus, setResolveStatus] = useState<'accepted' | 'rejected'>('rejected');
  const [resolvedBy, setResolvedBy] = useState('');
  const [notes, setNotes]           = useState('');
  const [error, setError]           = useState('');
  const [busy, setBusy]             = useState(false);

  const load = () => api.getAppeals().then(setList).catch((e) => setError(e.message));
  useEffect(() => { load(); }, []);

  const handleResolve = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selected) return;
    setBusy(true);
    setError('');
    try {
      await api.resolveAppeal(selected.id, resolveStatus, resolvedBy || 'Investigator', notes);
      setSelected(null);
      setNotes('');
      setResolvedBy('');
      load();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error');
    } finally {
      setBusy(false);
    }
  };

  const pending  = list.filter((a) => a.status === 'pending');
  const resolved = list.filter((a) => a.status !== 'pending');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div>
        <h2 style={{ margin: '0 0 4px', fontSize: 22, fontWeight: 800 }}>Appeals</h2>
        <p style={{ margin: 0, fontSize: 13, color: '#6b7280' }}>
          Taxpayers may submit an appeal to contest a flagged return. Investigators review each appeal and decide to accept or reject it.
          An accepted appeal dismisses the flag — no automated action takes place.
        </p>
      </div>

      {error && <p style={{ color: '#dc2626' }}>{error}</p>}

      {/* Resolve modal */}
      {selected && (
        <div style={{ ...card, borderLeft: '4px solid #2563eb' }}>
          <h3 style={{ margin: '0 0 8px', fontSize: 15, fontWeight: 700 }}>
            Resolve Appeal #{selected.id} — {selected.taxpayer_name} (Tax Year {selected.tax_year})
          </h3>
          <div style={{ background: '#f9fafb', borderRadius: 8, padding: '12px 16px', marginBottom: 16, fontSize: 13, lineHeight: 1.6, color: '#374151' }}>
            <strong>Taxpayer's statement:</strong><br />
            {selected.statement}
          </div>
          <form onSubmit={handleResolve} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'flex', gap: 16 }}>
              {(['accepted', 'rejected'] as const).map((s) => (
                <label key={s} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 14 }}>
                  <input type="radio" name="status" value={s} checked={resolveStatus === s}
                    onChange={() => setResolveStatus(s)} />
                  <span style={{ fontWeight: 600, color: s === 'accepted' ? '#16a34a' : '#dc2626' }}>
                    {s === 'accepted' ? '✔ Accept appeal (dismiss flag)' : '✘ Reject appeal (keep flag)'}
                  </span>
                </label>
              ))}
            </div>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 13 }}>
              <span style={{ fontWeight: 600 }}>Investigator Name</span>
              <input value={resolvedBy} onChange={(e) => setResolvedBy(e.target.value)} placeholder="Your name"
                style={{ padding: '7px 10px', borderRadius: 6, border: '1px solid #d1d5db', fontSize: 13, maxWidth: 300 }} />
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 13 }}>
              <span style={{ fontWeight: 600 }}>Resolution Notes <span style={{ color: '#9ca3af', fontWeight: 400 }}>(optional)</span></span>
              <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} placeholder="Explain your decision…"
                style={{ padding: '7px 10px', borderRadius: 6, border: '1px solid #d1d5db', fontSize: 13, resize: 'vertical' }} />
            </label>
            <div style={{ display: 'flex', gap: 8 }}>
              <button type="submit" disabled={busy}
                style={{ padding: '8px 20px', borderRadius: 8, border: 'none', background: resolveStatus === 'accepted' ? '#16a34a' : '#dc2626', color: '#fff', fontWeight: 700, cursor: 'pointer' }}>
                {busy ? 'Saving…' : `${resolveStatus === 'accepted' ? 'Accept' : 'Reject'} Appeal`}
              </button>
              <button type="button" onClick={() => setSelected(null)}
                style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid #d1d5db', background: '#fff', cursor: 'pointer' }}>
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Pending appeals */}
      <div style={card}>
        <h3 style={{ margin: '0 0 16px', fontSize: 15, fontWeight: 700 }}>
          Pending Appeals <span style={{ fontWeight: 400, color: '#6b7280' }}>({pending.length})</span>
        </h3>
        {pending.length === 0
          ? <p style={{ color: '#6b7280', margin: 0 }}>No pending appeals.</p>
          : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {pending.map((a) => (
                <div key={a.id} style={{ padding: '14px 16px', borderRadius: 8, border: '1px solid #fcd34d', background: '#fffbeb' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 8 }}>
                    <div>
                      <span style={{ fontWeight: 700, fontSize: 14 }}>{a.taxpayer_name}</span>
                      <span style={{ color: '#6b7280', fontSize: 13 }}> — Tax Year {a.tax_year} (Return #{a.tax_return_id})</span>
                      <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 2 }}>Submitted {a.submitted_at.slice(0, 10)}</div>
                    </div>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button onClick={() => onViewReturn(a.tax_return_id)}
                        style={{ fontSize: 12, padding: '4px 10px', borderRadius: 6, border: '1px solid #d1d5db', cursor: 'pointer', background: '#fff' }}>
                        View Return
                      </button>
                      <button onClick={() => setSelected(a)}
                        style={{ fontSize: 12, padding: '4px 12px', borderRadius: 6, border: 'none', background: '#2563eb', color: '#fff', fontWeight: 700, cursor: 'pointer' }}>
                        Review
                      </button>
                    </div>
                  </div>
                  <p style={{ margin: '10px 0 0', fontSize: 13, color: '#374151', lineHeight: 1.6 }}>
                    <strong>Statement:</strong> {a.statement}
                  </p>
                </div>
              ))}
            </div>
          )
        }
      </div>

      {/* Resolved appeals */}
      {resolved.length > 0 && (
        <div style={card}>
          <h3 style={{ margin: '0 0 16px', fontSize: 15, fontWeight: 700 }}>
            Resolved Appeals <span style={{ fontWeight: 400, color: '#6b7280' }}>({resolved.length})</span>
          </h3>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #e5e7eb' }}>
                {['Taxpayer', 'Year', 'Decision', 'Resolved By', 'Notes', ''].map((h) => (
                  <th key={h} style={{ textAlign: 'left', padding: '6px 8px', color: '#6b7280', fontWeight: 600 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {resolved.map((a) => (
                <tr key={a.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                  <td style={{ padding: '6px 8px', fontWeight: 600 }}>{a.taxpayer_name}</td>
                  <td style={{ padding: '6px 8px' }}>{a.tax_year}</td>
                  <td style={{ padding: '6px 8px' }}><StatusBadge status={a.status} /></td>
                  <td style={{ padding: '6px 8px', color: '#6b7280' }}>{a.resolved_by ?? '—'}</td>
                  <td style={{ padding: '6px 8px', color: '#6b7280', maxWidth: 200 }}>{a.resolution_notes ?? '—'}</td>
                  <td style={{ padding: '6px 8px' }}>
                    <button onClick={() => onViewReturn(a.tax_return_id)}
                      style={{ fontSize: 12, padding: '3px 8px', borderRadius: 6, border: '1px solid #d1d5db', cursor: 'pointer', background: '#fff' }}>
                      View
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
