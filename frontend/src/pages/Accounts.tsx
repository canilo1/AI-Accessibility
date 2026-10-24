import { useEffect, useState } from 'react';
import { api } from '../api';
import type { AdminAccount } from '../types';

const panel: React.CSSProperties = { background: '#fff', border: '1px solid #dfe5df', borderRadius: 5, padding: 20 };

export function Accounts() {
  const [admins, setAdmins] = useState<AdminAccount[]>([]);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);

  const load = async () => {
    try {
      setAdmins(await api.getAdminAccounts());
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Unable to load administrator accounts');
    }
  };

  useEffect(() => { void load(); }, []);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    setNotice('');
    setBusy(true);
    try {
      await api.createAdminAccount({ name, email, password });
      setName('');
      setEmail('');
      setPassword('');
      setNotice('Administrator account created. Share the temporary password securely and ask them to change it after signing in.');
      await load();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Unable to create administrator account');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ display: 'grid', gap: 20 }}>
      <header><p style={{ margin: 0, color: '#64736a', fontSize: 12, fontWeight: 700, textTransform: 'uppercase' }}>Access control</p><h1 style={{ margin: '5px 0 0', fontSize: 26 }}>Accounts</h1></header>

      {error && <p role="alert" style={{ margin: 0, color: '#9a3d32', background: '#fff', border: '1px solid #e5b8b2', padding: 12 }}>{error}</p>}
      {notice && <p role="status" style={{ margin: 0, color: '#276b56', background: '#fff', border: '1px solid #a8c9b3', padding: 12, fontSize: 13 }}>{notice}</p>}

      <section style={panel}>
        <h2 style={{ margin: '0 0 6px', fontSize: 17 }}>Create administrator</h2>
        <p style={{ margin: '0 0 16px', color: '#64736a', fontSize: 13 }}>New administrators receive access to all review and taxpayer management tools.</p>
        <form onSubmit={submit} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 12, alignItems: 'end' }}>
          <Field label="Name" value={name} onChange={setName} autoComplete="name" />
          <Field label="Email" value={email} onChange={setEmail} type="email" autoComplete="email" />
          <Field label="Temporary password" value={password} onChange={setPassword} type="password" autoComplete="new-password" minLength={12} maxLength={128} />
          <button type="submit" disabled={busy} style={{ minHeight: 39, border: 0, borderRadius: 4, padding: '9px 12px', background: '#276b56', color: '#fff', fontWeight: 700, cursor: busy ? 'wait' : 'pointer' }}>{busy ? 'Creating…' : 'Create admin account'}</button>
        </form>
      </section>

      <section style={panel}>
        <h2 style={{ margin: '0 0 14px', fontSize: 17 }}>Administrator accounts <span style={{ color: '#64736a', fontSize: 13, fontWeight: 500 }}>({admins.length})</span></h2>
        {!admins.length ? <p style={{ margin: 0, color: '#64736a', fontSize: 13 }}>No administrator accounts were found.</p> : <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead><tr>{['Name', 'Email', 'Created'].map((header) => <th key={header} style={th}>{header}</th>)}</tr></thead>
            <tbody>{admins.map((admin) => <tr key={admin.id}>
              <td style={td}>{admin.display_name}</td><td style={td}>{admin.email}</td><td style={td}>{admin.created_at.slice(0, 10)}</td>
            </tr>)}</tbody>
          </table>
        </div>}
      </section>

      <p style={{ margin: 0, color: '#64736a', fontSize: 12, lineHeight: 1.6 }}>Customer accounts are invited from the Taxpayers page. Each invitation is tied to one verified taxpayer profile, expires after 72 hours, and can only be used once.</p>
    </div>
  );
}

function Field({ label, value, onChange, type = 'text', autoComplete, minLength, maxLength }: { label: string; value: string; onChange: (value: string) => void; type?: string; autoComplete?: string; minLength?: number; maxLength?: number }) {
  return <label style={{ display: 'grid', gap: 5, fontSize: 12, color: '#52645a', fontWeight: 650 }}>{label}<input required value={value} type={type} autoComplete={autoComplete} minLength={minLength} maxLength={maxLength} onChange={(event) => onChange(event.target.value)} style={{ minHeight: 39, padding: '8px 9px', border: '1px solid #becbc2', borderRadius: 4, font: 'inherit', fontWeight: 400 }} /></label>;
}

const th: React.CSSProperties = { padding: '9px 10px', textAlign: 'left', color: '#65736b', borderBottom: '1px solid #dfe5df', fontSize: 12, fontWeight: 650 };
const td: React.CSSProperties = { padding: '11px 10px', borderBottom: '1px solid #edf0ed' };