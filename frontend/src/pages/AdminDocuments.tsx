import { useEffect, useState } from 'react';
import { api } from '../api';
import type { CustomerDocument } from '../types';

const statusOptions: CustomerDocument['status'][] = ['awaiting_review', 'in_review', 'approved', 'needs_info'];
const statusText: Record<CustomerDocument['status'], string> = {
  awaiting_review: 'Awaiting review', in_review: 'In review', approved: 'Accepted', needs_info: 'Action needed',
};

export function AdminDocuments() {
  const [documents, setDocuments] = useState<CustomerDocument[]>([]);
  const [drafts, setDrafts] = useState<Record<number, { status: CustomerDocument['status']; notes: string }>>({});
  const [filter, setFilter] = useState<'all' | CustomerDocument['status']>('all');
  const [error, setError] = useState('');
  const [saved, setSaved] = useState<number | null>(null);

  const load = async () => {
    try {
      const items = await api.getAdminDocuments();
      setDocuments(items);
      setDrafts(Object.fromEntries(items.map((item) => [item.id, { status: item.status, notes: item.review_notes ?? '' }])));
      setError('');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Unable to load documents');
    }
  };

  useEffect(() => { void load(); }, []);

  const save = async (documentId: number) => {
    const draft = drafts[documentId];
    if (!draft) return;
    try {
      await api.updateDocument(documentId, draft.status, draft.notes);
      setSaved(documentId);
      await load();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Unable to update review');
    }
  };

  const download = async (item: CustomerDocument) => {
    try {
      const blob = await api.downloadDocument(item.id);
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = item.original_name;
      link.click();
      URL.revokeObjectURL(link.href);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Unable to download document');
    }
  };

  const visible = filter === 'all' ? documents : documents.filter((item) => item.status === filter);
  const waiting = documents.filter((item) => item.status === 'awaiting_review').length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <header style={{ display: 'flex', alignItems: 'end', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
        <div><p style={{ margin: 0, color: '#64736a', fontSize: 12, fontWeight: 700, textTransform: 'uppercase' }}>Customer submissions</p><h1 style={{ margin: '5px 0 0', fontSize: 26 }}>Document review</h1></div>
        <div style={{ color: '#65736b', fontSize: 13 }}><strong style={{ color: '#17211c', fontSize: 20 }}>{waiting}</strong> awaiting review</div>
      </header>

      {error && <p role="alert" style={{ color: '#9a3d32', background: '#fff', border: '1px solid #e5b8b2', padding: 12, margin: 0 }}>{error}</p>}

      <section style={{ background: '#fff', border: '1px solid #dfe5df', borderRadius: 5, padding: '13px 16px', display: 'flex', gap: 7, overflowX: 'auto' }}>
        {(['all', ...statusOptions] as const).map((status) => {
          const label = status === 'all' ? 'All documents' : statusText[status];
          const count = status === 'all' ? documents.length : documents.filter((item) => item.status === status).length;
          return <button key={status} onClick={() => setFilter(status)} style={{ flexShrink: 0, padding: '7px 10px', border: filter === status ? '1px solid #276b56' : '1px solid #d4ddd5', borderRadius: 4, background: filter === status ? '#eaf2ec' : '#fff', color: filter === status ? '#205540' : '#52645a', fontSize: 12, fontWeight: 650, cursor: 'pointer' }}>{label} <span style={{ opacity: 0.7 }}>{count}</span></button>;
        })}
      </section>

      {visible.length === 0 ? <div style={{ background: '#fff', border: '1px solid #dfe5df', padding: 24, color: '#65736b', fontSize: 14 }}>No documents in this queue.</div> : (
        <section style={{ display: 'grid', gap: 12 }}>
          {visible.map((item) => {
            const draft = drafts[item.id] ?? { status: item.status, notes: item.review_notes ?? '' };
            return <article key={item.id} style={{ background: '#fff', border: '1px solid #dfe5df', borderRadius: 5, padding: 18 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'start', flexWrap: 'wrap' }}>
                <div style={{ minWidth: 200 }}>
                  <h2 style={{ margin: '0 0 5px', fontSize: 16, overflowWrap: 'anywhere' }}>{item.original_name}</h2>
                  <div style={{ color: '#52645a', fontSize: 13 }}>{item.taxpayer_name} · {item.taxpayer_email}</div>
                  <div style={{ color: '#78857d', fontSize: 12, marginTop: 5 }}>{item.tax_year} · {item.category.replaceAll('_', ' ')} · {(item.size / 1024).toFixed(0)} KB · {new Date(item.uploaded_at).toLocaleString()}</div>
                </div>
                <button onClick={() => void download(item)} style={buttonStyle}>Download document</button>
              </div>
              <div className="admin-document-review" style={{ display: 'grid', gridTemplateColumns: 'minmax(170px, 0.45fr) minmax(240px, 1fr) auto', gap: 10, marginTop: 16, alignItems: 'end' }}>
                <label style={labelStyle}>Review status<select value={draft.status} onChange={(event) => setDrafts((old) => ({ ...old, [item.id]: { ...draft, status: event.target.value as CustomerDocument['status'] } }))} style={inputStyle}>
                  {statusOptions.map((status) => <option key={status} value={status}>{statusText[status]}</option>)}
                </select></label>
                <label style={labelStyle}>Customer note<textarea rows={2} value={draft.notes} onChange={(event) => setDrafts((old) => ({ ...old, [item.id]: { ...draft, notes: event.target.value } }))} placeholder="Explain what is needed or the review outcome" style={{ ...inputStyle, resize: 'vertical' }} /></label>
                <button onClick={() => void save(item.id)} style={{ ...buttonStyle, borderColor: '#276b56', background: '#276b56', color: '#fff' }}>{saved === item.id ? 'Saved' : 'Save review'}</button>
              </div>
              {item.reviewed_by && <div style={{ marginTop: 10, color: '#78857d', fontSize: 11 }}>Last updated by {item.reviewed_by}{item.reviewed_at ? ` · ${new Date(item.reviewed_at).toLocaleString()}` : ''}</div>}
            </article>;
          })}
        </section>
      )}
    </div>
  );
}

const labelStyle: React.CSSProperties = { display: 'grid', gap: 5, color: '#52645a', fontSize: 12, fontWeight: 650 };
const inputStyle: React.CSSProperties = { width: '100%', minHeight: 37, padding: '8px 9px', border: '1px solid #c8d2ca', borderRadius: 4, color: '#17211c', background: '#fff', font: 'inherit', fontWeight: 400 };
const buttonStyle: React.CSSProperties = { minHeight: 36, padding: '7px 10px', border: '1px solid #becbc2', borderRadius: 4, background: '#fff', color: '#254c3e', fontSize: 12, fontWeight: 650, cursor: 'pointer', whiteSpace: 'nowrap' };