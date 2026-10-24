import { useEffect, useState } from 'react';
import { api } from '../api';
import type { AuthAccount, CustomerDashboardData, CustomerDocument } from '../types';

const panel = { background: '#fff', border: '1px solid #dfe5df', borderRadius: 5, padding: 20 };
const currentYear = new Date().getFullYear();
const statusLabel: Record<string, string> = {
  pending: 'Submitted', flagged: 'Additional review', needs_review: 'Under review', approved_for_audit: 'Under review',
  cleared: 'No rule signal', dismissed: 'Reviewer cleared', closed: 'Closed',
};
const documentLabel: Record<CustomerDocument['status'], string> = {
  awaiting_review: 'Awaiting review', in_review: 'In review', approved: 'Accepted', needs_info: 'Action needed',
};

export function CustomerPortal({ account, onLogout }: { account: AuthAccount; onLogout: () => void }) {
  const [data, setData] = useState<CustomerDashboardData | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [year, setYear] = useState(currentYear);
  const [category, setCategory] = useState<CustomerDocument['category']>('tax_return');
  const [file, setFile] = useState<File | null>(null);
  const [appealFor, setAppealFor] = useState<number | null>(null);
  const [appealText, setAppealText] = useState('');
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');

  const load = async () => {
    try {
      setData(await api.getCustomerDashboard());
      setError('');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Unable to load your account');
    }
  };

  useEffect(() => { void load(); }, []);

  const upload = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!file) return;
    const form = new FormData();
    form.set('document', file);
    form.set('tax_year', String(year));
    form.set('category', category);
    setBusy(true);
    setError('');
    try {
      await api.uploadDocument(form);
      setFile(null);
      setNotice('Document submitted for review.');
      await load();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setBusy(false);
    }
  };

  const download = async (uploadedDocument: CustomerDocument) => {
    try {
      const blob = await api.downloadDocument(uploadedDocument.id);
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = uploadedDocument.original_name;
      link.click();
      URL.revokeObjectURL(link.href);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Download failed');
    }
  };

  const submitAppeal = async (returnId: number) => {
    try {
      await api.submitCustomerAppeal(returnId, appealText);
      setAppealFor(null);
      setAppealText('');
      setNotice('Your appeal was submitted for review.');
      await load();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Appeal submission failed');
    }
  };

  const changePassword = async (event: React.FormEvent) => {
    event.preventDefault();
    try {
      const result = await api.changePassword(currentPassword, newPassword);
      setNotice(result.message);
      setCurrentPassword('');
      setNewPassword('');
      setShowPasswordForm(false);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Unable to change password');
    }
  };

  const flaggedCount = data?.returns.filter((item) => ['flagged', 'needs_review', 'approved_for_audit'].includes(item.status)).length ?? 0;
  const waitingDocuments = data?.documents.filter((item) => ['awaiting_review', 'in_review'].includes(item.status)).length ?? 0;

  return (
    <main style={{ minHeight: '100vh', background: '#f3f5f2', color: '#17211c' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, padding: '18px clamp(18px, 5vw, 72px)', background: '#163a32', color: '#fff' }}>
        <div><strong style={{ fontSize: 17 }}>FairTax</strong><span style={{ marginLeft: 12, color: '#c5d6cc', fontSize: 13 }}>Customer portal</span></div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, flexWrap: 'wrap', justifyContent: 'end' }}><span>{account.display_name}</span><button onClick={() => setShowPasswordForm(!showPasswordForm)} style={{ border: '1px solid #78978a', borderRadius: 4, padding: '7px 10px', color: '#fff', background: 'transparent', cursor: 'pointer' }}>Password</button><button onClick={onLogout} style={{ border: '1px solid #78978a', borderRadius: 4, padding: '7px 10px', color: '#fff', background: 'transparent', cursor: 'pointer' }}>Sign out</button></div>
      </header>

      <div style={{ maxWidth: 1180, margin: '0 auto', padding: '34px clamp(16px, 4vw, 48px)', display: 'flex', flexDirection: 'column', gap: 22 }}>
        <div>
          <p style={{ margin: 0, color: '#557065', fontSize: 12, fontWeight: 700, textTransform: 'uppercase' }}>My account</p>
          <h1 style={{ margin: '6px 0 4px', fontSize: 28 }}>Welcome, {data?.taxpayer.name ?? account.display_name}</h1>
          <p style={{ margin: 0, color: '#65736b', fontSize: 14 }}>{data?.taxpayer.email ?? account.email}</p>
        </div>

        {error && <p role="alert" style={{ ...panel, borderColor: '#e5b8b2', color: '#9a3d32', margin: 0 }}>{error}</p>}
        {notice && <p role="status" style={{ ...panel, borderColor: '#a8c9b3', color: '#276b56', margin: 0 }}>{notice}</p>}

        {showPasswordForm && <form onSubmit={(event) => void changePassword(event)} style={{ ...panel, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, alignItems: 'end' }}>
          <label style={fieldLabel}>Current password<input required type="password" autoComplete="current-password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} style={inputStyle} /></label>
          <label style={fieldLabel}>New password<input required minLength={12} maxLength={128} type="password" autoComplete="new-password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} style={inputStyle} /></label>
          <button type="submit" style={primaryButton}>Update password</button>
        </form>}

        <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 12 }}>
          <Metric label="Tax returns" value={data?.returns.length ?? 0} />
          <Metric label="Documents" value={data?.documents.length ?? 0} />
          <Metric label="Items in review" value={waitingDocuments + flaggedCount} />
        </section>

        <section style={panel}>
          <h2 style={{ margin: '0 0 14px', fontSize: 18 }}>Tax history</h2>
          {!data?.returns.length ? <p style={{ color: '#65736b', margin: 0 }}>No tax returns are available yet.</p> : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 640, fontSize: 13 }}>
                <thead><tr>{['Tax year', 'Gross income', 'Deductions', 'Tax paid', 'Status', ''].map((label) => <th key={label} style={th}>{label}</th>)}</tr></thead>
                <tbody>{data.returns.map((taxReturn) => {
                  const hasAppeal = data.appeals.some((appeal) => appeal.tax_return_id === taxReturn.id && appeal.status === 'pending');
                  const mayAppeal = ['flagged', 'needs_review', 'approved_for_audit'].includes(taxReturn.status) && !hasAppeal;
                  return <tr key={taxReturn.id}>
                    <td style={td}>{taxReturn.tax_year}</td><td style={td}>${taxReturn.gross_income.toLocaleString()}</td>
                    <td style={td}>${taxReturn.declared_deductions.toLocaleString()}</td><td style={td}>${taxReturn.tax_paid.toLocaleString()}</td>
                    <td style={td}><span style={{ color: taxReturn.status === 'flagged' || taxReturn.status === 'needs_review' ? '#94651b' : '#405b4d', fontWeight: 650 }}>{statusLabel[taxReturn.status] ?? 'Submitted'}</span></td>
                    <td style={td}>{mayAppeal && <button onClick={() => { setAppealFor(taxReturn.id); setAppealText(''); }} style={quietButton}>Submit appeal</button>}</td>
                  </tr>;
                })}</tbody>
              </table>
            </div>
          )}
          {appealFor !== null && (
            <form onSubmit={(event) => { event.preventDefault(); void submitAppeal(appealFor); }} style={{ display: 'grid', gap: 10, marginTop: 16, maxWidth: 700 }}>
              <label style={{ fontSize: 13, fontWeight: 650 }}>Appeal for tax year {data?.returns.find((item) => item.id === appealFor)?.tax_year}
                <textarea required rows={4} value={appealText} onChange={(event) => setAppealText(event.target.value)} style={{ display: 'block', width: '100%', marginTop: 6, padding: 10, border: '1px solid #becbc2', borderRadius: 4, resize: 'vertical' }} />
              </label>
              <div style={{ display: 'flex', gap: 8 }}><button type="submit" style={primaryButton}>Send appeal</button><button type="button" onClick={() => setAppealFor(null)} style={quietButton}>Cancel</button></div>
            </form>
          )}
        </section>

        <section className="customer-document-grid" style={{ display: 'grid', gridTemplateColumns: 'minmax(280px, 0.8fr) minmax(360px, 1.2fr)', gap: 18, alignItems: 'start' }}>
          <div style={panel}>
            <h2 style={{ margin: '0 0 6px', fontSize: 18 }}>Submit a document</h2>
            <p style={{ margin: '0 0 16px', color: '#65736b', fontSize: 13, lineHeight: 1.6 }}>PDF, JPEG, or PNG up to 10 MB. Submitted files are private to your account and the review team.</p>
            <form onSubmit={upload} style={{ display: 'grid', gap: 12 }}>
              <label style={fieldLabel}>Tax year<input required type="number" min="1900" max={currentYear + 1} value={year} onChange={(event) => setYear(Number(event.target.value))} style={inputStyle} /></label>
              <label style={fieldLabel}>Document type<select value={category} onChange={(event) => setCategory(event.target.value as CustomerDocument['category'])} style={inputStyle}>
                <option value="tax_return">Tax return</option><option value="income_statement">Income statement</option><option value="expense_receipt">Expense receipt</option><option value="identity">Identity document</option><option value="other">Other</option>
              </select></label>
              <label style={fieldLabel}>File<input required type="file" accept="application/pdf,image/jpeg,image/png" onChange={(event) => setFile(event.target.files?.[0] ?? null)} style={{ ...inputStyle, padding: 7 }} /></label>
              <button type="submit" disabled={busy || !file} style={{ ...primaryButton, opacity: busy || !file ? 0.6 : 1 }}>{busy ? 'Uploading…' : 'Upload for review'}</button>
            </form>
          </div>

          <div style={panel}>
            <h2 style={{ margin: '0 0 14px', fontSize: 18 }}>My documents</h2>
            {!data?.documents.length ? <p style={{ color: '#65736b', margin: 0 }}>Your submitted documents will appear here.</p> : (
              <div style={{ display: 'grid' }}>{data.documents.map((document) => (
                <article key={document.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 14, padding: '13px 0', borderTop: '1px solid #e6ebe6' }}>
                  <div style={{ minWidth: 0 }}><strong style={{ display: 'block', overflowWrap: 'anywhere', fontSize: 13 }}>{document.original_name}</strong><span style={{ display: 'block', color: '#65736b', fontSize: 12, marginTop: 4 }}>{document.tax_year} · {document.category.replaceAll('_', ' ')} · {documentLabel[document.status]}</span>
                    {document.review_notes && <span style={{ display: 'block', color: '#8c5c1b', fontSize: 12, marginTop: 5 }}>{document.review_notes}</span>}</div>
                  <button onClick={() => void download(document)} style={quietButton}>Download</button>
                </article>
              ))}</div>
            )}
          </div>
        </section>

        <p style={{ margin: 0, color: '#65736b', fontSize: 12, lineHeight: 1.6 }}>Automated review indicators are not determinations of fraud. Contact your administrator if your taxpayer profile needs to be linked to an existing record.</p>
      </div>
    </main>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return <div style={{ ...panel, padding: 16 }}><div style={{ color: '#65736b', fontSize: 12 }}>{label}</div><div style={{ fontSize: 25, fontWeight: 750, marginTop: 5 }}>{value}</div></div>;
}

const th: React.CSSProperties = { padding: '9px 10px', textAlign: 'left', color: '#65736b', borderBottom: '1px solid #dfe5df', fontSize: 12, fontWeight: 650, whiteSpace: 'nowrap' };
const td: React.CSSProperties = { padding: '11px 10px', borderBottom: '1px solid #edf0ed', verticalAlign: 'top' };
const fieldLabel: React.CSSProperties = { display: 'grid', gap: 5, fontSize: 12, fontWeight: 650 };
const inputStyle: React.CSSProperties = { minHeight: 38, width: '100%', padding: '8px 9px', border: '1px solid #becbc2', borderRadius: 4, background: '#fff', fontSize: 13 };
const primaryButton: React.CSSProperties = { border: 0, borderRadius: 4, padding: '9px 12px', background: '#276b56', color: '#fff', fontWeight: 700, cursor: 'pointer' };
const quietButton: React.CSSProperties = { border: '1px solid #becbc2', borderRadius: 4, padding: '7px 9px', background: '#fff', color: '#254c3e', fontSize: 12, fontWeight: 650, cursor: 'pointer', whiteSpace: 'nowrap' };